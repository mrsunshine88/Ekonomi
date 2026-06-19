const fs = require('fs');
const text = `
## Kundtjänst: Chatt och E-postköer

Systemet stödjer separata köer för live-chatt och e-postärenden. 
1. **Databas**: Tabellen \`chat_sessions\` använder fältet \`ticket_type\` ('chat' eller 'email') för att särskilja ärenden. För e-post sparas även \`inbound_address\`, \`customer_email\` och \`email_subject\`.
2. **Agentbehörigheter**: I tabellen \`profiles\` lagras \`handles_chat\` (boolean) och \`handles_email\` (boolean) för att styra vilken typ av ärenden en specifik agent (\`chat_agent = true\`) får ta.
3. **Tilldelning**: Funktionen \`auto_assign_oldest_chat()\` letar upp äldsta väntande ärende men filtrerar utifrån agentens \`handles_chat\`/\`handles_email\`-inställningar, så agenter bara drar från de köer de är behöriga för.
4. **In/Ut**: Inkommande e-post konverteras till kod via en Webhook/Inbound Parse (t.ex. Resend eller Postmark) och läggs i \`chat_sessions\`. Utgående svar via e-post skickas genom en Edge Function via SMTP.
`;
fs.appendFileSync('SYSTEM_DOKUMENTATION.md', text);
