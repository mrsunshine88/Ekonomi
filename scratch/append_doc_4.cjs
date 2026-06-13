const fs = require('fs');
const content = `

## 31. Förbättrad Användarupplevelse (UX/UI Uppdateringar)

### Vad
En omfattande upputsning av användargränssnittet i inställningarna och onboarding-flödet har genomförts. Fokus har legat på att göra det lättare att förstå funktioner utan att läsa långa manualer, samt att minska visuell "clutter" (rörighet).

### Varför
Tidigare kändes formulär och inställningar stela och otydliga (t.ex. dropdown-listor med långa beskrivande namn). Genom att använda moderna UI-mönster (steg-för-steg-guider, dolda fält tills de behövs, och visuella kort istället för select-boxar) sänks tröskeln för nya användare avsevärt.

### Hur
- **Visuell "Wow"-effekt vid Onboarding:** I slutet av onboarding-guiden visas nu en interaktiv sammanställning av hushållets valda standardräkningar. Totalbeloppet animeras från noll upp till slutsumman med hjälp av ett skräddarsytt \`CountUp\`-script (react-effekt) som höjer premium-känslan i applikationen.
- **Onboarding UUID Fix:** En bugg åtgärdades där Onboarding-guiden försökte spara kategorinamn (t.ex. "boende") i relations-databasen istället för det faktiska UUID:t för det Gemensamma Kontot. Koden \`useStore\` implementerades för att matcha rätt konto och skicka rätt \`accountId\`.
- **Smarta Formulär (Räkningar):** När man lägger till en ny räkning (i Hantera Räkningar) har fälten organiserats om:
  - En **rullgardin med "Vanliga räkningar..."** lades till bredvid inmatningsfältet för namn. Användaren kan snabbt välja t.ex. "El" så fylls textrutan i automatiskt.
  - Intervalls-knapparna ("Betalas varje månad" / "Välj månader") är nu **dolda** och visas enbart om användaren kryssar i rutan *"Varna med röd färg om jag glömmer fylla i denna"*.
  - Rutan för ursprunglig skuld/lån flyttades så den visas **direkt under** låne-kryssrutan, snarare än att ligga separerad i slutet av formuläret.
- **Skapa Konto UI-Overhaul:** Inställningarna för att lägga till nya konton/personer (under fliken Konton) byggdes om från rullgardiner till en 3-stegs guide ("1. Typ av konto", "2. Namn", "3. Hur tar kontot emot pengar?"). Layouten använder grid-baserade kort som klickas i, med mjuk och beskrivande text ("En person" vs "Ett gemensamt mål") istället för versaler och tekniska beskrivningar.
- **Rensning av Lås-vyn:** I inställningarna för "Lås upp månader/konton" togs de duplicerade knapparna för delade konton bort. Vyn visar nu istället en enda övergripande \`Total kostnad (Hela månaden) 🔒\`-knapp som låser upp hela månaden på ett klick, vilket speglar funktionaliteten i MonthView.
- **Förenklad Text:** Uttryck som *"Mottar pengar via Swish"* har bytts ut till det mer standardiserade *"Betalningsmetod: Swish"* för ett renare utseende.
`;
fs.appendFileSync('SYSTEM_DOKUMENTATION.md', content, 'utf-8');
