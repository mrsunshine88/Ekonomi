-- ============================================================
-- UPDATE: Nya agent-statusar (Efterarbete, Rast, Lunch)
-- Kör detta i Supabase SQL Editor
-- ============================================================

-- 1. Ta bort den gamla CHECK-constrainten och lägg till en ny
--    med de utökade statusarna
ALTER TABLE agent_sessions DROP CONSTRAINT IF EXISTS agent_sessions_status_check;
ALTER TABLE agent_sessions ADD CONSTRAINT agent_sessions_status_check
  CHECK (status IN ('offline', 'available', 'busy', 'post_work', 'break', 'lunch'));

-- 2. Uppdatera sync_chat_open_from_agents() – chatten ska vara
--    öppen om minst en agent är available, busy eller post_work.
--    Rast och Lunch = inte tillgänglig.
CREATE OR REPLACE FUNCTION sync_chat_open_from_agents()
RETURNS TRIGGER AS $$
DECLARE
  active_count INT;
BEGIN
  SELECT COUNT(*) INTO active_count
  FROM agent_sessions
  WHERE status IN ('available', 'busy', 'post_work');

  INSERT INTO global_settings (key, value)
  VALUES ('chat_open', CASE WHEN active_count > 0 THEN 'true' ELSE 'false' END)
  ON CONFLICT (key) DO UPDATE
    SET value = CASE WHEN active_count > 0 THEN 'true' ELSE 'false' END;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ny RPC: agent_set_status – låter agenten byta status fritt
CREATE OR REPLACE FUNCTION agent_set_status(new_status TEXT)
RETURNS void AS $$
BEGIN
  IF new_status NOT IN ('available', 'post_work', 'break', 'lunch') THEN
    RAISE EXCEPTION 'Invalid status: %', new_status;
  END IF;

  UPDATE agent_sessions
  SET status = new_status, updated_at = NOW()
  WHERE agent_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Uppdatera release_chat_session() med valfri nästa status
CREATE OR REPLACE FUNCTION release_chat_session(target_session_id UUID, next_status TEXT DEFAULT 'available')
RETURNS void AS $$
BEGIN
  -- Validera next_status
  IF next_status NOT IN ('available', 'post_work', 'break', 'lunch') THEN
    next_status := 'available';
  END IF;

  -- Stäng sessionen
  UPDATE chat_sessions
  SET status = 'closed', updated_at = NOW()
  WHERE id = target_session_id AND assigned_to = auth.uid();

  -- Sätt agenten till vald status
  UPDATE agent_sessions
  SET status = next_status, updated_at = NOW()
  WHERE agent_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
