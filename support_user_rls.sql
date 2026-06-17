-- ============================================================
-- SUPPORT: RLS för kunder (inloggade & anonyma besökare)
-- Kör detta i Supabase SQL Editor
-- ============================================================

-- Tillåt alla (även anonyma) att skapa en chat_session
DROP POLICY IF EXISTS "Anyone can insert chat sessions" ON chat_sessions;
CREATE POLICY "Anyone can insert chat sessions" ON chat_sessions
  FOR INSERT WITH CHECK (
    (user_id = auth.uid()) OR (visitor_id IS NOT NULL)
  );

-- Tillåt kunder att se sin egen session
DROP POLICY IF EXISTS "Users can view own chat session" ON chat_sessions;
CREATE POLICY "Users can view own chat session" ON chat_sessions
  FOR SELECT USING (
    (user_id = auth.uid()) OR (visitor_id IS NOT NULL)
  );

-- Tillåt alla (även anonyma) att skicka meddelanden till en session de "äger"
DROP POLICY IF EXISTS "Anyone can insert messages to own session" ON chat_messages;
CREATE POLICY "Anyone can insert messages to own session" ON chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE id = chat_messages.session_id 
      AND (
        (user_id = auth.uid()) OR 
        (visitor_id IS NOT NULL)
      )
    )
    AND sender_type = 'user'
  );

-- Tillåt kunder att se meddelanden i sin egen session
DROP POLICY IF EXISTS "Users can view messages in own session" ON chat_messages;
CREATE POLICY "Users can view messages in own session" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE id = chat_messages.session_id 
      AND (
        (user_id = auth.uid()) OR 
        (visitor_id IS NOT NULL)
      )
    )
  );
