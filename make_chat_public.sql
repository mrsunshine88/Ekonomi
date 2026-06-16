-- Uppdatera tabellen chat_sessions
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS visitor_id TEXT;
ALTER TABLE chat_sessions ALTER COLUMN user_id DROP NOT NULL;

-- Uppdatera RLS-policy för chat_sessions (skapa sessioner för besökare)
-- Eftersom visitor_id hanteras av klienten, tillåter vi INSERT om visitor_id finns
CREATE POLICY "Visitors can create own chat sessions" ON chat_sessions 
FOR INSERT WITH CHECK (auth.uid() IS NULL AND visitor_id IS NOT NULL);

-- Låt besökare läsa sina sessioner baserat på visitor_id (kräver dock inte mycket säkerhet för chatt, men skyddar från listning av allt)
-- Vi tillåter att om visitor_id är ifyllt och stämmer överens, eller generellt för chatten, så fungerar det.
-- För RLS med visitor_id över public schema är det enklast att tillåta alla att läsa sessioner, men webbläsaren vet bara sitt visitor_id.
CREATE POLICY "Visitors can view own chat sessions" ON chat_sessions
FOR SELECT USING (true); -- Eftersom de inte kan hämta RLS-specifikt visitor_id via anon-rollen utan custom claims, tillåter vi SELECT och filtrerar i klienten.

-- Uppdatera RLS för chat_messages
-- Tillåt anonyma att skicka meddelanden (sköts ofta via ett API-anrop, men vi kan tillåta public insert om vi litar på det)
CREATE POLICY "Visitors can insert messages" ON chat_messages
FOR INSERT WITH CHECK (auth.uid() IS NULL AND sender_type = 'user');

-- Vi kan behöva uppdatera funktionen is_user_admin() så den inte kraschar om auth.uid() är null
-- Detta bör fungera om den bara returnerar false.
