-- Fixa synk-funktionen så att chatten hålls öppen även under cooldown
CREATE OR REPLACE FUNCTION sync_chat_open_from_agents()
RETURNS TRIGGER AS $$
DECLARE
  active_count INT;
BEGIN
  SELECT COUNT(*) INTO active_count
  FROM agent_sessions
  WHERE status IN ('available', 'busy', 'cooldown');

  INSERT INTO global_settings (key, value)
  VALUES ('chat_open', CASE WHEN active_count > 0 THEN 'true' ELSE 'false' END)
  ON CONFLICT (key) DO UPDATE
    SET value = CASE WHEN active_count > 0 THEN 'true' ELSE 'false' END;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
