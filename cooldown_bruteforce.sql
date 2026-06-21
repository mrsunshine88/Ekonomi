-- ============================================================
-- COOLDOWN BRUTE-FORCE
-- Kör detta script i Supabase SQL Editor
-- Detta garanterar att cooldown_until alltid sätts och 
-- aggressivt blockerar alla försök att tilldela under cooldown.
-- ============================================================

-- 1. Tvinga release_chat_session att ALLTID sätta 20s cooldown
CREATE OR REPLACE FUNCTION public.release_chat_session(target_session_id UUID, next_status TEXT DEFAULT 'available')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Validera next_status
    IF next_status NOT IN ('available', 'post_work', 'break', 'lunch') THEN
        next_status := 'available';
    END IF;

    -- Stäng sessionen
    UPDATE chat_sessions
    SET status = 'closed', updated_at = NOW()
    WHERE id = target_session_id AND assigned_to = auth.uid();

    -- BRUTE FORCE: Sätt ALLTID cooldown till 20s in i framtiden oavsett status!
    -- Detta är idiotsäkert.
    UPDATE agent_sessions
    SET status = next_status, 
        updated_at = NOW(),
        cooldown_until = NOW() + INTERVAL '20 seconds'
    WHERE agent_id = auth.uid();
END;
$$;

-- 2. Tvinga system_auto_assign_ticket att stenhårt blockera framtida tider
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
    -- Om en specifik agent skickas in
    IF target_agent_id IS NOT NULL THEN
        -- BRUTE FORCE KONTROLL: Är cooldown in i framtiden? Då kastar vi ut den direkt!
        IF EXISTS (
            SELECT 1 FROM agent_sessions 
            WHERE agent_id = target_agent_id 
              AND cooldown_until > NOW()
        ) THEN
            RETURN; -- Agenten vilar, tilldela inget!
        END IF;

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

        -- Hitta äldsta väntande ärende som agenten har behörighet för
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

            INSERT INTO chat_messages (session_id, sender_type, message)
            VALUES (v_session_id, 'system', 'En agent har tagit över ärendet.');
        END IF;

    ELSE
        -- Ett NYTT ärende kom in i kön. Leta efter en ledig agent!
        FOR v_session_id, v_ticket_type IN 
            SELECT id, ticket_type FROM chat_sessions WHERE status = 'waiting' ORDER BY created_at ASC FOR UPDATE SKIP LOCKED
        LOOP
            -- Hitta en ledig agent som har behörighet, och INTE har någon aktiv cooldown (cooldown_until <= NOW eller NULL)
            SELECT a.agent_id, p.email INTO v_agent_id, v_agent_email
            FROM agent_sessions a
            JOIN profiles p ON a.agent_id = p.id
            WHERE a.status = 'available'
              AND (a.cooldown_until IS NULL OR a.cooldown_until <= NOW())
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

                INSERT INTO chat_messages (session_id, sender_type, message)
                VALUES (v_session_id, 'system', 'En agent har tagit över ärendet.');
            END IF;
        END LOOP;
    END IF;
END;
$$;
