const fs = require('fs');
const path = require('path');

const docPath = path.join(__dirname, '..', 'SYSTEM_DOKUMENTATION.md');
let content = fs.readFileSync(docPath, 'utf8');

const newSection = `
## 15. Bank-import & Minnesfunktion ("Botemedlet mot Tomt Konto-syndromet")

### Vad:
En premium-funktion som lÃ¥ter anvÃ¤ndaren ladda upp en rÃ¥ Excel/CSV-fil direkt frÃ¥n sin bank (t.ex. SEB, Swedbank, Handelsbanken). Appen lÃ¤ser filen, tvÃ¤ttar namnen och fÃ¶reslÃ¥r automatiskt vilka transaktioner som Ã¤r rÃ¤kningar och vilket konto de ska dras ifrÃ¥n. Appen bygger Ã¤ven upp ett minne ("machine learning-light") dÃ¤r den minns anvÃ¤ndarens val till nÃ¤sta mÃ¥nad.

### Hur:
Funktionen Ã¤r uppbyggd i tre skyddslager (fÃ¶r att hÃ¥lla databasen ren frÃ¥n skrÃ¤pdata):

1. **Ordlistan (SYSTEM-regler):**
   Vid initiering laddas databasen (\`household_import_rules\`) med standardregler fÃ¶r alla hushÃ¥ll (ex. "SPOTIFY", "NETFLIX", "TELIA").
2. **HushÃ¥llets Minne (USER-regler):**
   NÃ¤r anvÃ¤ndaren godkÃ¤nner en import sparas deras specifika val (t.ex. "ICA FÃ–RSÃ„KRING" -> Huvudkonto) i \`household_import_rules\` kopplat till deras \`household_id\`.
3. **MÃ¤nsklig Granskning (BankImportModal):**
   Ingenting skickas blint till databasen. Innan nÃ¥got sparas, gÃ¥r transaktionerna genom \`bankParser.ts\` som gÃ¶r fÃ¶ljande:
   - **Normalisering:** Tar bort skrÃ¤p-ord (" AB", " SVERIGE", " AUTOGIRO") fÃ¶r exakt string-matchning.
   - **Confidence Score:** BerÃ¤knar dynamiskt en procentuell sÃ¤kerhet pÃ¥ hur vÃ¤l bank-raden matchar en kÃ¤nd regel, baserat pÃ¥ likhet och \`usage_count\`.
   - **Sortering & UI:** De sÃ¤kraste trÃ¤ffarna sorteras hÃ¶gst upp i ett modalt grÃ¤nssnitt. Mindre troliga eller okÃ¤nda transaktioner lÃ¤ggs lÃ¤ngst ner dÃ¤r anvÃ¤ndaren mÃ¥ste klicka aktivt fÃ¶r att ta med dem.

**Databas (\`household_import_rules\`):**
- \`search_string\` (normaliserat namn, ex. "TELIA")
- \`target_account_id\` (fÃ¶reslaget konto)
- \`is_bill\` (bool)
- \`rule_type\` ('SYSTEM' eller 'USER')
- \`usage_count\` (Ã¶kar vid varje anvÃ¤ndning, hjÃ¤lper till att ranka regler hÃ¶gre)
- \`matched_examples\` (JSONB-array dÃ¤r rÃ¥a bank-texter som "TELIA SVERIGE AB" sparas fÃ¶r felsÃ¶kning)

### VarfÃ¶r:
Det absolut stÃ¶rsta hindret fÃ¶r att anvÃ¤nda en ekonomiapp Ã¤r "Tomt Konto-syndromet" â€“ den hÃ¶ga trÃ¶skeln att lÃ¤gga in 30 rÃ¤kningar manuellt. Genom att gÃ¶ra fÃ¶rsta onboarding-upplevelsen till "Ladda upp fil -> Granska -> Klart" minskar vi friktionen till noll. Att appen "blir smartare" skapar ocksÃ¥ en stark kÃ¤nsla av vÃ¤rde som bygger varumÃ¤rkeslojalitet. Vi undviker Ã¤ven tunga LLM/AI-modeller hÃ¤r, eftersom hÃ¥rdkodad normalisering och string-matchning lÃ¶ser 95% av problemet mycket snabbare och mer precist.

---
`;

if (!content.includes('Botemedlet mot Tomt Konto-syndromet')) {
  fs.writeFileSync(docPath, content + newSection);
  console.log("Updated SYSTEM_DOKUMENTATION.md");
} else {
  console.log("Section already exists");
}
