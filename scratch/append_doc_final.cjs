const fs = require('fs');
const content = `

### 21.6 UX: Idiotsäker Inställningsvy (Lägg till Räkning / Konto)
För att minimera den kognitiva belastningen för användaren (särskilt helt nya hushåll) har de kritiska inställningsflödena för att lägga till nya räkningar och konton blivit ombyggda.

**Lägg till ny räkning:**
- Namnfält och dropdown (Vanliga räkningar) har slagits ihop till ett enklare gränssnitt visuellt.
- Avancerade inställningar (Varning för saknad, Lån/Skuld, Autogiro) är nu placerade i snygga, klickbara kort under rubriken "Smarta inställningar". Varje val aktiverar en tydlig färg och förklarande undertext.

**Lägg till nytt konto (Hushålls-setup):**
- Den förvirrande frågan "Hur tar kontot emot pengar? (Swish/Bank)" har helt avlägsnats.
- Istället visas ett 2-stegsflöde ("Vad vill du lägga till?").
- Genom att välja "Lägg till en Person (Hushållsmedlem)" förstår appen automatiskt att det handlar om person-till-person överföringar. Texten förklarar direkt varför valet finns: *👉 Detta krävs för att appen ska räkna ut om ni är skyldiga varandra pengar*.
- Genom att välja "Lägg till ett Gemensamt Bankkonto" förstår appen automatiskt att det är en pott/banköverföring. Förklaringen lyder: *👉 Detta krävs för att se hur mycket ni ska sätta in*.
- Detta gör det fullständigt intuitivt för nya användare att snabbt sätta upp den perfekta hushållsstrukturen (t.ex. Andreas -> Hus kontot, Helena -> Hus kontot, Andreas -> Helena).
`;
fs.appendFileSync('SYSTEM_DOKUMENTATION.md', content);
