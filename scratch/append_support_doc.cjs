const fs = require('fs');

const docs = `

---

## 28. Uppdatering: Kundservice & Agent-hantering

### Vad:
Kundservice-modulen och agent-hanteringen har fått en stor uppgradering. Detta inkluderar fullt stöd för omnikanal (både chatt och e-post i samma kö), utökad status-hantering för agenter, automatisk tilldelning (routing) med timeout, och en helt omdesignad, responsiv "SmartAgent"-panel.

### Hur:
- **Omnikanal & Kö-hantering (\`chat_sessions\`):**
  - Vi har utökat tabellen \`chat_sessions\` till att även hantera inkommande e-post. En ny kolumn \`ticket_type\` indikerar om ärendet är 'chat' eller 'email'. E-post sparas med \`customer_email\`, \`email_subject\` och \`inbound_address\` istället för \`visitor_id\`.
  - Agenter accepterar e-post på exakt samma sätt som chattar, och får automatiskt en e-postsignatur ifylld när de svarar.

- **Utökade Agent-statusar (\`agent_sessions\`):**
  - Statusarna har utökats från att bara vara offline/available/busy till att nu inkludera:
    - \`post_work\` (Efterarbete)
    - \`break\` (Rast)
    - \`lunch\` (Lunch)
    - \`other_absence\` (Övrig frånvaro)
  - Tabellens \`CHECK\`-constraint och berörda RPC-funktioner (\`agent_set_status\`, \`release_chat_session\`) har uppdaterats via SQL för att tillåta dessa nya statusar. Frontend har nu tydliga felmeddelanden vid misslyckat statusbyte (förhindrar osynk).

- **Automatisk "Unclaim" & 60-sekunders Timeout:**
  - När ett ärende tilldelas en agent byts ärendets status till \`assigned\`.
  - En ny \`useEffect\`-timeout i \`SupportView.tsx\` bevakar detta. Om agenten inte klickar på "Ta ärende" (accept) inom 60 sekunder anropas \`unclaim_chat_session\`.
  - Denna RPC släpper ärendet tillbaka till kön (status \`waiting\` och \`assigned_to = NULL\`) och frontenden sätter sedan agentens status till \`other_absence\` för att förhindra att fler ärenden studsar på den inaktiva agenten.
  - Samma sak sker om en agent stänger fönstret eller kopplar från (via \`handleDisconnect\`); ärendet läggs omedelbart tillbaka i kön.

- **Design och UI-förbättringar (\`SupportView.tsx\`):**
  - SmartAgent-panelen har fått rundade, klickbara knappar (påminner om Clearagent/SaaS-telefonisystem) för statusbyten (Ledig, Rast/Meny, Nytt Mej, Koppla från).
  - En ny rullgardinsmeny ("dropdown") lades till på den orangea knappen, vilket tillåter valet mellan Efterarbete, Rast, Lunch, och Övrig frånvaro.
  - Tidigare statisk information byttes ut mot en dynamisk **Tid-räknare** som utgår från agentens senast uppdaterade status (\`updated_at\` hämtad från \`agent_sessions\`). Det visar i realtid hur länge man har haft sin aktuella status.
  - Fixade "overflow"-klippning så att dropdown-menyn för statusar kan ritas över panelens rundade hörn (via \`overflow: 'visible'\`).

- **Cooldown (Andrum) och Post-work logik:**
  - \`setCooldown(20)\` (20 sekunders "Efterarbete") kickar nu *enbart* in när agenten stänger ett pågående ärende, för att ge dem andrum.
  - Om agenten kopplar upp sig (\`handleConnect\`) eller manuellt sätter sig till "Ledig" från frånvaro appliceras ingen cooldown, utan de blir tillgängliga omedelbart.
  - När agenten klickar för att skriva ut ett nytt mejl via den lila ikonen, tvingar systemet dem automatiskt till \`post_work\` så att de slipper bli avbrutna av inkommande tickets under tiden de skriver.

### Varför:
- För att ge en mer professionell, "SaaS-känsla" som efterliknar avancerade kundservicesystem.
- Att låta agenter välja exakt varför de är borta ger chefer bättre överblick i Adminpanelen (vilket nu inkluderar \`other_absence\`).
- "Unclaim"-logiken är kritisk i ett asynkront/realtidssystem: om en agent kraschar eller glömmer datorn får inte kunden sitta och vänta i evighet. Kunder slussas nu automatiskt vidare i kön.
`;

fs.appendFileSync('SYSTEM_DOKUMENTATION.md', docs);
console.log('Documentation appended.');
