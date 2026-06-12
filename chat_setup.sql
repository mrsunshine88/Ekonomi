-- 1. Skapa tabell för Chat Sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'waiting', -- 'waiting', 'active', 'closed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Skapa tabell för Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender_type VARCHAR(50) NOT NULL, -- 'user' eller 'admin'
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Slå på Realtime för tabellerna
ALTER PUBLICATION supabase_realtime ADD TABLE chat_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE global_settings;

-- 4. RLS - Row Level Security för chat_sessions
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Vanliga användare får läsa och skapa sina egna chattar
CREATE POLICY "Users can view own chat sessions" ON chat_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own chat sessions" ON chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chat sessions" ON chat_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Admins får läsa och uppdatera allas chattar
CREATE POLICY "Admins can view all chat sessions" ON chat_sessions FOR SELECT USING (is_user_admin());
CREATE POLICY "Admins can update all chat sessions" ON chat_sessions FOR UPDATE USING (is_user_admin());

-- 5. RLS - Row Level Security för chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Vanliga användare får läsa och skriva meddelanden i sina egna sessioner
CREATE POLICY "Users can view messages in own sessions" ON chat_messages FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM chat_sessions WHERE id = session_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert messages in own sessions" ON chat_messages FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_sessions WHERE id = session_id AND user_id = auth.uid()
  )
  AND sender_type = 'user'
);

-- Admins får läsa och skriva meddelanden i alla sessioner
CREATE POLICY "Admins can view all messages" ON chat_messages FOR SELECT USING (is_user_admin());
CREATE POLICY "Admins can insert all messages" ON chat_messages FOR INSERT WITH CHECK (is_user_admin() AND sender_type = 'admin');

-- 6. Trigger för att uppdatera 'updated_at' på chat_sessions när ett nytt meddelande skickas
CREATE OR REPLACE FUNCTION update_chat_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_sessions SET updated_at = NOW() WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_chat_message ON chat_messages;
CREATE TRIGGER on_new_chat_message
AFTER INSERT ON chat_messages
FOR EACH ROW EXECUTE PROCEDURE update_chat_session_timestamp();

-- 7. Default värde för chat_open i global_settings
INSERT INTO global_settings (key, value) VALUES ('chat_open', 'false') ON CONFLICT DO NOTHING;
