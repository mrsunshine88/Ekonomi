-- 1. Lägg till cooldown_until i agent_sessions
ALTER TABLE public.agent_sessions ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMP WITH TIME ZONE;

-- 2. Uppdatera system_auto_assign_ticket för att respektera cooldown_until
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
        -- Kontrollera att agenten fortfarande är ledig och att cooldown har gått ut
        IF NOT EXISTS (
            SELECT 1 FROM agent_sessions 
            WHERE agent_id = target_agent_id 
              AND status = 'available' 
              AND (cooldown_until IS NULL OR cooldown_until <= NOW())
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
            -- Hitta en ledig agent som har behörighet, ingen cooldown, och har väntat längst
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

                -- Skicka systemmeddelande om tilldelning
                INSERT INTO chat_messages (session_id, sender_type, message)
                VALUES (v_session_id, 'system', 'En agent har tagit över ärendet.');
            END IF;
        END LOOP;
    END IF;
END;
$$;
