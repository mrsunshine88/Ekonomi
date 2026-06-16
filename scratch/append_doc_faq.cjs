const fs = require('fs');
const path = require('path');

const docPath = path.join(__dirname, '..', 'SYSTEM_DOKUMENTATION.md');

const newContent = `

## 30. Clean SaaS Copy & Accordion FAQ (Uppdatering)

**Varför:** 
För att ta systemet från "Indie-projekt" till "Enterprise SaaS-nivå" behövde vi städa bort överdrivet säljande språk (så kallat "manual-språk" eller "fluff") och istället införa strikt, ärlig och kortfattad copy. Dessutom saknades en centraliserad plats för vanliga frågor som avlastar supporten och bygger förtroende.

**Vad som gjordes:**
1. **Uppdatering av terminologi i Statistik:** Vi raderade alla omnämnanden av "Swish" i \`Statistics.tsx\` och ersatte det med "överföringar från/till andra i hushållet". Detta knyter ihop appen logiskt oavsett vilken bankanvändaren har.
2. **Apple/Stripe-style FAQ:** Vi lade till en "Frågor & Svar (FAQ)"-knapp bredvid Användarvillkor i sidfoten (\`Footer.tsx\`).
3. **Accordion UI i InfoModal:** I \`InfoModal.tsx\` byggde vi en interaktiv "dragspels"-meny (Accordion) där frågorna listas och svaren fälls ner med en mjuk \`max-height\` transition när man klickar på dem. Detta sparar plats och undviker "textväggar" på mobilen.
4. **Support-säker Copy:** Svaren är skrivna för att vara 1-2 rader, hyper-konkreta och exakta. Exempelvis lovar vi inte längre att man kan "klicka här för att avsluta prenumerationen", utan vi anger ärligt att man måste navigera via Mina Sidor för att omdirigeras till Stripe där uppsägningen sker. Prismodellen presenteras som "Mindre än 2 kr per dag för hela hushållet" för att maximera konvertering.
`;

fs.appendFileSync(docPath, newContent, 'utf8');
console.log('Successfully appended FAQ chapter to SYSTEM_DOKUMENTATION.md');
