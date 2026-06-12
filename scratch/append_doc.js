import fs from 'fs';

const docPath = 'SYSTEM_DOKUMENTATION.md';
const contentToAppend = `

---

## Push-notiser och Realtids-chatt (Avancerad Arkitektur)

### Översikt
Systemet för push-notiser är byggt för att kringgå aggressiva batteri-optimeringar och notis-blockeringar (särskilt på Samsung/Android). Det använder en kombination av Vercel Serverless Functions, Supabase Database, och en anpassad PWA Service Worker.

### 1. PWA & Android WebAPK (Manifestet)
För att Android ska acceptera webbappen som en "Äkta" app (vilket krävs för att få en egen notiskanal i inställningarna och inte klumpas ihop med Chrome), används "Maskable Icons" i PWA-manifestet (\`vite.config.ts\`).
Genom att ange \`purpose: 'maskable'\` tvingas Chrome att generera en WebAPK vid installation på hemskärmen, vilket ger appen fulla rättigheter till operativsystemets push-tjänster och kringgår Samsungs standard-blockeringar av webbläsar-notiser.

### 2. Bypass av Supabase Webhooks
Vi förlitar oss **inte** på Supabase Webhooks (\`pg_net\`) för att skicka notiser, eftersom detta ofta är instabilt och leder till fördröjningar. Istället skickar frontend-koden (\`ChatBubble.tsx\`) en direkt \`POST\`-request till Vercel-API:et (\`/api/send-push\`) i samma millisekund som meddelandet sparas i databasen. Detta garanterar omedelbar leverans utan mellanhänder.

### 3. VAPID-nycklar & Vercel
För att autentisera mot Googles (FCM) och Apples push-servrar används VAPID-nycklar. 
- **Frontend** bygger in den offentliga nyckeln via \`import.meta.env.VITE_VAPID_PUBLIC_KEY\` och ber användarens webbläsare om tillåtelse (\`pushManager.subscribe\`). Adressen sparas sedan i tabellen \`admin_push_subscriptions\`.
- **Backend (Vercel)** använder \`VITE_VAPID_PUBLIC_KEY\` och \`VAPID_PRIVATE_KEY\` inifrån Vercel Environment Variables för att signera signalen. Om dessa saknas vägras åtkomst med felet "Received unexpected response code".

### 4. Anti-Spam & Stör-Ej (Service Worker)
I \`push-sw.js\` finns avancerad logik för att förhindra dubbletter och oönskade notiser:
- **\`isAppActive\` (Stör Ej):** Innan notisen visas kollar Service Workern om appen redan är öppen och fokuserad på skärmen (\`visibilityState === 'visible'\`). Om den är det, avbryts push-notisen tyst, eftersom användaren ändå ser chatten uppdateras i realtid via WebSockets.
- **Tag-gruppering:** Vercel-servern skickar notisen med \`tag: 'chat-message'\`. Om flera notiser skickas samtidigt (t.ex. vid nätverkslagg), skriver operativsystemet över den föregående notisen så att användaren endast får ett enda "pling" istället för fyra stycken på rad.
- **Borttagen Lokal Notis:** Den inbyggda \`showNotification()\` inuti WebSocket-lyssnaren i \`AdminChat.tsx\` har tagits bort helt. Detta förhindrar att WebSocket-trafiken och Web Push-trafiken krockar och skapar dubbletter när appen körs i bakgrunden.

Denna arkitektur är industri-standard och säkerställer maximal driftsäkerhet på både iOS, Android och Desktop-miljöer.
`;

fs.appendFileSync(docPath, contentToAppend);
console.log('Dokumentationen har uppdaterats framgångsrikt!');
