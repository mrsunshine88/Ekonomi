const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../SYSTEM_DOKUMENTATION.md');

const contentToAppend = `
---

## 26. Kundtjänst: AI-liknande Chatt och Realtidskö

### Vad
Kundtjänstens chattfunktion har designats om för att ge kunden en mer interaktiv upplevelse med en "AI-känsla". Kunder som hamnar i kö ser sin köplats uppdateras i sann realtid (utan sidladdningar) som ett AI-meddelande direkt i chattflödet. När agenten tar ärendet skickas en personlig bot-hälsning automatiskt med agentens förnamn. Dessutom har vi separerat agentens signatur (Förnamn och Efternamn) för att kunna ha personliga chattar med bara förnamnet, och formella e-post-svar med hela namnet. Oinloggade besökare kan återigen skicka meddelanden, efter en säkerhetsuppdatering.

### Hur
1. **Realtidskö (Websockets):** I \`ChatBubble.tsx\` prenumererar kundens fönster på globala förändringar via \`supabase.channel('global_queue_updates_for_visitor')\`. När kön förändras (t.ex. en agent tar ett ärende) tvingas en omedelbar kö-räkning, vilket gör att "Din köplats är X"-meddelandet tickar ner blixtsnabbt.
2. **AI-Utseende i Chatten:** Systemmeddelanden särskiljs nu i \`ChatBubble.tsx\` med en \`🤖\`-ikon, en ljuslila bakgrund med \`flexbox\`, och automatisk radbrytning. Det är separerat från de vanliga blå/svarta textbubblorna.
3. **Agent-Signatur (Förnamn & Efternamn):** \`SupportView.tsx\` låter agenter ange två fält: \`agent_signature_first\` och \`agent_signature_last\` (sparas i \`localStorage\`). 
4. **Automatisk AI-Hälsning:** \`accept_assigned_chat_session\` SQL RPC-funktionen i databasen har byggts om för att ta emot agentens förnamn som argument (\`p_first_name\`). Så fort agenten accepterar en chatt, infogar databasen blixtsnabbt \`"🤖 Du pratar med [Förnamn], vad kan jag hjälpa dig med?"\` i ärendet.
5. **Rättigheter för oinloggade:** Ett nyligt problem innebar att besökare blockerades från att starta chattar, då chatten krävde validering av en inbyggd länk till hushåll via \`user_in_household()\`. Eftersom den funktionen nyligen blivit blockerad från \`anon\`-roller justerades databasen genom kommandot \`GRANT EXECUTE ON FUNCTION public.user_in_household(uuid) TO anon;\`.

### Varför
*   **Kundupplevelse:** Att vänta "i en blå mätare" känns gammaldags. Att få löpande automatiska meddelanden ger ett tryggare och mer interaktivt intryck. 
*   **Låg Latens:** Websockets (realtid) sparar tid åt användaren jämfört med det tidigare systemet där kön pollades var 15:e sekund.
*   **Personlig ton:** I chatt upplevs tilltal med enbart förnamn mer välkomnande och modernt. I e-post krävs en högre formell standard med fullständigt namn. Att splitta dem gav maximal flexibilitet.
*   **Säkerhet i databasen:** Anledningen till att hälsningsmeddelandet läggs in via backend (RPC) är för att kringgå potentiella krockar där databasen av säkerhetsskäl tidigare stängde ute system-inlägg från klienter.
`;

fs.appendFileSync(filePath, contentToAppend, 'utf8');
console.log('Appended section 26 to SYSTEM_DOKUMENTATION.md');
