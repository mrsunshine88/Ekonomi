const fs = require('fs');
const path = require('path');

const docPath = path.join('c:\\Users\\perss\\Desktop\\Ekonomiapp', 'SYSTEM_DOKUMENTATION.md');
let content = fs.readFileSync(docPath, 'utf8');

const newContent = `

## 33. Säkerhetsspärrar (Hard Gates) i App.tsx
### Vad
Ersatte villkorlig rendering av modals med stenhårda "early returns" för Användarvillkor (TOS), Onboarding och Paywall i rotkomponenten.

### Varför
För att garantera att ingen obehörig kommer åt plattformens underliggande vyer och kod utan att ha en "nyckel" (godkänt TOS) och betalat. Tidigare renderades appen i bakgrunden, och Onboarding kunde överlappa TOS-rutan, vilket förvirrade användare.

### Hur
I \`App.tsx\` avbryts nu hela renderingen om användaren inte passerat ett steg. Om kraven inte uppfylls monteras inte \`MonthView\`, Header eller andra delar av applikationen överhuvudtaget. Appen laddas sekventiellt (TOS -> Onboarding -> Paywall).

## 34. Nya Standardinställningar (Clean Slate)
### Vad
Ändrade standardbeteendet för nya konton så att överförings- och Swish-sammanställningar är dolda initialt. Endast Hanteringsknappar och Gemensam Totalsumma är aktivt från start.

### Varför
För att ge en ren och enkel förstagångsupplevelse. Användare kan själva välja att "slå på" de mer avancerade uträkningarna när de känner sig redo.

### Hur
Ändrade logiken i \`Summary.tsx\` och \`ManageBills.tsx\` så att \`showTransferSummary\` och \`showSwishSummary\` utvärderas med \`=== true\` (kräver aktiv inblandning) istället för \`!== false\`.

## 35. Utökad Demodata för EkonomiTB
### Vad
Maxade Demo-läget med 12 realistiska räkningar och tre månaders inbakad historik.

### Varför
För att användare omedelbart ska få uppleva hela kraften i appen, framförallt insikterna i EkonomiTB. Utan historik visade graferna noll i trend och instabilitet.

### Hur
I \`store.ts\` utökades \`mockBills\` och \`mockState.months\` förseddes med en extra månad (\`prevPrevMonth\`) med medvetna prisskillnader (t.ex. dyrare el och drivmedel) för att generera realistiska datatrender (+20 kr i diff). Ändrade även vem som initialt betalade det stora Matkontot för att generera en realistisk, hög Swish-skuld.
`;

fs.writeFileSync(docPath, content + newContent, 'utf8');
