-- ============================================================
-- UPPDATERING AV TRIGGER: Auto-synka chat_open och stäng chattar
-- ============================================================
CREATE OR REPLACE FUNCTION sync_chat_open_from_agents()
RETURNS TRIGGER AS $$
DECLARE
  active_count INT;
BEGIN
  SELECT COUNT(*) INTO active_count
  FROM agent_sessions
  WHERE status IN ('available', 'busy');

  INSERT INTO global_settings (key, value)
  VALUES ('chat_open', CASE WHEN active_count > 0 THEN 'true' ELSE 'false' END)
  ON CONFLICT (key) DO UPDATE
    SET value = CASE WHEN active_count > 0 THEN 'true' ELSE 'false' END;

  -- Om inga agenter är aktiva, stäng automatiskt alla pågående chatt-ärenden (ej e-post)
  IF active_count = 0 THEN
    UPDATE chat_sessions
    SET status = 'closed', updated_at = NOW()
    WHERE status IN ('waiting', 'assigned', 'active')
      AND (ticket_type = 'chat' OR ticket_type IS NULL);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
