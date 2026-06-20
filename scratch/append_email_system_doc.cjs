const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'SYSTEM_DOKUMENTATION.md');
let content = fs.readFileSync(filePath, 'utf-8');

const newSection = 

### 45.1 Utökad E-posthantering & Utskicks-kö (SaaS Arkitektur)
För att hantera e-postutskick från kundtjänst utan risk för race conditions eller dubbla utskick, används en asynkron kö-arkitektur där databasen agerar Source of Truth.

**1. Konfiguration:**
- Appen använder miljövariabler (\VITE_SUPPORT_EMAIL\ och \VITE_INFO_EMAIL\) definierade i \src/constants.ts\ för att säkert referera till avsändaradresser.

**2. Frontend (InfoModal & SupportView):**
- **InfoModal:** Kontaktsidan presenterar två tydliga sektioner (kort) för \support@\ (kunder/app-relaterat) och \info@\ (övrigt).
- **SupportView:** En knapp för "Nytt mejl" tillåter administratörer att initiera nya ärenden (\	icket_type = 'email'\) i \chat_sessions\.
- När ett mejl skapas får sessionen initialt status \queued\. Frontend anropar inte utskick-API:er direkt. Signatur (sparad i LocalStorage) bifogas automatiskt i meddelandet.

**3. Databas & Kö-modell (SKIP LOCKED):**
Statusmodellen för e-postärenden i \chat_sessions\ är utökad till:
- \open\ / \ctive\: Pågående hantering
- \queued\: Redo att skickas
- \processing\: Låst av worker/Edge Function
- \sent\: Slutfört
- \ailed\: Något gick fel, redo för retry

**4. Trigger-regel (Database Webhook -> Edge Function):**
- **Core System:** När en \chat_sessions\-post skapas eller uppdateras till \status = 'queued'\, triggas en Database Webhook i Supabase omedelbart.
- Webhooken anropar en Supabase Edge Function som använder \SELECT ... FOR UPDATE SKIP LOCKED\ för att hämta nästa mejl i kön. Posten sätts då till \processing\.
- Efter det faktiska utskicket via e.g. Resend, sätts status till \sent\ (eller \ailed\).
- Cron-jobb används *inte* som primär trigger (för att slippa fördröjning), utan kan agera som backup (retry-logik) för poster som fastnat i \ailed\.
;

content += newSection;
fs.writeFileSync(filePath, content, 'utf-8');
console.log('Dokumentationen uppdaterad!');
