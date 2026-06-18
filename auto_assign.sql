-- 1. Create RPC for accepting an assigned session
CREATE OR REPLACE FUNCTION accept_assigned_chat_session(target_session_id UUID)
RETURNS chat_sessions AS $$
DECLARE
  v_session chat_sessions;
BEGIN
  -- We update the session ONLY if it is assigned to this agent
  UPDATE chat_sessions
  SET status = 'active', updated_at = NOW()
  WHERE id = target_session_id 
    AND status = 'assigned' 
    AND assigned_to = auth.uid()
  RETURNING * INTO v_session;

  -- Insert automatic welcome message if successful
  IF FOUND THEN
    INSERT INTO chat_messages (session_id, sender_type, message)
    VALUES (v_session.id, 'admin', 'Agenten är här, vad kan jag hjälpa dig med?');
  END IF;

  RETURN v_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create RPC for auto-assigning the oldest session
CREATE OR REPLACE FUNCTION auto_assign_oldest_chat()
RETURNS chat_sessions AS $$
DECLARE
  v_session chat_sessions;
  v_my_status TEXT;
BEGIN
  -- Ensure caller is available
  SELECT status INTO v_my_status FROM agent_sessions WHERE agent_id = auth.uid();
  IF v_my_status != 'available' THEN
    RETURN NULL;
  END IF;

  UPDATE chat_sessions
  SET status = 'assigned', assigned_to = auth.uid(), assigned_name = (SELECT email FROM profiles WHERE id = auth.uid()), updated_at = NOW()
  WHERE id = (
    SELECT id FROM chat_sessions 
    WHERE status = 'waiting' 
    ORDER BY created_at ASC 
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO v_session;

  -- Ensure agent gets busy state
  IF FOUND THEN
    UPDATE agent_sessions SET status = 'busy', updated_at = NOW() WHERE agent_id = auth.uid();
  END IF;

  RETURN v_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
