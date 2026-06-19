DROP FUNCTION IF EXISTS public.auto_assign_oldest_chat();

CREATE OR REPLACE FUNCTION auto_assign_oldest_chat()
RETURNS chat_sessions AS $$
DECLARE
  v_session chat_sessions;
  v_my_status TEXT;
  v_can_chat BOOLEAN;
  v_can_email BOOLEAN;
BEGIN
  -- Ensure caller is available
  SELECT status INTO v_my_status FROM agent_sessions WHERE agent_id = auth.uid();
  IF v_my_status != 'available' THEN
    RETURN NULL;
  END IF;

  -- Kolla att agenten finns och vad den får hantera
  SELECT handles_chat, handles_email INTO v_can_chat, v_can_email
  FROM profiles WHERE id = auth.uid() AND chat_agent = true;

  IF v_can_chat IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE chat_sessions
  SET status = 'assigned', assigned_to = auth.uid(), assigned_name = (SELECT email FROM profiles WHERE id = auth.uid()), updated_at = NOW()
  WHERE id = (
    SELECT id FROM chat_sessions 
    WHERE status = 'waiting' 
      AND (
          (v_can_chat = true AND (ticket_type = 'chat' OR ticket_type IS NULL))
          OR 
          (v_can_email = true AND ticket_type = 'email')
      )
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

ALTER FUNCTION public.auto_assign_oldest_chat() SET search_path = public;
GRANT EXECUTE ON FUNCTION public.auto_assign_oldest_chat() TO authenticated;
