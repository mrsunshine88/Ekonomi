const fs = require('fs');
const path = 'c:\\Users\\perss\\Desktop\\Ekonomiapp\\SYSTEM_DOKUMENTATION.md';

const newContent = `

---

## 23. Startsida & Förbättrad Navigering

### Vad:
För att göra appen mer välkomnande och enkel att förstå för nya (och befintliga) användare skapades en dedikerad "Startsida" som agerar nav för hela applikationen.

### Hur:
- **Ny Komponent (\`src/components/StartPage.tsx\`):** En visuell överblicksvy med 5 eleganta rutor ("Gemensam", "Statistik", "Privat", "Mina sidor", "Inställningar").
- **Tydliga Förklaringar:** Varje ruta har en ikon, en rubrik och en kort beskrivning som förklarar exakt vad vyn gör (t.ex. "Översikt över din privata ekonomi. Se månadens räkningar.").
- **Omdöpning av EkonomiTB:** För att göra appen mer självförklarande har fliken "EkonomiTB" döpts om till "Statistik" i alla menyer och rubriker.
- **Smart Tillbaka-navigering:** Istället för att användare alltid skickas till "Gemensam" när de stänger en undermeny (t.ex. Inställningar eller Mina Sidor), leds de nu konsekvent tillbaka till Startsidan ("← Tillbaka till Startsida").

### Varför:
Appen har vuxit med många avancerade funktioner. En startsida med tydliga beskrivningar minskar inlärningströskeln drastiskt och ger ett mer premium och strukturerat intryck. 

---

## 24. Kundtjänst-chatt & Optimistic UI (Race Condition Fix)

### Vad:
En inbyggd chatt-funktion för kommunikation mellan användare och support/admin, med realtidsuppdateringar och "Optimistic UI" för att säkerställa att meddelanden aldrig upplevs försvinna.

### Hur:
- **Komponenter:** \`ChatBubble.tsx\` (för klienten) och \`AdminChat.tsx\` (för administratören).
- **Databas & Realtid:** Meddelanden sparas i tabellen \`chat_messages\` och klienterna lyssnar på nya meddelanden via Supabase Realtime (\`postgres_changes\`).
- **Problemet som löstes:** Tidigare hände det att det absolut första "Hej"-meddelandet inte syntes i klientens fönster. Detta berodde på ett "Race Condition": Klienten skickade meddelandet, men hann inte starta prenumerationen på realtidskanalen (som skapades dynamiskt med session-ID) innan databasen redan svarat.
- **Lösningen (Optimistic Update):** Istället för att uteslutande förlita sig på databasens realtidsnotiser, uppdateras nu det lokala React-statet (\`setMessages\`) omedelbart så fort användaren trycker på "Skicka". När realtidsnotisen väl kommer från databasen, används meddelandets \`id\` för att filtrera bort dubbletter.

### Varför:
En chatt måste kännas blixtsnabb och 100% pålitlig. Genom att hantera utgående meddelanden lokalt direkt ("Optimistic UI") löstes inte bara buggen med det försvunna första meddelandet, utan hela chatten upplevs nu mycket snabbare.
`;

fs.appendFileSync(path, newContent);
console.log('Documentation appended.');
