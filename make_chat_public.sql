-- Uppdatera tabellen chat_sessions
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS visitor_id TEXT;
ALTER TABLE chat_sessions ALTER COLUMN user_id DROP NOT NULL;

-- Städa upp gamla policies så scriptet kan köras flera gånger
DROP POLICY IF EXISTS "Visitors can create own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Visitors can view own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Visitors can update own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Visitors can insert messages" ON chat_messages;
DROP POLICY IF EXISTS "Visitors can view messages" ON chat_messages;

-- RLS chat_sessions
CREATE POLICY "Visitors can create own chat sessions" ON chat_sessions 
FOR INSERT WITH CHECK (auth.uid() IS NULL AND visitor_id IS NOT NULL);

CREATE POLICY "Visitors can view own chat sessions" ON chat_sessions
FOR SELECT USING (true);

CREATE POLICY "Visitors can update own chat sessions" ON chat_sessions
FOR UPDATE USING (auth.uid() IS NULL AND visitor_id IS NOT NULL);

-- RLS chat_messages
CREATE POLICY "Visitors can insert messages" ON chat_messages
FOR INSERT WITH CHECK (auth.uid() IS NULL AND sender_type = 'user');

CREATE POLICY "Visitors can view messages" ON chat_messages
FOR SELECT USING (true);

-- Lös "permission denied for function is_user_admin" för oinloggade (anon)
GRANT EXECUTE ON FUNCTION is_user_admin TO anon;
GRANT EXECUTE ON FUNCTION is_user_admin TO authenticated;

CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM system_admins WHERE user_id = auth.uid()
  ) INTO is_admin;
  RETURN is_admin;
END;
$$;
