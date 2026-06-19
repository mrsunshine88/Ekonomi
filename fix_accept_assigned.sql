-- Uppdatera accept_assigned_chat_session så att den bara skickar välkomstmeddelande om det är en chatt.
CREATE OR REPLACE FUNCTION accept_assigned_chat_session(target_session_id UUID)
RETURNS chat_sessions AS $$
DECLARE
  v_session chat_sessions;
BEGIN
  -- Uppdatera ärendet BARA om det är tilldelat denna agent
  UPDATE chat_sessions
  SET status = 'active', updated_at = NOW()
  WHERE id = target_session_id 
    AND status = 'assigned' 
    AND assigned_to = auth.uid()
  RETURNING * INTO v_session;

  -- Om uppdateringen lyckades och det är en vanlig chatt, skicka välkomstmeddelande
  IF FOUND AND (v_session.ticket_type IS NULL OR v_session.ticket_type = 'chat') THEN
    INSERT INTO chat_messages (session_id, sender_type, message)
    VALUES (v_session.id, 'admin', 'Agenten är här, vad kan jag hjälpa dig med?');
  END IF;

  RETURN v_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
