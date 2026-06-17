-- ============================================================
-- SUPPORT SETUP: Kundservice-kösystem
-- Kör detta i Supabase SQL Editor
-- ============================================================

-- 1. Lägg till chat_agent-flagga på profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chat_agent BOOLEAN DEFAULT false;

-- 2. Lägg till assigned_to + assigned_name på chat_sessions
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_name TEXT;

-- 3. Tillåt visitor_id på chat_sessions (om ej finns)
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS visitor_id TEXT;

-- 4. Ny tabell: agent_sessions
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'offline' CHECK (status IN ('offline', 'available', 'busy')),
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (agent_id)
);

-- Realtime på agent_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE agent_sessions;

-- RLS på agent_sessions
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

-- Agenter och admins kan se alla agent_sessions (för närvaro-UI)
CREATE POLICY "Chat agents can view agent sessions" ON agent_sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (chat_agent = true OR is_user_admin()))
  );

CREATE POLICY "Agents can manage own session" ON agent_sessions
  FOR ALL USING (agent_id = auth.uid());

-- 5. RLS: chat_agent-användare får läsa alla chat_sessions (som admin)
CREATE POLICY "Chat agents can view all chat sessions" ON chat_sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND chat_agent = true)
  );

CREATE POLICY "Chat agents can update all chat sessions" ON chat_sessions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND chat_agent = true)
  );

-- 6. RLS: chat_agent-användare får skriva meddelanden som 'admin'
CREATE POLICY "Chat agents can view all messages" ON chat_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND chat_agent = true)
  );

CREATE POLICY "Chat agents can insert messages" ON chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND chat_agent = true)
    AND sender_type = 'admin'
  );

-- ============================================================
-- 7. TRIGGER: Auto-synka chat_open baserat på aktiva agenter
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

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_agent_status_change ON agent_sessions;
CREATE TRIGGER on_agent_status_change
AFTER INSERT OR UPDATE OR DELETE ON agent_sessions
FOR EACH ROW EXECUTE FUNCTION sync_chat_open_from_agents();

-- ============================================================
-- 8. RPC: agent_connect – koppla upp agent
-- ============================================================
CREATE OR REPLACE FUNCTION agent_connect()
RETURNS void AS $$
BEGIN
  -- Kontrollera att användaren är chat_agent
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (chat_agent = true OR is_user_admin())) THEN
    RAISE EXCEPTION 'Not authorized as chat agent';
  END IF;

  INSERT INTO agent_sessions (agent_id, status, connected_at, updated_at)
  VALUES (auth.uid(), 'available', NOW(), NOW())
  ON CONFLICT (agent_id) DO UPDATE
    SET status = 'available', updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. RPC: agent_disconnect – koppla från agent
-- ============================================================
CREATE OR REPLACE FUNCTION agent_disconnect()
RETURNS void AS $$
BEGIN
  UPDATE agent_sessions
  SET status = 'offline', updated_at = NOW()
  WHERE agent_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 10. RPC: claim_chat_session – atomisk tagning av ärende
-- ============================================================
CREATE OR REPLACE FUNCTION claim_chat_session(target_session_id UUID)
RETURNS TEXT AS $$
DECLARE
  agent_email TEXT;
  rows_updated INT;
BEGIN
  -- Hämta agentens e-post för assigned_name
  SELECT email INTO agent_email FROM profiles WHERE id = auth.uid();

  -- Atomisk UPDATE: tar bara ärendet om assigned_to IS NULL
  UPDATE chat_sessions
  SET
    assigned_to   = auth.uid(),
    assigned_name = agent_email,
    status        = 'active',
    updated_at    = NOW()
  WHERE id = target_session_id
    AND (assigned_to IS NULL OR assigned_to = auth.uid());

  GET DIAGNOSTICS rows_updated = ROW_COUNT;

  IF rows_updated = 0 THEN
    RETURN 'already_taken';
  END IF;

  -- Sätt agenten som 'busy'
  UPDATE agent_sessions
  SET status = 'busy', updated_at = NOW()
  WHERE agent_id = auth.uid();

  RETURN 'ok';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 11. RPC: release_chat_session – stäng ärende → agent ledig
-- ============================================================
CREATE OR REPLACE FUNCTION release_chat_session(target_session_id UUID)
RETURNS void AS $$
BEGIN
  -- Stäng sessionen
  UPDATE chat_sessions
  SET status = 'closed', updated_at = NOW()
  WHERE id = target_session_id AND assigned_to = auth.uid();

  -- Sätt agenten tillbaka till 'available'
  UPDATE agent_sessions
  SET status = 'available', updated_at = NOW()
  WHERE agent_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 12. RPC: toggle_chat_agent – admin aktiverar/avaktiverar agent
-- ============================================================
CREATE OR REPLACE FUNCTION toggle_chat_agent(target_email TEXT, enable BOOLEAN)
RETURNS TEXT AS $$
BEGIN
  IF NOT is_user_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  UPDATE profiles
  SET chat_agent = enable
  WHERE email = target_email;

  IF NOT FOUND THEN
    RETURN 'User not found';
  END IF;

  RETURN 'ok';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 13. Uppdatera admin_get_all_users för att returnera chat_agent
-- ============================================================
-- OBS: Kör bara detta om din befintliga funktion inte redan returnerar chat_agent.
-- Kontrollera befintlig funktion i Supabase och lägg till chat_agent i SELECT.
