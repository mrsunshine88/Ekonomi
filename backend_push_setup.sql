-- ==========================================
-- ÄKTA BAKGRUNDS-TILLDELNING OCH PUSH
-- ==========================================

-- 0. Helper-funktion för att släppa ett ärende och sätta agent i status
CREATE OR REPLACE FUNCTION public.release_chat_session(target_session_id UUID, next_status TEXT DEFAULT 'available')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Validera next_status
    IF next_status NOT IN ('available', 'post_work', 'break', 'lunch', 'cooldown') THEN
        next_status := 'available';
    END IF;

    -- Stäng sessionen
    UPDATE chat_sessions
    SET status = 'closed', updated_at = NOW()
    WHERE id = target_session_id AND assigned_to = auth.uid();

    -- Sätt agenten till nästa status (tex 'cooldown')
    UPDATE agent_sessions
    SET status = next_status, 
        updated_at = NOW()
    WHERE agent_id = auth.uid();
END;
$$;

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
        -- Annars kolla om agenten är ledig
        IF NOT EXISTS (
            SELECT 1 FROM agent_sessions 
            WHERE agent_id = target_agent_id 
              AND status = 'available'
        ) THEN
            RETURN;
        END IF;

        -- Hämta agentens e-post
        SELECT email INTO v_agent_email FROM profiles WHERE id = target_agent_id;

        -- Hitta äldsta väntande ärende som agenten har behörighet för (Lås raden så inga krockar sker)
        SELECT id, ticket_type INTO v_session_id, v_ticket_type
        FROM chat_sessions
        WHERE status = 'waiting'
          AND (
              (ticket_type = 'chat' AND EXISTS (SELECT 1 FROM profiles WHERE id = target_agent_id AND COALESCE(handles_chat, true) = true))
              OR
              (ticket_type = 'email' AND EXISTS (SELECT 1 FROM profiles WHERE id = target_agent_id AND COALESCE(handles_email, false) = true))
          )
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1;

        IF v_session_id IS NOT NULL THEN
            UPDATE chat_sessions 
            SET status = 'assigned', assigned_to = target_agent_id, assigned_name = v_agent_email
            WHERE id = v_session_id;
            
            UPDATE agent_sessions
            SET status = 'busy', cooldown_until = NULL
            WHERE agent_id = target_agent_id;

            -- Skicka systemmeddelande om tilldelning
            INSERT INTO chat_messages (session_id, sender_type, message)
            VALUES (v_session_id, 'system', 'En agent har tagit över ärendet.');
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
                  (v_ticket_type = 'chat' AND COALESCE(p.handles_chat, true) = true)
                  OR
                  (v_ticket_type = 'email' AND COALESCE(p.handles_email, false) = true)
              )
            ORDER BY a.updated_at ASC
            FOR UPDATE OF a SKIP LOCKED
            LIMIT 1;

            IF v_agent_id IS NOT NULL THEN
                UPDATE chat_sessions 
                SET status = 'assigned', assigned_to = v_agent_id, assigned_name = v_agent_email
                WHERE id = v_session_id;
                
                UPDATE agent_sessions
                SET status = 'busy', cooldown_until = NULL
                WHERE agent_id = v_agent_id;

                -- Skicka systemmeddelande om tilldelning
                INSERT INTO chat_messages (session_id, sender_type, message)
                VALUES (v_session_id, 'system', 'En agent har tagit över ärendet.');
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

-- 4. BORTTAGET: Trigger Webhook för Push-notis
-- (Eftersom pg_net visade sig vara instabilt, triggas detta nu direkt från den aktiva agentens webbläsare istället)
DROP TRIGGER IF EXISTS on_ticket_assigned_send_push ON chat_sessions;
DROP FUNCTION IF EXISTS public.trigger_push_on_assignment();
