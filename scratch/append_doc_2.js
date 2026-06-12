const fs = require('fs');
const content = `
## 30. Anpassningsbara Vyer & Inställningar (Ny Uppdatering)

### Vad
Den senaste uppdateringen fokuserar på att ge användarna full kontroll över vilka element som visas i applikationens vyer, samt hur push-notiser beter sig utifrån dessa val. Vyer har också bytt namn ("Månadsvy" heter nu "Gemensam") för att tydligare reflektera funktionaliteten.

### Varför
Tidigare var vissa rutor (som totalbelopp) hårdkodade och ibland duplicerade (i den privata vyn fanns både en fast ruta och en inställningsbar ruta). Dessutom ville användare kunna använda appen som en "klassisk utgiftskoll" utan att behöva låsa/markera räkningar som hanterade. Det fanns även en dubblett av datuminställningen för push-notiser som skapade förvirring. Detta löstes för att skapa ett renare, mer flexibelt gränssnitt som anpassar sig till användarens behov.

### Hur
- **Gemensam vy (tidigare Månadsvy):** Namnbytet genomfördes i hela navigeringsstrukturen (\`App.tsx\`). Låsknappen för totalbeloppet fick också en visuell uppdatering för att matcha övriga "Låst"-knappar (solid grön bakgrund, \`var(--success-color)\`).
- **Separata Totalsummor:** Inställningen för totalbelopp delades upp i två separata toggles i \`ManageBills.tsx\`: en för "Gemensam vy" (\`showTopTotal\`) och en för "Privat vy" (\`showPrivateTopTotal\`). Den hårdkodade totalrutan i \`PrivateView.tsx\` togs bort.
- **Hanteringsknappar (Lås & Hanterat):** En ny inställning \`enableManagementButtons\` lades till. När denna är urkryssad döljs alla knappar för att markera överföringar och totalbelopp som klara i \`Summary.tsx\` och \`MonthView.tsx\`.
- **Intelligenta Push-notiser:** Cron-jobbet (\`api/cron.js\`) som skickar ut påminnelser läser nu av \`enable_management_buttons\` direkt från databasen (\`household_settings\`). Om hushållet stängt av hanteringsknapparna hoppas hushållet över helt i utskicket (eftersom det inte finns något sätt för dem att markera räkningarna som klara ändå).
- **Städning av UI:** Inställningen för "Påminnelsedatum" togs bort från 'Allmänt' eftersom den var duplicerad och redan fanns under 'Mina Sidor' (där användaren även aktiverar sina push-prenumerationer). Varningstexten om historik flyttades från App-skalets rotnivå in direkt i \`MonthView.tsx\` så att den ligger naturligt under totalbelopps-rutan.
- **Databas (Schema):** För att bibehålla "Frontend som Source of Truth" för tillfälligt state, men ändå kunna styra Cron-jobbet, kompletterades \`household_settings\` med nya kolumner: \`show_swish_summary\`, \`show_transfer_summary\`, \`enable_management_buttons\`, och \`show_private_top_total\`.
`;
fs.appendFileSync('SYSTEM_DOKUMENTATION.md', content);
fs.appendFileSync('all_info_system.md', content);
console.log("Done");
