const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../SYSTEM_DOKUMENTATION.md');

const contentToAppend = `
---

## 25. Kundservice: Smart-Routing med Separata KÃ¶er (Chatt, Support & Info)

### Vad:
Ett intelligent internt kÃ¶- och tilldelningssystem fÃ¶r kundservicemedarbetare. Systemet delar automatiskt upp och portionerar ut inkommande Ã¤renden (Chatt, Support-mejl och Info-mejl) till lediga agenter baserat pÃ¥ deras individuella prioriteringar och kÃ¶-behÃ¶righeter, helt i realtid.

### Hur:
- **Tre Separata KÃ¶er**: 
  1. **Chatt-kÃ¶** (live-chattar).
  2. **Support-kÃ¶** (alla inkommande mejl exklusive "info@").
  3. **Info-kÃ¶** (mejl skickade specifikt till adresser som slutar pÃ¥ eller innehÃ¥ller "info@").
- **Individuell Prioritering (1-10)**: I Admin Dashboard kan systemadministratÃ¶ren kryssa i exakt vilka av de tre kÃ¶erna varje agent ska hantera. FÃ¶r varje aktiv kÃ¶ kan man sÃ¤tta en Prio (1 till 10).
- **Pull-baserad Tilldelning**: NÃ¤r en agent blir "Ledig" kÃ¶rs den lagrade SQL-funktionen \`auto_assign_oldest_chat()\`.
- **Sorteringslogik i Databasen**: Databasen sorterar alla vÃ¤ntande Ã¤renden. Den sorterar i fÃ¶rsta hand pÃ¥ agentens *prioritetsnivÃ¥* (exempelvis om agenten har Prio 10 pÃ¥ Support-kÃ¶n, hamnar alla Support-mejl hÃ¶gst upp). I andra hand sorterar den pÃ¥ \`created_at ASC\` (lÃ¤ngst vÃ¤ntetid).
- **Automatiska Tabelluppdateringar**: Profiltabellen (\`profiles\`) utÃ¶kades med \`handles_info\`, \`prio_chat\`, \`prio_email\`, och \`prio_info\`.
- **Concurrency (TÃ¤vlingsfÃ¶rhÃ¥llanden)**: Funktionen anvÃ¤nder \`FOR UPDATE SKIP LOCKED\` nÃ¤r den plockar det Ã¤ldsta/hÃ¶gst prioriterade Ã¤rendet. Detta sÃ¤kerstÃ¤ller att om tvÃ¥ agenter blir lediga pÃ¥ exakt samma millisekund, kommer de garanterat att fÃ¥ var sitt Ã¤rende och aldrig rÃ¥ka dra samma mejl.

### VarfÃ¶r:
I bÃ¶rjan var mÃ¥let enbart att fÃ¶rdela Ã¤renden jÃ¤mt baserat pÃ¥ kÃ¶tid. NÃ¤r kundservicen vÃ¤xer insÃ¥g vi behovet av specialisering (vissa agenter Ã¤r bÃ¤ttre pÃ¥ Info-mejl, andra ska ta chattar). Det flexibla (1-10) systemet gÃ¶r att vissa agenter kan jobba *exklusivt* med Info-mejl, medan andra har det som "reserv-uppgift" om Info-mejlen skulle bÃ¶rja bli orimligt gamla i kÃ¶n. Allt skÃ¶ts per automatik utan att nÃ¥gon manager behÃ¶ver dela ut Ã¤renden manuellt.
`;

fs.appendFileSync(filePath, contentToAppend);
console.log('Appended successfully');
