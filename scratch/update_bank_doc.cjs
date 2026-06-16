const fs = require('fs');
const path = require('path');

const docPath = path.join(__dirname, '..', 'SYSTEM_DOKUMENTATION.md');
let content = fs.readFileSync(docPath, 'utf8');

const updatedSection = `## 15. Bank-import & Minnesfunktion ("Botemedlet mot Tomt Konto-syndromet")

### Vad:
En premium-funktion som låter användaren ladda upp en bankfil (t.ex. SEB, Swedbank, Länsförsäkringar) i form av Excel/CSV. Appen läser filen och upptäcker automatiskt både **Utgifter (Räkningar)** och **Inkomster (Lön/Utbetalningar)**. Den lär sig dessutom av användarens val och bygger upp ett smart minne.

### Hur:
Funktionen är uppbyggd i tre skyddslager för hög datakvalitet:

1. **Ordlistan (SYSTEM-regler):**
   Vid initiering laddas databasen (\`household_import_rules\`) med standardregler.
2. **Hushållets Minne (USER-regler):**
   När användaren importerar och gör egna val (t.ex. "FORTNOX AB" -> Inkomst för Andreas) sparas detta.
3. **Mänsklig Granskning (BankImportModal):**
   Parsern (\`bankParser.ts\`) tvättar datan och delar upp raderna i Inkomster (positiva saldon) och Utgifter (negativa saldon). Med hjälp av en *Confidence Score* sorteras de bästa förslagen överst i modalen. Lön tilldelas en *Användare*, medan Räkningar tilldelas ett *Konto*.

**Databas (\`household_import_rules\`):**
För att hantera både inkomster och utgifter utan att blanda ID:n används en flexibel pekar-struktur:
- \`is_bill\` (bool): True = utgift, False = inkomst.
- \`rule_target_type\` (string): 'ACCOUNT' (för konton) eller 'USER' (för personer i hushållet).
- \`target_id\` (uuid): Pekar på rätt enhet beroende på \`rule_target_type\`.

### Varför:
Det absolut största hindret för att använda en ekonomiapp är "Tomt Konto-syndromet" – den höga tröskeln att lägga in 30 räkningar manuellt. Genom att automatiskt sortera in både löner och räkningar via en enkel bank-import reduceras friktionen till noll. Systemet framstår som "magiskt", vilket bygger enormt förtroende och lojalitet utan att vi behöver använda tunga eller oberäkneliga LLM-modeller.

---
`;

// Ersätt gamla sektionen
const startIndex = content.indexOf('## 15. Bank-import');
if (startIndex !== -1) {
  content = content.substring(0, startIndex) + updatedSection;
  fs.writeFileSync(docPath, content, 'utf8');
  console.log("Updated SYSTEM_DOKUMENTATION.md with new bank import details.");
} else {
  console.log("Section not found.");
}
