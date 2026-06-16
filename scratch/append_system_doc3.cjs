const fs = require('fs');

const docs = `

---

## 28. UX Copywriting: Värdebaserad Försäljning i Prenumerationsrutan

### Vad:
Texterna i prenumerationsrutan (\`SubscriptionFeaturesModal.tsx\`) skrevs om för att fokusera på **känsla och resultat** snarare än rent tekniska funktioner.

### Hur:
- **"Mindre tjafs":** En ny punkt lades till (som nummer två i listan): *"Mindre ekonomiskt tjafs: Alla kostnader samlas på ett ställe och systemet räknar automatiskt ut vem som ska betala vad. Ingen behöver hålla reda på siffrorna manuellt."*
- **Avdramatisering av priset:** Lade till den kursiva undertexten *"Mindre än 2 kr per dag för hela hushållet"* precis under huvudpriset på 59 kr/månad.
- **Rensning av teknisk jargong:**
  - *"Äkta app-känsla (PWA)"* ändrades till det mer förståeliga *"Installera som app på mobilen"*.
  - *"EkonomiTB"* döptes om till det raka och självförklarande *"Statistik"*.
  - Buzzwords som *"vårt system analyserar er historik..."* (i felskrivningskontrollen) byttes till det mer trovärdiga *"systemet upptäcker ovanligt höga eller låga belopp"*.

### Varför:
Konverteringsoptimering (CRO). Målgruppen för appen letar i första hand efter en lösning på vardagsfriktion och irritation kring vem som betalat vad, inte efter komplexa algoritmer eller "PWA-teknik". Att bryta ner 59 kr/månad till "Mindre än 2 kr per dag" gör priset psykologiskt extremt lätt att acceptera. Sammantaget lyfter detta prenumerationsrutan från att vara en "utvecklar-featurelista" till en slipad försäljningspitch.
`;

fs.appendFileSync('SYSTEM_DOKUMENTATION.md', docs);
console.log('Documentation appended.');
