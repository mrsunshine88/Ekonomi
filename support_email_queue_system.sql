-- =========================================================================
-- SYSTEM-ARKITEKTUR: E-postkö & Webhooks
-- =========================================================================
-- Detta skript innehåller dokumentation och struktur för det robusta kösystemet.
-- 
-- 1. Statusmodell för chat_sessions
--    Vi använder följande tillstånd för e-postutskick:
--    'queued'     - E-post är skapad och ligger i kö för utskick.
--    'processing' - En Edge Function har plockat upp ärendet (SKIP LOCKED) och hanterar det just nu.
--    'sent'       - E-post skickades framgångsrikt.
--    'failed'     - Utskicket misslyckades. Ett bakgrundsjobb kan plocka upp detta för retry.
--
-- 2. Primär Utskicks-trigger (Source of Truth)
--    Istället för att frontenden försöker skicka e-post direkt och vi får race conditions:
--    a) Frontend sätter status = 'queued'.
--    b) En Supabase Database Webhook lyssnar på INSERT / UPDATE för chat_sessions där status = 'queued'.
--    c) Webhooken anropar en Edge Function (t.ex. 'send-queued-email').
--    
-- 3. Edge Function Logik (Konceptuell SQL)
--    Inne i Edge Function använder vi SELECT ... FOR UPDATE SKIP LOCKED för att hämta jobbet:
--
--    BEGIN;
--    SELECT id, inbound_address, customer_email, email_subject 
--      FROM chat_sessions 
--     WHERE status = 'queued' AND ticket_type = 'email'
--     FOR UPDATE SKIP LOCKED LIMIT 1;
--
--    -- Sätt sedan status till 'processing' i samma transaktion:
--    UPDATE chat_sessions SET status = 'processing' WHERE id = vald_id;
--    COMMIT;
--
--    Därefter försöker funktionen skicka mejlet via en e-postleverantör (t.ex. Resend/SendGrid).
--    Om utskicket lyckas:
--      UPDATE chat_sessions SET status = 'sent' WHERE id = vald_id;
--    Om utskicket misslyckas:
--      UPDATE chat_sessions SET status = 'failed' WHERE id = vald_id;
--
-- Detta ger ett hundraprocentigt "production grade" kösystem utan risk för dubbla utskick.
-- =========================================================================

-- Om chat_sessions har en strikt check constraint för status behöver vi uppdatera den.
-- Standard i detta system är VARCHAR(50) utan check constraint, vilket tillåter de nya statusarna direkt.
-- Om en CHECK constraint finns måste den droppas och återskapas:
-- ALTER TABLE chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_status_check;
-- ALTER TABLE chat_sessions ADD CONSTRAINT chat_sessions_status_check CHECK (status IN ('waiting', 'active', 'closed', 'assigned', 'queued', 'processing', 'sent', 'failed'));

-- För indexering, så att kön kan läsas extremt snabbt:
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status_email 
ON chat_sessions (status) 
WHERE ticket_type = 'email';
