const fs = require('fs');
const path = require('path');

const docPath = path.join(__dirname, 'SYSTEM_DOKUMENTATION.md');
let content = fs.readFileSync(docPath, 'utf8');

const newSection = `
---

## Uppdatering: Äkta Bakgrundsnotiser & Backend-driven Auto-tilldelning (2026-06-21)

### Vad som gjordes
Kundservicemodulen har arkitektoniskt skrivits om gällande hur inkommande ärenden (chatt och e-post) tilldelas en supportagent, samt hur Push-notiser triggas till agenterna. Tidigare låg denna logik i frontend (webbläsaren), där \`SupportView.tsx\` körde en \`setInterval\`-loop som pollade databasen via RPC-anropet \`auto_assign_oldest_chat\`. Frontend gjorde därefter ett manuellt \`fetch\`-anrop till \`/api/send-push\` för att trigga en notis till agenten.

### Varför
Det tidigare angreppssättet krävde att agenten hade en aktiv, körande webbläsarflik för att "motorn" skulle fungera. Om alla agenter stängde appen på sina mobiler och datorer stannade ärendetilldelningen helt, vilket innebar att kunderna fastnade i kön och inga Push-notiser skickades ut, trots att Push-teknologin i sig har stöd för att väcka stängda enheter. Målet var att få appen att bete sig som en riktig native-app som plingar även om den är helt nedstängd i bakgrunden.

### Hur (Teknisk lösning)
Vi flyttade "motorn" från webbläsaren till databasen genom att implementera tre händelsestyrda \`Triggers\` i PostgreSQL (Supabase):

1. **Trigger vid Nytt Ärende (\`on_new_ticket_auto_assign\`):**
   - Ligger på tabellen \`chat_sessions\` och triggas \`AFTER INSERT\`.
   - Om ärendet har status \`waiting\`, anropas funktionen \`system_auto_assign_ticket()\` som letar efter den agent med status \`available\` som har väntat längst, och tilldelar ärendet direkt.

2. **Trigger vid Statusbyte (\`on_agent_available_auto_assign\`):**
   - Ligger på tabellen \`agent_sessions\` och triggas \`AFTER UPDATE\`.
   - När en agent ändrar sin status till \`available\` (t.ex. vid inloggning eller efter ett avslutat ärende), anropas samma funktion men tvingar tilldelning av det äldsta väntande ärendet till just denna agent.

3. **Webhook för Push-notiser (\`on_ticket_assigned_send_push\`):**
   - Ligger på tabellen \`chat_sessions\` och triggas \`AFTER UPDATE\`.
   - När ett ärende byter status från \`waiting\` till \`assigned\` och får ett agent-ID tilldelat, använder databasen Supabase inbyggda \`pg_net\`-tillägg.
   - Den kör en \`net.http_post()\` direkt mot Vercel-API:et (\`https://www.smartekonomi.nu/api/send-push\`). Vercel väcks, slår upp agentens prenumeration i \`admin_push_subscriptions\` och skickar Push-notisen via Web Push protocol.

### Frontend Rensning
Följande har raderats från klienten:
- Loopen \`setInterval(tryAutoAssign, 2000)\` har plockats bort helt.
- \`SupportView.tsx\` lyssnar nu uteslutande passivt på databasuppdateringar via WebSockets (\`postgres_changes\`). När ärendet tilldelas (av backend) ritas vyn om omedelbart för agenten.
- Ett tillägg gjordes för att även visa lokala webbläsarnotiser (\`new Notification()\`) vid tilldelning, förutsatt att fönstret råkar vara aktivt, som ett komplement till Push-notisen från Vercel.
`;

fs.writeFileSync(docPath, content + newSection);
console.log('Successfully updated SYSTEM_DOKUMENTATION.md');
