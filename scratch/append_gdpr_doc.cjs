const fs = require('fs');
const path = require('path');

const docPath = path.join(__dirname, '..', 'SYSTEM_DOKUMENTATION.md');
let content = '';
if (fs.existsSync(docPath)) {
  content = fs.readFileSync(docPath, 'utf8');
}

const gdprDocs = `
## GDPR och Data-livscykel (Continuous Constraint Enforcement)

### Vad
För att säkerställa 100% efterlevnad av GDPR (särskilt rätten till radering) använder systemet en kombination av databasens inbyggda \\\`ON DELETE CASCADE\\\`-regler och ett kontinuerligt övervakningsskript (\\\`scripts/db_health_check.js\\\`). Användare kan även ladda ner all sin rådata via knappen "Exportera all min data (Excel)" på Mina Sidor.

### Hur
- **Dataportabilitet (Export):** Koden i \\\`src/excel.ts\\\` sammanställer data från \\\`profiles\\\`, \\\`push_subscriptions\\\`, \\\`agent_sessions\\\`, \\\`chat_sessions\\\`, LocalStorage, samt all finansiell data till en enskild Excel-fil med flera flikar.
- **Rätt att bli glömd (Delete Account):** Funktionen \\\`delete_user()\\\` tar bort identiteten från \\\`auth.users\\\`. Sedan förlitar vi oss på PostgreSQL kaskad-radering för att utplåna all tillhörande data i andra tabeller.
- **Continuous Constraint Monitoring:** Ett Node.js-skript (\\\`db_health_check.js\\\`) validerar databasens \\\`pg_constraint\\\` tabell. Det säkerställer att ingen utvecklare någonsin skapar en foreign key mot \\\`auth.users\\\` eller \\\`profiles\\\` utan att lägga till \\\`ON DELETE CASCADE\\\` (eller explicit \\\`SET NULL\\\`). Ett externt SQL-skript (\\\`gdpr_audit.sql\\\`) förser systemet med en databasfunktion \\\`check_gdpr_cascades()\\\` för att möjliggöra detta.
- **UI-Transparens:** En informationsruta i "Farlig zon" förklarar för användaren exakt vad export- och raderingsfunktionerna innebär i kontext av GDPR.

### Varför
- **Underhåll och Bugg-minimering:** Att manuellt ange \\\`DELETE FROM...\\\` för varje nyskapad tabell introducerar hög risk för "kvarlämnad" data. Genom att förlita oss på databasens motor (\\\`CASCADE\\\`) är raderingen omedelbar, konsekvent och atomisk.
- **Säkerställande av korrekta scheman:** Övervakningsskriptet eliminerar risken att framtida uppdateringar till databasschemat bryter mot GDPR-kraven.
`;

fs.appendFileSync(docPath, gdprDocs, 'utf8');
console.log('Appended GDPR documentation to SYSTEM_DOKUMENTATION.md');
