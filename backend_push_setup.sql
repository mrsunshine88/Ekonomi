-- ==========================================
-- ÄKTA BAKGRUNDS-TILLDELNING OCH PUSH
-- ==========================================

-- 1. Helper-funktion för att tilldela ärenden server-side
CREATE OR REPLACE FUNCTION public.system_auto_assign_ticket(target_agent_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session_id UUID;
    v_agent_id UUID;
    v_ticket_type TEXT;
    v_agent_email TEXT;
BEGIN
    -- Om en specifik agent nyss blev "Ledig"
    IF target_agent_id IS NOT NULL THEN
        -- Kontrollera att agenten fortfarande är ledig
        IF NOT EXISTS (SELECT 1 FROM agent_sessions WHERE agent_id = target_agent_id AND status = 'available') THEN
            RETURN;
        END IF;

        -- Hämta agentens e-post
        SELECT email INTO v_agent_email FROM profiles WHERE id = target_agent_id;

        -- Hitta äldsta väntande ärende som agenten har behörighet för (Lås raden så inga krockar sker)
        SELECT id, ticket_type INTO v_session_id, v_ticket_type
        FROM chat_sessions
        WHERE status = 'waiting'
          AND (
              (ticket_type = 'chat' AND EXISTS (SELECT 1 FROM profiles WHERE id = target_agent_id AND handles_chat = true))
              OR
              (ticket_type = 'email' AND EXISTS (SELECT 1 FROM profiles WHERE id = target_agent_id AND handles_email = true))
          )
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1;

        IF v_session_id IS NOT NULL THEN
            UPDATE chat_sessions 
            SET status = 'assigned', assigned_to = target_agent_id, assigned_name = v_agent_email
            WHERE id = v_session_id;
            
            UPDATE agent_sessions
            SET status = 'busy'
            WHERE agent_id = target_agent_id;
        END IF;

    ELSE
        -- Ett NYTT ärende kom in i kön. Leta efter en ledig agent!
        FOR v_session_id, v_ticket_type IN 
            SELECT id, ticket_type FROM chat_sessions WHERE status = 'waiting' ORDER BY created_at ASC FOR UPDATE SKIP LOCKED
        LOOP
            -- Hitta en ledig agent som har behörighet och har väntat längst
            SELECT a.agent_id, p.email INTO v_agent_id, v_agent_email
            FROM agent_sessions a
            JOIN profiles p ON a.agent_id = p.id
            WHERE a.status = 'available'
              AND (
                  (v_ticket_type = 'chat' AND p.handles_chat = true)
                  OR
                  (v_ticket_type = 'email' AND p.handles_email = true)
              )
            ORDER BY a.updated_at ASC
            FOR UPDATE OF a SKIP LOCKED
            LIMIT 1;

            IF v_agent_id IS NOT NULL THEN
                UPDATE chat_sessions 
                SET status = 'assigned', assigned_to = v_agent_id, assigned_name = v_agent_email
                WHERE id = v_session_id;
                
                UPDATE agent_sessions
                SET status = 'busy'
                WHERE agent_id = v_agent_id;
            END IF;
        END LOOP;
    END IF;
END;
$$;

-- 2. Trigger: När ett NYTT ärende skapas
CREATE OR REPLACE FUNCTION public.trigger_on_new_ticket()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'waiting' THEN
        -- Försök tilldela direkt till valfri ledig agent
        PERFORM public.system_auto_assign_ticket();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_ticket_auto_assign ON chat_sessions;
CREATE TRIGGER on_new_ticket_auto_assign
AFTER INSERT ON chat_sessions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_on_new_ticket();

-- 3. Trigger: När en agent blir "Ledig"
CREATE OR REPLACE FUNCTION public.trigger_on_agent_available()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'available' AND OLD.status != 'available' THEN
        -- Försök tilldela äldsta väntande ärende till denna agent
        PERFORM public.system_auto_assign_ticket(NEW.agent_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_agent_available_auto_assign ON agent_sessions;
CREATE TRIGGER on_agent_available_auto_assign
AFTER UPDATE ON agent_sessions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_on_agent_available();

-- 4. Trigger Webhook för Push-notis
-- Noterar Vercel-API:et i bakgrunden via pg_net
CREATE OR REPLACE FUNCTION public.trigger_push_on_assignment()
RETURNS TRIGGER AS $$
DECLARE
    req_id bigint;
BEGIN
    IF OLD.status = 'waiting' AND NEW.status = 'assigned' AND NEW.assigned_to IS NOT NULL THEN
        -- Kontrollera om pg_net finns installerat så vi inte kraschar appen om det saknas
        IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
            SELECT net.http_post(
                url:='https://www.smartekonomi.nu/api/send-push',
                headers:='{"Content-Type": "application/json"}'::jsonb,
                body:=json_build_object(
                    'action', 'assigned',
                    'target_email', NEW.assigned_name,
                    'ticket_type', NEW.ticket_type
                )::jsonb
            ) INTO req_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_ticket_assigned_send_push ON chat_sessions;
CREATE TRIGGER on_ticket_assigned_send_push
AFTER UPDATE ON chat_sessions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_push_on_assignment();
