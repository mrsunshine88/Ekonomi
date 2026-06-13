const fs = require('fs');
let content = fs.readFileSync('SYSTEM_DOKUMENTATION.md', 'utf8');

content += '\n\n## 2026-06-13 Enterprise Säkerhet & Onboarding\n\n' +
'- **Enterprise Admin-struktur:** Tabellen `system_admins` är nu ombyggd för högsta säkerhetsklassificering. Den använder `user_id` (UUID) som Primary Key med en Foreign Key-koppling direkt mot `auth.users(id)` och `ON DELETE CASCADE`. Detta innebär att om en admin raderar sitt konto utplånas deras admin-rättigheter omedelbart och permanent. Det förhindrar kontoövertagande ifall någon försöker registrera samma mejladress igen.\n\n' +
'- **Strikt E-postbekräftelse:** E-postbekräftelse är tvingande. Nyskapade konton hamnar i `auth.users` med `email_confirmed_at = null` och kan inte logga in. För att förhindra missbruk har vi även infört en databasfunktion `check_email_confirmed()` som blockerar återställning av lösenord för konton som inte har bekräftat sin e-postadress. Detta eliminerar alla bakdörrar.\n\n' +
'- **Självständig Onboarding:** Flödet för nya konton har städats upp. Tidigare dolda auto-skapanden av hushåll i `LoginScreen.tsx` har raderats. Nu hanterar `Onboarding.tsx` hela skapandet av hushållet på ett säkert sätt.\n\n' +
'- **Rätt Standardinställningar:** Vid nyskapade konton (via Onboarding) initieras `household_settings` nu med strikta standardvärden: endast `show_top_total` och `enable_management_buttons` är aktiverade, medan Swish- och överföringssammanställningar är dolda från start. Som kontrast förblir alla funktioner påslagna när man klickar "Prova Demo" för att maximera upplevelsen för besökare.\n';

fs.writeFileSync('SYSTEM_DOKUMENTATION.md', content, 'utf8');
console.log('Done!');
