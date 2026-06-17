-- unclaim_chat_session RPC
CREATE OR REPLACE FUNCTION unclaim_chat_session(target_session_id UUID)
RETURNS void AS $$
BEGIN
  -- Lägg tillbaka ärendet i kön
  UPDATE chat_sessions
  SET assigned_to = NULL,
      assigned_name = NULL,
      status = 'waiting',
      updated_at = NOW()
  WHERE id = target_session_id AND assigned_to = auth.uid();

  -- Sätt agenten som 'available'
  UPDATE agent_sessions
  SET status = 'available', updated_at = NOW()
  WHERE agent_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
