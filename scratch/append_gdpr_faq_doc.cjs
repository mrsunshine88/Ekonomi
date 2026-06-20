const fs = require('fs');
const path = require('path');

const docPath = path.join(__dirname, '..', 'SYSTEM_DOKUMENTATION.md');
let content = '';
if (fs.existsSync(docPath)) {
  content = fs.readFileSync(docPath, 'utf8');
}

const faqDocs = `
## Enterprise-nivå Transparens och FAQ

### Vad
För att inge förtroende och möta kraven hos en modern SaaS-plattform är GDPR- och sekretessinformationen även integrerad direkt i appens "Frågor & Svar"-sektion (InfoModal). Användaren kan där snabbt få svar på vanliga frågor om datasäkerhet.

### Hur
- **Row Level Security (RLS):** Under sektionen "🛡️ Integritet & GDPR" förklaras det tydligt att datan är skyddad med strikt Row Level Security, vilket innebär att endast användaren har åtkomst till informationen. Inte ens plattformens administratörer kan se privata ekonomiska uppgifter.
- **Permanent Radering:** Beskrivningen av kontoradering är slipad med Enterprise SaaS-terminologi. Den garanterar att konton raderas "permanent" och utplånas från "alla aktiva system" utan att kvarlämna någon "användarrelaterad information i systemet".
- Detta skapar en juridisk och psykologisk trygghet utan onödiga överdrifter.
`;

fs.appendFileSync(docPath, faqDocs, 'utf8');
console.log('Appended GDPR FAQ documentation to SYSTEM_DOKUMENTATION.md');
