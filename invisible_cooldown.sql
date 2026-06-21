-- Lägg till 'cooldown' som en tillåten status
ALTER TABLE agent_sessions DROP CONSTRAINT IF EXISTS agent_sessions_status_check;
ALTER TABLE agent_sessions ADD CONSTRAINT agent_sessions_status_check CHECK (status IN ('offline', 'available', 'busy', 'post_work', 'break', 'lunch', 'other_absence', 'cooldown'));

-- Uppdatera set_status så att vi manuellt kan skicka in 'cooldown' om det behövs
CREATE OR REPLACE FUNCTION agent_set_status(new_status TEXT)
RETURNS void AS $$
BEGIN
  IF new_status NOT IN ('available', 'post_work', 'break', 'lunch', 'other_absence', 'cooldown') THEN
    RAISE EXCEPTION 'Invalid status: %', new_status;
  END IF;

  UPDATE agent_sessions
  SET status = new_status, updated_at = NOW()
  WHERE agent_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
