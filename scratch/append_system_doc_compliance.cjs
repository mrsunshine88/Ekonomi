const fs = require('fs');
const path = require('path');

const docPath = path.join(__dirname, '../SYSTEM_DOKUMENTATION.md');

const contentToAppend = `

### SEO, UI-Finputsning & Legal Compliance (Stripe & GDPR)

#### SEO & Sökordsoptimering
- **Sitemap & Robots:** Har lagts till i \`public/\` mappen (\`sitemap.xml\` och \`robots.txt\`) för att säkerställa att Google indexerar hela sajten och kan navigera den effektivt.
- **FAQ Structured Data (JSON-LD):** En dold \`<script type="application/ld+json">\` har lagts till i \`index.html\` <head> tagg. Detta definierar en "FAQPage" enligt Schema.org vilket ger Google möjlighet att visa frågor och svar direkt i sökresultaten ("Utökat resultat").

#### Inloggning & Demoläge UI
- **Renare Inloggningsvy:** Tydligare fokus på "Testa fritt i 14 dagar". Texterna har städats upp och primära actions pekar direkt till "Starta provperiod". Ordet "gratis" har tagits bort från knapparna.
- **Tydligare Demo-Banner:** I demoläget har uppmaningen till att skapa konto förtydligats. Den tidigare röriga layouten med två lila element har förenklats så att informationstexten är ren text och den faktiska Call-to-Action knappen för att starta provperiod sticker ut ordentligt.

#### Stripe & GDPR-Compliance (Användarvillkor & Integritetspolicy)
För att klara Stripes granskning och uppfylla GDPR har juridiska policys i sidfoten (\`InfoModal.tsx\`) byggts ut med kompletta texter:
- **Användarvillkor (TOS):**
  - **Ansvarsfriskrivning:** Specifik ansvarsbegränsning att appen är ett kompletterande hjälpmedel och ingen finansiell rådgivning. Företaget hålls skadelöst från ekonomiska beslut baserade på appens data.
  - **Uppsägning:** En exakt beskrivning för hur användaren avslutar tjänsten via "Mina Sidor -> Premium -> Hantera Prenumeration" (som öppnar Stripe Portal).
  - **Återbetalningar:** Tydligt villkor om att inga återbetalningar görs för delvis utnyttjade månader.
- **Integritetspolicy (Privacy Policy):**
  - **Dynamisk Personuppgiftsansvarig:** Hämtar automatiskt företagsnamn och e-postadress från inställningar i databasen via \`global_settings\`.
  - **Tredjepart & GDPR-Rättigheter:** Klargör att Stripe hanterar all betaldata (vi sparar inte kort), rätten till radering (SQL Cascade), samt rätten att klaga till IMY.
`;

try {
  fs.appendFileSync(docPath, contentToAppend, 'utf8');
  console.log('Successfully appended legal and UI updates to SYSTEM_DOKUMENTATION.md');
} catch (error) {
  console.error('Error appending to system documentation:', error);
}
