-- 1. Ge besökare rätt att köra user_in_household så att trigger på chat_messages kan kolla profiles
GRANT EXECUTE ON FUNCTION public.user_in_household(uuid) TO anon;

-- 2. Uppdatera accept_assigned_chat_session så den tar in p_first_name
DROP FUNCTION IF EXISTS accept_assigned_chat_session(UUID);

CREATE OR REPLACE FUNCTION accept_assigned_chat_session(target_session_id UUID, p_first_name text DEFAULT 'kundtjänst')
RETURNS chat_sessions AS $$
DECLARE
  v_session chat_sessions;
  v_first_name text;
BEGIN
  -- Använd 'kundtjänst' om förnamnet är tomt
  IF p_first_name IS NULL OR p_first_name = '' THEN
    v_first_name := 'kundtjänst';
  ELSE
    v_first_name := p_first_name;
  END IF;

  -- Uppdatera ärendet BARA om det är tilldelat denna agent
  UPDATE chat_sessions
  SET status = 'active', updated_at = NOW()
  WHERE id = target_session_id 
    AND status = 'assigned' 
    AND assigned_to = auth.uid()
  RETURNING * INTO v_session;

  -- Om uppdateringen lyckades och det är en vanlig chatt, skicka AI-välkomstmeddelandet
  IF FOUND AND (v_session.ticket_type IS NULL OR v_session.ticket_type = 'chat') THEN
    INSERT INTO chat_messages (session_id, sender_type, message)
    VALUES (v_session.id, 'admin', '🤖 Du pratar med ' || v_first_name || ', vad kan jag hjälpa dig med?');
  END IF;

  RETURN v_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
