# SmartEkonomi - Systemdokumentation

**Plattform:** React + TypeScript + Vite (PWA) | Databas: Supabase (PostgreSQL) | Hosting: Vercel  

---

## 1. Vad Ã¤r SmartEkonomi?

Det Ã¤r en webb-applikation (byggd i React, TypeScript och Vite) som automatiskt rÃ¤knar ut hur hushÃ¥llets gemensamma rÃ¤kningar ska delas. Den eliminerar behovet av minirÃ¤knare och kalkylark.

Appen stÃ¶der ett obegrÃ¤nsat antal gemensamma konton och personliga konton, och hanterar avancerad Splitwise-matematik i bakgrunden. Den Ã¤r byggd som en PWA (Progressive Web App) och fungerar som en riktig app pÃ¥ mobilen â€“ ingen App Store behÃ¶vs.

**Appens fem huvudvyer (i ordning uppifrÃ¥n och ner i menyn):**
- `ðŸ“… MÃ¥nadsvy` â€“ Gemensamma rÃ¤kningar, mata in belopp, markera som Ã¶verfÃ¶rda.
- `ðŸ”’ Privat` â€“ Personliga utgifter och privata lÃ¥n, synliga enbart fÃ¶r dig.
- `ðŸ“Š EkonomiTB` â€“ Historisk statistik, grafer, skuld-avbetalningskontroll.
- `ðŸ‘¤ Mina sidor` â€“ Kontoinformation, hushÃ¥llskod och lÃ¤mna-hushÃ¥ll.
- `âš™ï¸ InstÃ¤llningar` â€“ Hantera rÃ¤kningar, konton, lÃ¥s och allmÃ¤nna instÃ¤llningar.

---

## 2. Databasarkitektur â€“ Relationsdatabas

### Vad:
All data lagras i en **fullt normaliserad relationsdatabas** i Supabase (PostgreSQL). Varje datatyp har sin egen tabell. Detta Ã¤r den avgÃ¶rande skillnaden mot hur den tidigaste arkitekturen sparade allt som ett enda stort JSON-dokument.

### Hur â€“ Databastabeller:

| Tabell | InnehÃ¥ll |
|--------|----------|
| `households` | Ett hushÃ¥ll per rad. AnvÃ¤nds fortfarande som ankarpunkt med `id` (UUID). |
| `profiles` | En profil per anvÃ¤ndare. Kopplar `user_id â†’ household_id`. |
| `accounts` | Konton (gemensamma och personliga). En rad per konto. |
| `bills` | Gemensamma rÃ¤kningar. En rad per rÃ¤kning med alla instÃ¤llningar. |
| `month_bill_amounts` | **En rad per (hushÃ¥ll + mÃ¥nad + rÃ¤kning).** Belopp som matats in. |
| `month_handled_payments` | **En rad per (hushÃ¥ll + mÃ¥nad + payment_id).** Avprickade betalningar. |
| `month_confirmed_anomalies` | En rad per bekrÃ¤ftad avvikelse (anomalidetektion). |
| `private_bills` | Privata rÃ¤kningar. StÃ¤mplade med `user_id`. |
| `private_month_amounts` | En rad per (hushÃ¥ll + user + mÃ¥nad + privat rÃ¤kning). |
| `private_month_locks` | En rad per (hushÃ¥ll + user + mÃ¥nad). HÃ¥ller lÃ¥s-status fÃ¶r privata mÃ¥nader. |
| `private_month_anomalies` | BekrÃ¤ftade avvikelser fÃ¶r privata rÃ¤kningar. |
| `household_settings` | En rad per hushÃ¥ll. AllmÃ¤nna instÃ¤llningar som `show_summary`. |

### VarfÃ¶r relationsdatabas (och inte JSON)?

Den tidigaste arkitekturen sparade **hela appens tillstÃ¥nd** som ett enda JSON-dokument. Det innebar att om du och Helena Ã¤ndrade olika rÃ¤kningar i exakt samma sekund, vann den som sparade *sist* och den andras Ã¤ndring fÃ¶rsvann.

Med relationsdatabasen uppdateras **enbart den exakta raden** som Ã¤ndrades. Om du Ã¤ndrar beloppet pÃ¥ "Elen" uppdateras en enda rad i `month_bill_amounts`. Om Helena Ã¤ndrar "Hyran" uppdateras en annan rad. De Ã¤r helt oberoende och kan aldrig skriva Ã¶ver varandra. **Ingen data kan gÃ¥ fÃ¶rlorad.**

---

## 3. DatainlÃ¤sning & Realtidssynkronisering

### Vad:
All data laddas frÃ¥n Supabase nÃ¤r appen startar, och uppdateras automatiskt i realtid nÃ¤r nÃ¥gon annan i hushÃ¥llet gÃ¶r en Ã¤ndring.

### Hur (`src/store.ts â†’ useStore(householdId)`):

**Steg 1 â€“ Migrationskontroll:**
Vid allra fÃ¶rsta inlÃ¤sningen kontrollerar appen om `accounts`-tabellen Ã¤r tom fÃ¶r hushÃ¥llet. Om ja, och det finns data i den gamla `state_json`-kolumnen, kÃ¶rs `runRelationalMigration()` automatiskt en enda gÃ¥ng. Det gamla JSON-dokumentet lÃ¤ses av och all data packas in i de nya tabellerna utan att en enda siffra gÃ¥r fÃ¶rlorad.

**Steg 2 â€“ Initial laddning (`Promise.all`):**
Appen hÃ¤mtar data frÃ¥n alla 10 tabeller **parallellt** via en enda `Promise.all(...)`. Det gÃ¶r inlÃ¤sningen snabb oavsett hur mycket historik som finns.

**Steg 3 â€“ Rekonstruktion av `AppState`:**
De 10 svarspaketen mappas samman till det interna `AppState`-objektet som komponenterna fÃ¶rstÃ¥r. T.ex. aggregeras alla rader frÃ¥n `month_bill_amounts` till `months[monthId].billAmounts[billId]`.

**Steg 4 â€“ Realtidslyssnare (`supabase.channel`):**
Appen prenumererar pÃ¥ `postgres_changes`-hÃ¤ndelser pÃ¥ **alla 10 tabeller** via en och samma Supabase-kanal. Varje Ã¤ndring i databasen (oavsett vem som gjorde den) triggrar en ny komplett inlÃ¤sning (`loadCloud()`), debounced till 500ms fÃ¶r att undvika flodvÃ¥gor av requests om mÃ¥nga saker Ã¤ndras pÃ¥ en gÃ¥ng.

**Steg 5 â€“ Optimistisk UI:**
Varje mutationsfunktion (t.ex. `updateBillAmount`) gÃ¶r **tvÃ¥ saker direkt:**
1. Uppdaterar det lokala React-state omedelbart (UI svarar pÃ¥ en brÃ¥kdel av en sekund).
2. Skickar `upsert` till rÃ¤tt Supabase-tabell asynkront i bakgrunden.

### VarfÃ¶r:
Kombinationen av optimistisk UI + relationsuppdateringar + realtidsprenumeration ger en upplevelse som Ã¤r lika snabb som en lokal app men alltid i synk med molnet. Inget debounce-fÃ¶nster med risk fÃ¶r datafÃ¶rlust lÃ¤ngre.

---

## 4. Migreringslogik (`src/migrateToRelational.ts`)

### Vad:
Ett automatiskt engÃ¥ngsskript som kÃ¶rs osynligt i bakgrunden fÃ¶rsta gÃ¥ngen appen startar efter version 3.0-uppdateringen.

### Hur:
1. LÃ¤ser av `state_json` frÃ¥n `households`-tabellen.
2. Mappar varje del av JSON-dokumentet till rÃ¤tt ny tabell:
   - `state.accounts` â†’ `accounts`
   - `state.bills` â†’ `bills`
   - `state.months[m].billAmounts` â†’ `month_bill_amounts`
   - `state.months[m].handledPayments` â†’ `month_handled_payments`
   - `state.privateBills` â†’ `private_bills`
   - `state.privateMonths[m].billAmounts` â†’ `private_month_amounts`
   - `state.privateMonths[m].isLocked` â†’ `private_month_locks`
   - `state.settings` â†’ `household_settings`
3. Alla inserts anvÃ¤nder `upsert` med `onConflict`-hantering â€“ migreringen kan kÃ¶ras om utan att skapa dubbletter.

### VarfÃ¶r:
Befintliga hushÃ¥ll med mÃ¥naders historik behÃ¶ver inte fÃ¶rlora ett enda Ã¶re av sin data. Migreringen sker utan nertid, utan manuellt arbete och utan att anvÃ¤ndaren mÃ¤rker det.

---

## 5. Row-Level Security (RLS) & SÃ¤kerhet

### Vad:
Alla databastabeller Ã¤r lÃ¥sta med PostgreSQL Row-Level Security. Ingen kan lÃ¤sa eller skriva data som inte tillhÃ¶r deras eget hushÃ¥ll â€“ inte ens om de skulle manipulera klientkoden.

### Hur:
- **RLS Ã¤r aktiverat** pÃ¥ alla 10+ tabeller.
- En hjÃ¤lpfunktion i databasen `user_in_household(hid uuid)` kontrollerar om den inloggade anvÃ¤ndaren (`auth.uid()`) tillhÃ¶r hushÃ¥llet via tabellen `profiles`.
- Alla policys Ã¤r av typen `FOR ALL USING (user_in_household(household_id))` â€“ funkar fÃ¶r SELECT, INSERT, UPDATE och DELETE i ett svep.
- Privata tabeller (`private_bills`, `private_month_amounts` etc.) krÃ¤ver dessutom att `user_id = auth.uid()` i klientlogiken, som extra skyddslager.
- HushÃ¥lls-ID (UUID) genereras via `crypto.randomUUID()` direkt i webblÃ¤saren *innan* det skickas till Supabase (i `AuthContext.tsx`).
- Registrering och hushÃ¥llsskapande anvÃ¤nder `upsert` fÃ¶r att vara idempotent â€“ kan kÃ¶ras om utan att skapa dubbletter om nÃ¤tverket tappar fÃ¶rbindelsen mitt i.

### VarfÃ¶r:
Ekonomidata Ã¤r kÃ¤nslig. Ã„ven om nÃ¥gon skulle lyckas dekompilera JavaScript-koden och skicka manuella API-anrop, vÃ¤grar databasen att svara med eller acceptera data som inte tillhÃ¶r dem.

---

## 6. Mobilapp och PWA (Progressive Web App)

### Vad:
Appen fungerar precis som en Ã¤kta app pÃ¥ mobilen. Man kan lÃ¤gga till den pÃ¥ hemskÃ¤rmen och den Ã¶ppnas i fullskÃ¤rm utan adressfÃ¤lt eller webblÃ¤sarkontroller.

### Hur â€“ PWA-teknik & Installation:
`vite-plugin-pwa` i `vite.config.ts` genererar automatiskt:
- **Service Worker (`sw.js`):** Cachar appens filer lokalt. Appen laddas snabbt Ã¤ven vid dÃ¥lig signal och fungerar i offline-lÃ¤ge. Appen uppdaterar sig sjÃ¤lv automatiskt i bakgrunden nÃ¤r ny kod laddas upp (`autoUpdate`).
- **Web App Manifest (`manifest.webmanifest`):** BerÃ¤ttar fÃ¶r telefonen att appen Ã¤r installationsbar.
- **Ikon-optimering:** Ikonerna (192x192 och 512x512) Ã¤r utskrivna som solida, opaka fyrkanter (lila gradient-bakgrund). Detta gÃ¶rs fÃ¶r att Android (Adaptive Icons) och iOS ska kunna applicera sin egen mask (t.ex. rundade hÃ¶rn) utan att bakgrunds-UI lyser igenom transparenta kanter.
- **Custom Install Prompt:** Appen innehÃ¥ller en egen, designad installationsruta (`InstallPrompt.tsx`) som visas fÃ¶r nya anvÃ¤ndare. PÃ¥ Android lyssnar den pÃ¥ `beforeinstallprompt` och fÃ¥ngar eventet fÃ¶r att installera direkt via ett klick. PÃ¥ iOS detekteras enheten via User Agent och istÃ¤llet visas en steg-fÃ¶r-steg-guide hur man installerar appen via Safaris Dela-meny, eftersom Apple inte stÃ¶djer API:et fullt ut.

### Hur â€“ Responsiv Navigering (`src/App.tsx` + `src/index.css`):
- **PÃ¥ datorn (>768px):** Alla fem flikar visas som knappar i en fast header lÃ¤ngst upp pÃ¥ sidan.
- **PÃ¥ mobilen (â‰¤768px):** Desktop-headern dÃ¶ljs (`display: none`). IstÃ¤llet visas en lila **â˜° Hamburgermeny-knapp** uppe till vÃ¤nster. Vid klick glider en panel in frÃ¥n vÃ¤nster och tÃ¤cker 75% av skÃ¤rmen med alla fem menyval. Aktiv vy markeras med lila bakgrund. Klickar man utanfÃ¶r panelen (pÃ¥ det mÃ¶rka skÃ¤rmslÃ¤cket) stÃ¤ngs menyn. Knappen byter ikon till **âœ•** nÃ¤r menyn Ã¤r Ã¶ppen.

### Hur â€“ InstÃ¤llningar UX (dropdown pÃ¥ mobil):
- **PÃ¥ datorn:** Flikarna i InstÃ¤llningar (RÃ¤kningar, Konton, LÃ¥s upp, AllmÃ¤nt) visas som fyra knappar i en rad.
- **PÃ¥ mobilen:** Samma knappar ersÃ¤tts av en native `<select>`-rullgardin. Detta sÃ¤kerstÃ¤ller att knappen "AllmÃ¤nt" aldrig hamnar utanfÃ¶r skÃ¤rmen och att anvÃ¤ndaren alltid hittar alla underalternativ direkt.
- **CSS-klasser:** `.settings-tabs-desktop { display: flex }` och `.settings-tabs-mobile { display: none }` vÃ¤xlas via `@media (max-width: 768px)`.

### VarfÃ¶r:
En ekonomiapp anvÃ¤nds oftast pÃ¥ sprÃ¥ng â€“ i kassan, pÃ¥ bussen, efter en stor mÃ¥nad. PWA-tekniken ger en exklusiv native-app-kÃ¤nsla, och de mobilanpassade UI-mÃ¶nstren (hamburgermeny + rullgardin) garanterar att ingen funktion Ã¤r gÃ¶md eller krÃ¤ver horisontell scrollning.

---

## 7. UtrÃ¤kningar (Splitwise-logik)

### Vad:
Appen rÃ¤knar automatiskt ut exakt vem som ska betala vem, oavsett hur komplex konstellationen av rÃ¤kningar och konton Ã¤r.

### Hur:
All matematik sker i `calculateMonth(state, monthId)` i `src/store.ts`:

1. **Identifiera konton:** Systemet separerar `sharedAccounts` (gemensamma) och `personAccounts` (personliga).
2. **BerÃ¤kna skulder (`liabilities`):** FÃ¶r varje rÃ¤kning, baserat pÃ¥ `splitType`:
   - `'equal'` â†’ beloppet delas lika pÃ¥ alla personkonton.
   - `specificAccountId` â†’ 100% skuld fÃ¶r den personen.
3. **Automatisk Ã¶verfÃ¶ring (`isAutoTransfer`):** Om rÃ¤kningen har instÃ¤llningen `isAutoTransfer` satt hoppar `calculateMonth()` Ã¶ver att lÃ¤gga till den i `transfersToShared`. FrÃ¥n version 5.4 kan detta styras pÃ¥ personnivÃ¥:
   - `'all'` â†’ Inget krav pÃ¥ manuell Ã¶verfÃ¶ring genereras fÃ¶r *nÃ¥gon* person.
   - `accountId` (specifik person) â†’ Inget krav genereras enbart fÃ¶r *den specifika personen*, Ã¶vriga personer mÃ¥ste fortfarande fÃ¶ra Ã¶ver sin del manuellt.
   Detta innebÃ¤r att rÃ¤kningens belopp fortfarande syns i mÃ¥nadsvyn och rÃ¤knas med i hushÃ¥llets totala utgifter, men fjÃ¤rran Ã¶verfÃ¶ringssummorna i "SammanstÃ¤llning"-rutan minskar dÃ¤rmed automatiskt fÃ¶r de personer som har autogiro utan att man behÃ¶ver rÃ¤kna manuellt.
4. **RÃ¤kna balansen:** Om rÃ¤kningen Ã¤r pÃ¥ ett **delat konto** (t.ex. huskontot) â†’ varje person mÃ¥ste *fÃ¶ra Ã¶ver* sin andel (sÃ¥vida inte `isAutoTransfer` Ã¤r satt). Om rÃ¤kningen Ã¤r betald av en **person** direkt â†’ den personen fÃ¥r kredit, de andra debiteras.
5. **Splitwise-algoritm (Debt Simplification):** Balanserna sorteras i fordringsÃ¤gare och gÃ¤ldenÃ¤rer. Algoritmen parar ihop dem och skapar minimalt antal `SwishTransfer[]`-objekt.

### VarfÃ¶r:
KÃ¤rnan i hela appen. Oavsett om sambon tog elrÃ¤kningen och du tog hyran, fixar appen nettobeloppet pÃ¥ en brÃ¥kdel av en sekund. Eliminerar all manuell rÃ¤kning och missfÃ¶rstÃ¥nd. Med `isAutoTransfer` slipper man dessutom sitta och rÃ¤kna bort fasta stÃ¥ende order-belopp ur det som ska betalas manuellt varje mÃ¥nad.

---

## 8. MÃ¥nadsvy (Gemensamma rÃ¤kningar)

### Vad:
Huvudvyn dÃ¤r man varje mÃ¥nad fyller i belopp pÃ¥ sina rÃ¤kningar och markerar betalningar som genomfÃ¶rda.

### Hur (`src/components/MonthView.tsx`):
- Navigerar mellan mÃ¥nader via `â† FÃ¶regÃ¥ende` / `NÃ¤sta â†’` pilar (format: `YYYY-MM`).
- Visar bara rÃ¤kningar som ska betalas just den mÃ¥naden (filtrerat via `interval`-logik).
- Belopp sparas via `updateBillAmount(monthId, billId, amount)` â†’ direkt `upsert` i `month_bill_amounts`.
- **"HÃ¤mta siffror frÃ¥n fÃ¶rra mÃ¥naden"** (`copyFromPreviousMonth`): Kopierar belopp fÃ¶r alla olÃ¥sta rÃ¤kningar. Skickar en batch-`upsert` till `month_bill_amounts`.
- **"âœ… Markera som Ã¶verfÃ¶rt"**: Triggar `togglePaymentStatus()` â†’ `upsert` i `month_handled_payments`. SÃ¤tter `is_handled = true`. Kopplade inmatningsfÃ¤lt blir `disabled` och en `ðŸ”’`-ikon visas.

### VarfÃ¶r:
Varje mÃ¥nad Ã¤r unik (elrÃ¤kningar varierar, hyra Ã¤r fast). Att kunna kopiera fÃ¶rra mÃ¥naden sparar tid, och lÃ¥smekanismen skyddar mot rÃ¥kÃ¤ndringar efter att pengar redan Ã¤r Ã¶verfÃ¶rda.

---

## 9. Flexibilitet & "AllmÃ¤nna InstÃ¤llningar"

### Vad:
Appen Ã¤r helt dynamisk och oberoende av vilka personer som anvÃ¤nder den â€“ den passar en ensamstÃ¥ende, ett par eller kompisar som delar lÃ¤genhet.

### Hur:
I `âš™ï¸ InstÃ¤llningar â†’ AllmÃ¤nt` kan man:
- **Kryssa ur "Visa sammanstÃ¤llning"** â†’ dÃ¶ljer Swish- och Ã–verfÃ¶ringsrutorna. Sparas i `household_settings.show_summary` via `updateSettings()` â†’ `upsert`.
- **Dynamiska konton:** Inga hÃ¥rdkodade namn. Man kan radera, lÃ¤gga till och byta namn pÃ¥ konton fritt via `addAccount`, `removeAccount`, `updateAccount` â†’ direkt till `accounts`-tabellen. All matematik anpassar sig i realtid.

### VarfÃ¶r:
Appen ska inte vara lÃ¥st till "Andreas och Helena". Alla hushÃ¥llskonstellationer Ã¤r vÃ¤lkomna.

---

## 10. RÃ¤kningar & Intervall

### Vad:
Varje rÃ¤kning kan ha ett eget betalningsintervall â€“ varje mÃ¥nad, varannan mÃ¥nad eller specifika mÃ¥nader per Ã¥r.

### Hur:
`BillDefinition` och `PrivateBill` har fÃ¤ltet `interval: PaymentInterval`:
- `'all'` â€“ Varje mÃ¥nad.
- `'odd'` â€“ Udda mÃ¥nader (januari, mars, maj...).
- `'even'` â€“ JÃ¤mna mÃ¥nader (februari, april, juni...).
- `'custom'` â€“ Specifika mÃ¥nader. Lagras som `custom_months: integer[]` (1â€“12) i `bills`-tabellen.

I vyn filtreras rÃ¤kningarna via en `shouldShowBill(bill, monthNumber)`-funktion.

### VarfÃ¶r:
Verkliga rÃ¤kningar betalas inte alltid varje mÃ¥nad. El- och vattenrÃ¤kningar kan komma varannan mÃ¥nad. HushÃ¥llsavgifter kan komma bara pÃ¥ sommaren.

---

## 11. Privat Ekonomi (Helt separerad frÃ¥n Swish-logik)

### Vad:
En egen flik (`ðŸ”’ Privat`) dÃ¤r varje anvÃ¤ndare hanterar sina egna, privata utgifter som aldrig pÃ¥verkar den gemensamma utrÃ¤kningen.

### Hur:
- Privata rÃ¤kningar lagras i tabellen `private_bills` med `user_id: user.id` (inloggad anvÃ¤ndares UUID).
- Privata rÃ¤kningar skapas pÃ¥ *samma* stÃ¤lle som gemensamma (`âš™ï¸ InstÃ¤llningar â†’ RÃ¤kningar`), men med vÃ¤xeln **"ðŸ”’ Privat RÃ¤kning"** istÃ¤llet fÃ¶r "Gemensam RÃ¤kning".
- Varje anvÃ¤ndare kan stÃ¤lla in **"Dela hela min privata ekonomi"** i "Mina Sidor". Detta sÃ¤tter flaggan `share_private_economy = true` pÃ¥ deras profil i databasen.
- `PrivateView.tsx` visar en "dropdown"-lista hÃ¶gst upp dÃ¤r anvÃ¤ndare kan vÃ¤lja vilkens privata ekonomi de vill titta pÃ¥ (fÃ¶rutsatt att personen har delat sin). Siffrorna fÃ¶r nÃ¥gon annans ekonomi Ã¤r alltid lÃ¥sta fÃ¶r redigering (skrivskyddade).
- En grÃ¶n **"âœ… Markera mÃ¥nad som klar"**-knapp kÃ¶r `togglePrivateLock(monthId)` â†’ `upsert` i `private_month_locks`. StÃ¤nger mÃ¥naden och fÃ¶rhindrar vidare redigering.
- Belopp per mÃ¥nad sparas i `private_month_amounts` (en rad per rÃ¤kning och mÃ¥nad).
- UpplÃ¥sning sker via `âš™ï¸ InstÃ¤llningar â†’ ðŸ”’ LÃ¥s upp â†’ "Mina Privata LÃ¥s"`.

### Hur â€“ Arkivering (Papperskorgen):
- Raderade rÃ¤kningar tas aldrig bort frÃ¥n databasen. IstÃ¤llet sÃ¤tts flaggan `is_archived = true`.
- FÃ¶r att fÃ¶rhindra att gamla, raderade rÃ¤kningar smutsar ner framtida mÃ¥nader tillÃ¤mpas en smart filter-logik i UI:t: Om en rÃ¤kning Ã¤r arkiverad visas den **enbart** i mÃ¥nader dÃ¤r den redan har ett sparat belopp som Ã¤r **stÃ¶rre Ã¤n 0 kr**. Detta gÃ¶r att all historik och matematik bibehÃ¥lls fÃ¶r gamla mÃ¥nader, medan rÃ¤kningen Ã¤r permanent osynlig i nya mÃ¥nader.

### Hur â€“ KringgÃ¥ende av RLS vid instÃ¤llningsÃ¤ndringar (RPC Bypass):
- Tidigare hanterades Ã¤ndring av `share_private_economy` via standard PostgreSQL `UPDATE`-kommandon. Dock pÃ¥verkades detta starkt av RLS-policys, vilket skapade en konflikt (och infinite recursion) vid vissa tabelluppslagningar nÃ¤r policyn fÃ¶rsÃ¶kte kolla i sig sjÃ¤lv.
- Ã„nnu vÃ¤rre var att klienten kraschade tyst i `loadCloud` pÃ¥ grund av saknade databaskolumner (exempelvis `display_name`).
- LÃ¶sningen Ã¤r nu **"RPC Bypass"**. Appen anvÃ¤nder en *Remote Procedure Call* (`toggle_share_private_economy`) som kÃ¶rs med `SECURITY DEFINER` pÃ¥ databasnivÃ¥n. Detta tillÃ¥ter appen att ignorera standard-RLS just fÃ¶r detta specifika Ã¤ndamÃ¥l, vilket garanterar att datan sparas Ã¤ven i strikt lÃ¥sta miljÃ¶er. Samtidigt anvÃ¤nder UI:t e-postadress istÃ¤llet fÃ¶r obefintliga kolumner.

### Hur â€“ Skapandedatum (`start_month`):
- NÃ¤r en ny rÃ¤kning (privat eller gemensam) skapas, stÃ¤mplas den med den aktuella mÃ¥naden (`YYYY-MM`) i kolumnen `start_month`.
- Systemet filtrerar automatiskt bort rÃ¤kningen frÃ¥n vyer och berÃ¤kningar som avser mÃ¥nader fÃ¶re `start_month`. Detta fÃ¶rhindrar att nya utgifter plÃ¶tsligt dyker upp "bakÃ¥t i tiden" i gammal historik.

### VarfÃ¶r:
HushÃ¥llsmedlemmar vill ha en komplett bild av *all* sin ekonomi pÃ¥ ett stÃ¤lle. Privata kostnader ska *aldrig* rÃ¤knas in i den gemensamma Swish-uppgÃ¶relsen. Global delning ger transparens fÃ¶r par som vill se varandras helhetsbild, utan att blanda ihop matematiken.

---

## 12. Skulder & LÃ¥nespÃ¥rning (Avbetalningskontroll)

### Vad:
MÃ¶jlighet att markera en rÃ¤kning (privat eller gemensam) som ett lÃ¥n/skuld med en ursprunglig totalsumma. EkonomiTB visar en visuell progress-bar som krymper varje gÃ¥ng en mÃ¥nad lÃ¥ses.

### Hur:
- `bills` och `private_bills` i databasen har kolumnerna `is_loan boolean` och `total_debt numeric`.
- I `âš™ï¸ InstÃ¤llningar â†’ RÃ¤kningar` finns kryssrutan **"ðŸ’³ Detta Ã¤r en skuld/ett lÃ¥n som ska betalas av Ã¶ver tid"**. NÃ¤r den kryssas i visas ett fÃ¤lt fÃ¶r ursprunglig skuldsumma.
- I `EkonomiTB` berÃ¤knas `paidSoFar` dynamiskt: fÃ¶r varje lÃ¥st mÃ¥nad summeras inmatat belopp fÃ¶r den rÃ¤kningen.
- Formeln: `remaining = max(0, totalDebt - paidSoFar)`, `progress = min(100, paidSoFar / totalDebt * 100)`.
- Progress-baren visas i sektionen **"ðŸ’³ Skulder & LÃ¥n"** i EkonomiTB.
- NÃ¤r `progress >= 100` visas "ðŸŽ‰ Fullt betald!" med grÃ¶n fÃ¤rg.

### VarfÃ¶r:
Det Ã¤r motiverande att visuellt se hur ett lÃ¥n krymper. IstÃ¤llet fÃ¶r att rÃ¤kna manuellt vet man alltid exakt hur mycket som Ã¤r kvar att betala.

---

## 13. SÃ¤kerhetslÃ¥s (KontolÃ¥s)

### Vad:
NÃ¤r en betalning Ã¤r genomfÃ¶rd fryses siffrorna fÃ¶r att fÃ¶rhindra oavsiktliga Ã¤ndringar.

### Hur:
- **Gemensam MÃ¥nadsvy:** "âœ… Markera som Ã¶verfÃ¶rt" kÃ¶r `togglePaymentStatus()` â†’ `upsert` i `month_handled_payments` med `is_handled = true`. InmatningsfÃ¤lt kopplade till det kontot blir `disabled`.
- **Privat Vy:** "âœ… Markera mÃ¥nad som klar" kÃ¶r `togglePrivateLock()` â†’ `upsert` i `private_month_locks` med `is_locked = true`. Alla inmatningsfÃ¤lt lÃ¥ses.
- **UpplÃ¥sning:** Via `âš™ï¸ InstÃ¤llningar â†’ ðŸ”’ LÃ¥s upp`. Uppdelat i tvÃ¥ sektioner:
  - **Gemensam MÃ¥nadsvy** â€“ Lista per mÃ¥nad med konto-namn och "ðŸ”“ LÃ¥s upp"-knapp â†’ sÃ¤tter `is_handled = false` fÃ¶r berÃ¶rda payment_ids via `upsert`.
  - **Mina Privata LÃ¥s** â€“ Lista per mÃ¥nad och "ðŸ”“ LÃ¥s upp"-knapp â†’ sÃ¤tter `is_locked = false`.

### VarfÃ¶r:
Pengar Ã¤r redan Ã¶verfÃ¶rda â€“ det ska inte gÃ¥ att rÃ¥ka Ã¤ndra siffran efterÃ¥t och fÃ¶rstÃ¶ra utrÃ¤kningen fÃ¶r hela mÃ¥naden.

---

## 14. AI-driven Felskrivningskontroll (Anomalidetektion)

### Vad:
Skyddar mot "fat-fingers" â€“ att rÃ¥ka skriva in fel belopp (t.ex. 10 000 istÃ¤llet fÃ¶r 1 000).

### Hur:
- Systemet hÃ¥ller koll pÃ¥ de senaste 3+ mÃ¥nadernas historik per rÃ¤kning.
- Om ett nytt belopp avviker mer Ã¤n **50% frÃ¥n det historiska minimumet** (fÃ¶r lÃ¥gt) eller **50% frÃ¥n det historiska maximumet** (fÃ¶r hÃ¶gt) triggas ett larm.
- FÃ¤ltet markeras rÃ¶tt och en dialogruta visas: **"â†©ï¸ Ã…ngra"** (Ã¥terstÃ¤ller till fÃ¶rra vÃ¤rdet) eller **"âœ… OK"** (bekrÃ¤ftar att avvikelsen Ã¤r korrekt).
- BekrÃ¤ftade avvikelser sparas via `confirmAnomaly()` â†’ `upsert` i `month_confirmed_anomalies` (eller `private_month_anomalies` fÃ¶r privata).
- BekrÃ¤ftade anomalier rÃ¤knas inte lÃ¤ngre som avvikelser fÃ¶r just det beloppet.
- Fungerar identiskt i gemensam och privat vy.

### VarfÃ¶r:
En etta fÃ¶r mycket pÃ¥ slutet kan fÃ¶rstÃ¶ra hela mÃ¥nadskalkylen. Systemet agerar som en smart sÃ¤kerhetsventil utan att stÃ¶ra normalt arbetsflÃ¶de.

---

## 15. Analys & EkonomiTB (Statistik)

### Vad:
Historisk data visualiserad med interaktiva grafer och tabeller.

### Hur (`src/components/Statistics.tsx`):
- **Gemensam Statistik:** Gemensamma kostnader per konto, Huskonto-summor, Swish-historik, "StÃ¶rsta fÃ¶rÃ¤ndringarna" (movers) mellan mÃ¥nader.
- **Privat Statistik:** Filtrerar pÃ¥ `bill.userId === user.id` och visar *enbart* dina egna privata utgifter.
- **Skulder & LÃ¥n:** Sektion med progress-bars (se kapitel 12), i rÃ¤tt flik beroende pÃ¥ om lÃ¥net Ã¤r privat eller gemensamt.
- **Excel-Export:** Knappen "ðŸ’¾ Ladda ner Excel" (`src/excel.ts`) genererar en `.xlsx`-fil via biblioteket `xlsx` med **tre flikar**:
  1. `Gemensamma RÃ¤kningar` â€“ Pivot-tabell per rÃ¤kning och mÃ¥nad.
  2. `Swish & Ã–verfÃ¶ringar` â€“ Historik fÃ¶r alla Swish-rekommendationer.
  3. `Mina Privata RÃ¤kningar` â€“ Enbart inloggad anvÃ¤ndares privata data.

### VarfÃ¶r:
Att se sin ekonomi som grafer och tabeller ger en kÃ¤nsla av kontroll. Utan historik vet man inte om kostnaderna Ã¶kar eller minskar. Excel-exporten Ã¤r en sÃ¤kerhetskopia och mÃ¶jliggÃ¶r avancerad analys utanfÃ¶r appen.

---

## 16. HushÃ¥llsadministration & GDPR

### Vad:
SÃ¤ker och tydlig hantering av vilka som Ã¤r med i hushÃ¥llet, vem som fÃ¥r bjuda in, samt verktyg fÃ¶r att radera all personlig data (GDPR-efterlevnad).

### Hur:
- **Medlemslista & Kick-funktion:** PÃ¥ "Mina Sidor" hÃ¤mtas hushÃ¥llets medlemmar asynkront via tabellen `profiles`. Om inloggad anvÃ¤ndare har rollen `owner`, ges behÃ¶righet att klicka pÃ¥ en "Kicka ut"-knapp fÃ¶r vanliga medlemmar. Funktionen skapar ett nytt, tomt hushÃ¥ll och kastar omedelbart dit den utsparkade medlemmen sÃ¥ att inga krascher uppstÃ¥r och de fÃ¶rlorar tillgÃ¥ngen till er delade data.
- **Dynamiskt Grundarskydd (Founder Protection):** Ett hushÃ¥lls grundare (den vars profilrad har det allra Ã¤ldsta `created_at` i hushÃ¥llet) Ã¤r numera helt osÃ¥rbar. Ã„ven om en "owner" fÃ¶rsÃ¶ker, fÃ¶rsvinner knapparna fÃ¶r degradering och utsparkning automatiskt i UI:t fÃ¶r Grundaren. Denna logik Ã¤r inte hÃ¥rdkodad utan 100% dynamisk baserat pÃ¥ uppkomst i databasen.
- **Skyddade Inbjudningar:** Inbjudningskoden och blocket fÃ¶r molnsynk visas exklusivt fÃ¶r Ã¤garen. Vanliga medlemmar fÃ¥r enbart en ren informationsvy Ã¶ver att de Ã¤r med.
- **LÃ¤mna hushÃ¥ll:** Knappen **"ðŸšª LÃ¤mna och skapa eget hushÃ¥ll"** kÃ¶r `handleCreateHousehold()` fÃ¶r anvÃ¤ndare som frivilligt vill hoppa av. Samma mekanism (nytt UUID via `crypto.randomUUID()`) kÃ¶rs. Den gamla hushÃ¥llsdatan Ã¤r orÃ¶rd fÃ¶r de som Ã¤r kvar.
- **GDPR SjÃ¤lvradering:** En dedikerad och permanent rÃ¶d knapp, "Radera mitt konto fÃ¶r alltid", finns placerad oavsett hushÃ¥llsstatus. Raderingen anropar `delete_user`-funktionen i databasen som rensar autentiseringsidentiteten och lÃ¥ter PostgreSQL:s `ON DELETE CASCADE` radera all profilinformation och privata rÃ¤kningar.
- **AnvÃ¤ndarvillkor & Integritetspolicy (ToS):** Ett nytt lager av juridisk sÃ¤kerhet (`TermsModal.tsx`) Ã¤r infÃ¶rt som interceptar anvÃ¤ndaren vid fÃ¶rsta inloggningen efter skapandet av kontot. AnvÃ¤ndaren mÃ¥ste expliciet godkÃ¤nna villkoren fÃ¶r att komma in i appen. Detta val lagras i en ny boolean-kolumn `tos_accepted` i `profiles`-tabellen via appens Context-state, vilket gÃ¶r att rutan endast visas en gÃ¥ng per anvÃ¤ndare.
- **Glömt Lösenord & E-post-återställning:** Inloggningsskärmen (`LoginScreen.tsx`) hanterar lösenordsåterställning genom att anropa Supabase API (`resetPasswordForEmail`). När användaren klickar på återställningslänken i e-postmeddelandet skickas de tillbaka till appen med en speciell URL-hash (`#access_token=...&type=recovery`). Applikationen (`App.tsx` & `AuthContext.tsx`) interceptar detta tillstånd och renderar en dedikerad vy (`UpdatePassword.tsx`) istället för den vanliga inloggningen. Denna vy tillåter användaren att skriva in sitt nya lösenord och tvingar därefter fram en ny inloggning, vilket eliminerar risken för korrupta sessioner. Detta hanterar även "reset epost" flöden säkert.
- **SÃ¤ker Minnesrensning (Zustand Wipe):** Vid `signOut` triggas appens globala `cleanup()`-funktion. FÃ¶rutom att kasta inloggningstoken, tvÃ¥ngsÃ¥terstÃ¤ller den omedelbart React-appens hela in-memory state till `DEFAULT_STATE`. Detta hindrar att skÃ¤rmen drÃ¶jer kvar med kÃ¤nslig data om en ny anvÃ¤ndare direkt registrerar sig i samma webblÃ¤sarfÃ¶nster.

---

## 17. Filstruktur och Ansvar

| Fil | Ansvar |
|-----|--------|
| `src/supabase.ts` | Supabase-klient och anslutningskonfiguration. |
| `src/AuthContext.tsx` | Autentisering, registrering, sessionshantering, hushÃ¥llsskapande. |
| `src/types.ts` | All datastruktur: `AppState`, `BillDefinition` (inkl. `isLoan`, `totalDebt`, `isAutoTransfer`), `PrivateBill`, `PrivateMonthData`, `MonthData`, `Account`, `SwishTransfer`, `CalculationResult`. |
| `src/migrateToRelational.ts` | EngÃ¥ngsskript som automatiskt migrerar gammal `state_json` till de nya relationstabellerna vid uppstart. AnvÃ¤nder `upsert` â€“ kan kÃ¶ras om utan bieffekter. |
| `src/store.ts` | Appens hjÃ¤rna: `useStore()` (parallell inlÃ¤sning frÃ¥n alla tabeller, realtidsprenumeration, optimistisk UI, alla CRUD-mutationer), `calculateMonth()` (Splitwise-matematik). |
| `src/App.tsx` | Rotkomponent, routing (hamburgermeny mobil / knappar desktop), hamburgermeny-state, kopplar alla store-actions till komponenter. |
| `src/excel.ts` | Genererar Excel-filen med tre flikar via `xlsx`-biblioteket. |
| `src/components/MonthView.tsx` | Gemensam mÃ¥nadsvy: inmatning, kopiera fÃ¶rra mÃ¥naden, betalningsmarkering, lÃ¥s-visning. |
| `src/components/PrivateView.tsx` | Privat vy: filtrerar `privateBills` pÃ¥ `userId`, inmatning, lÃ¥sning av privata mÃ¥nader. |
| `src/components/Summary.tsx` | Sammanfattningsrutan med Swish- och Ã–verfÃ¶ringsrekommendationer. |
| `src/components/Statistics.tsx` | EkonomiTB: grafer (recharts), skuld-progress-bars, Excel-knapp, Gemensam/Privat-vÃ¤xel. |
| `src/components/ManageBills.tsx` | InstÃ¤llningspanelen: RÃ¤kningar (inkl. LÃ¥n-kryssruta och Automatisk Ã¶verfÃ¶ring-kryssruta), Konton, LÃ¥s upp (uppdelat Gemensam/Privat), AllmÃ¤nt. Responsiv flik-layout (knappar pÃ¥ dator, `<select>`-rullgardin pÃ¥ mobil). |
| `src/components/MyPages.tsx` | Mina sidor: e-post/lÃ¶senordsÃ¤ndring, hushÃ¥llskod, lÃ¤mna hushÃ¥ll. |
| `src/index.css` | Hela appens design: mÃ¶rkt glassmorphism-tema, CSS-variabler, mobilmedia-queries, hamburgermeny-animationer, `.settings-tabs-desktop` / `.settings-tabs-mobile`-klasser. |
| `src/components/InstallPrompt.tsx` | Custom installationsruta (PWA A2HS) som fÃ¥ngar Android-installationer och guidar iOS-anvÃ¤ndare. |
| `vite.config.ts` | Vite + PWA-konfiguration (Service Worker, manifest, caching-strategi). |
| `SYSTEM_DOKUMENTATION.md` | Denna fil. FullstÃ¤ndig teknisk och funktionell dokumentation av hela systemet. |

---

## 18. Enterprise-uppgradering (Fas 1-3)
### Vad:
FÃ¶rvandlingen av appen frÃ¥n ett robust hobby-projekt till en fullfjÃ¤drad "Enterprise" SaaS-produkt. 

### Hur (De 3 Faserna):
**Fas 1: Tydlig Felhantering & Code Splitting (React Suspense)**
- Alla databasanrop hanteras av en global wrapper (`safeDb`) som fÃ¥ngar fel och visar snygga, icke-blockerande popups (React Hot Toast) om t.ex. nÃ¤tverket bryts. Inga "tysta fel" existerar lÃ¤ngre.
- Tunga vyer som `Statistics.tsx` laddas med `React.lazy()` och `<Suspense>`. Det gÃ¶r att appen startar omedelbart, och statistikmodulen hÃ¤mtas enbart nÃ¤r anvÃ¤ndaren klickar pÃ¥ fliken "EkonomiTB".

**Fas 2: Modern TillstÃ¥ndshantering (Zustand)**
- Gammal "Prop Drilling" (dÃ¤r variabler skickas genom lager pÃ¥ lager av komponenter) Ã¤r helt eliminerad. 
- Appens tillstÃ¥nd hanteras nu av `Zustand` (en state manager). Varje komponent prenumererar direkt pÃ¥ exakt den data den behÃ¶ver. Detta gÃ¶r appen blixtsnabb att bygga och skala, och tar bort enorma mÃ¤ngder Ã¶verflÃ¶dig kod i `App.tsx`.
- SÃ¤kerhetshÃ¶jning fÃ¶r versionshantering: Den kritiska `.env`-filen som innehÃ¥ller Supabase-nycklar har raderats frÃ¥n Git-historiken fÃ¶r att skydda databasen.

**Fas 3: "Bulletproof" Backend-SÃ¤kerhet (Zod & SQL Constraints)**
- All inmatning frÃ¥n anvÃ¤ndaren valideras nu pÃ¥ klientnivÃ¥ via biblioteket `Zod`. Det kontrollerar form och orimliga vÃ¤rden (exempelvis att ett rÃ¤kningsnamn inte Ã¤r tomt och att belopp alltid Ã¤r $\ge$ 0) *innan* det sparas. 
- Som ett extra lÃ¥s har vi lagt in `CHECK Constraints` pÃ¥ databasnivÃ¥ i Supabase. Ã„ven om klientkoden ignoreras eller hackas kommer databasen att totalvÃ¤gra att registrera felaktig data (t.ex. negativa skulder eller obefintliga namn).

**Fas 4: "Enterprise Slutputs" (OÃ¤ndlig Skalbarhet & Optimistic Rollbacks)**
- **Paginering / Lazy Loading:** IstÃ¤llet fÃ¶r att ladda ner hela hushÃ¥llets historik pÃ¥ en gÃ¥ng vid uppstart, hÃ¤mtas initialt enbart transaktioner fÃ¶r det *innevarande Ã¥ret* (plus december fÃ¶rra Ã¥ret fÃ¶r Ã¶vergÃ¥ngar). Om anvÃ¤ndaren skrollar tillbaka till ett tidigare Ã¥r triggas en asynkron bakgrundsladdning (`loadYear`). Appen behÃ¥ller sin supersnabba uppstartstid ($\sim$ 0.1s) Ã¤ven med 20 Ã¥rs data.
- **Optimistic UI Rollbacks:** Om en nÃ¤tverkssparning (`safeDb`) misslyckas efter att en anvÃ¤ndare klickat (t.ex. pÃ¥ grund av brutet internet eller att SQL-reglerna blockerade en felaktig siffra), kÃ¶r appen automatiskt en rollback. Siffran pÃ¥ skÃ¤rmen "hoppar tillbaka" till sitt ursprungliga vÃ¤rde, vilket helt eliminerar risken fÃ¶r att anvÃ¤ndargrÃ¤nssnittet och databasen hamnar i osynk.

**Fas 5: "The Final Polish" (Tester, BehÃ¶righeter & GDPR)**
- **BehÃ¶righetsnivÃ¥er (RBAC):** IstÃ¤llet fÃ¶r att alla anvÃ¤ndare i ett hushÃ¥ll Ã¤r administratÃ¶rer ("owner") har appen nu ett rollsystem. Den som skapar hushÃ¥llet blir `owner` och fÃ¥r ensamrÃ¤tt pÃ¥ att radera gemensamma konton, rÃ¤kningar och Ã¤ndra instÃ¤llningar. Inbjudna medlemmar blir `member` och kan lÃ¤gga till nya gemensamma utgifter, men fÃ¥r ett avskalat grÃ¤nssnitt (LÃ¥st lÃ¤ge) fÃ¶r existerande instÃ¤llningar. En `owner` kan dock befordra en `member` till `owner` i "Mina Sidor". Eftersom Supabase RLS blockerar anvÃ¤ndare frÃ¥n att Ã¤ndra varandras profil-rader, hanteras denna befordran via en sÃ¤ker `RPC` (Remote Procedure Call)-funktion i databasen (`set_user_role`) som fÃ¶rbigÃ¥r RLS pÃ¥ ett sÃ¤kert sÃ¤tt.
- **SÃ¤kerhetskrav vid Ã¤ndringar:** FÃ¶r att byta lÃ¶senord eller e-postadress pÃ¥ "Mina Sidor" mÃ¥ste anvÃ¤ndaren nu fÃ¶rst verifiera sin identitet genom att skriva in sitt nuvarande lÃ¶senord (`signInWithPassword`).
- **KnapplÃ¥s:** NÃ¤r en Swish eller Ã–verfÃ¶ring markeras som utfÃ¶rd i Sammanfattningen (Summary.tsx), lÃ¥ses knappen omedelbart (`disabled`) fÃ¶r att fÃ¶rhindra oavsiktliga dubbelklick och av-markeringar. UpplÃ¥sning kan dÃ¤refter endast ske via InstÃ¤llningar -> LÃ¥s upp.
- **GDPR / SjÃ¤lvradering:** Ett SQL-skript (`delete_user`) kÃ¶rs i Supabase som gÃ¶r att anvÃ¤ndare, med ett enda klick frÃ¥n "Mina Sidor", kan radera sitt eget inlogg. Tack vare SQL Cascade raderas samtidigt alla kopplingar, profildata och privata rÃ¤kningar kopplade till detta inlogg frÃ¥n databasen. Inga spÃ¥r lÃ¤mnas kvar.
- **Automatiserade Tester (Vitest):** En testrobot verifierar logiken i appens berÃ¤kningar (t.ex. Splitwise-matematiken). Testerna kÃ¶rs obligatoriskt vid bygget (`npm run build`). Om framtida kodÃ¤ndringar skulle leda till ett rÃ¤knefel pÃ¥ ett Ã¶re, vÃ¤grar systemet att kompilera koden, vilket garanterar att en trasig applikation aldrig kan slÃ¤ppas.

---

## 19. Schemalagda Push-notiser & PÃ¥minnelser

### Vad:
Ett system fÃ¶r att skicka ut push-notiser till anvÃ¤ndarnas telefoner/datorer via webblÃ¤sarens Push API. Appen pÃ¥minner hushÃ¥llets medlemmar om att betala och markera sina gemensamma rÃ¤kningar som klara.

### Hur:
- **Databas & InstÃ¤llningar:** Tabellen `household_settings` har en kolumn `reminder_day` (1-31) dÃ¤r hela hushÃ¥llet enas om vilket datum notisen ska skickas ut.
- **Service Worker (`push-sw.js`):** En PWA Service Worker ligger i bakgrunden och lyssnar pÃ¥ `push`-event fÃ¶r att vÃ¤cka enheten och visa notisen (titel, ikon och body) Ã¤ven om appen Ã¤r helt nedstÃ¤ngd.
- **Prenumerationer (VAPID):** AnvÃ¤ndaren klickar pÃ¥ "Aktivera Push-notiser" under Mina Sidor. Klienten ber webblÃ¤saren om tillÃ¥telse, skapar en sÃ¤ker VAPID-prenumeration och sparar denna JSON i databastabellen `push_subscriptions` kopplad till `user_id`. (RLS ser till att man bara kan lÃ¤sa/skriva sina egna notiser). Ett "Testa notis"-verktyg skapades Ã¤ven fÃ¶r direkt verifikation lokalt i Service Workern.
- **BakgrundskÃ¶rning (Vercel Cron):** En Serverless Function i Vercel (`api/cron.js`) kÃ¶rs schemalagt varje dag (t.ex. klockan 10:00) enligt `vercel.json`. Koden:
  1. Kontrollerar dagens datum och hÃ¤mtar alla hushÃ¥ll som har `reminder_day == idag`.
  2. Kollar om *mÃ¥l-mÃ¥naden* Ã¤r lÃ¥st/klar (`month_handled_payments` har `is_handled = true`). MÃ¥l-mÃ¥naden rÃ¤knas ut smart: Om datumet Ã¤r 20:e eller senare kollar den nÃ¤stkommande kalendermÃ¥nad (eftersom lÃ¶nen anvÃ¤nds till nÃ¤sta mÃ¥nads rÃ¤kningar). Om datumet Ã¤r tidigt pÃ¥ mÃ¥naden kollar den innevarande mÃ¥nad.
  3. Om de INTE Ã¤r klara, hÃ¤mtas alla prenumerationer fÃ¶r anvÃ¤ndarna i det hushÃ¥llet.
  4. Node-paketet `web-push` skickar ut notisen med hjÃ¤lp av den privata VAPID-nyckeln (som ligger dold i Vercel Environment Variables). DÃ¶da prenumerationer (t.ex. om anvÃ¤ndaren bytt telefon) fÃ¥ngas via 404/410-statuskoder och stÃ¤das automatiskt bort frÃ¥n databasen.

### VarfÃ¶r:
PWA:er har ofta brustit i fÃ¶rmÃ¥gan att "vÃ¤cka" anvÃ¤ndaren likt native-appar. Genom att integrera Web Push, Service Workers och Vercel Cron fÃ¥r appen samma proaktiva egenskaper som vilken Bank-app som helst, vilket sÃ¤kerstÃ¤ller att ingen i hushÃ¥llet "glÃ¶mmer" att hantera sina rÃ¤kningar i tid.

---

## 20. SaaS, Stripe & Admin-infrastruktur

SmartEkonomi Ã¤r idag en fullvÃ¤rdig SaaS (Software as a Service) med en inbyggd betalvÃ¤gg och ett dolt, sÃ¤kert admin-system.

### 20.1 Det Dolda Kassavalvet (`admin_secrets`)
FÃ¶r att undvika att lagra kÃ¤nsliga nycklar (som Stripe Secret Key) hÃ¥rdkodade i Vercels kontrollpanel, har appen ett eget "kassavalv" direkt i databasen.
- Tabellen `admin_secrets` Ã¤r nedlÃ¥st med Strict RLS (Row Level Security). Endast anvÃ¤ndare inloggade med mejlen `apersson508@gmail.com` kan skriva och lÃ¤sa.
- En RPC-funktion `set_admin_secret` anvÃ¤nds av frontend (Admin-panelen) fÃ¶r att spara nycklarna sÃ¤kert.
- Backend (Vercel API) lÃ¤ser dessa nycklar asynkront vid varje betalning med hjÃ¤lp av `SUPABASE_SERVICE_ROLE_KEY` som helt fÃ¶rbigÃ¥r RLS.

### 20.2 Vercel Serverless Functions (API)
Stripe kommunicerar med tre dolda serverless-funktioner byggda i Node.js, placerade i root-mappen `/api`:
1. **`/api/create-checkout.js`**: Anropas nÃ¤r kunden klickar "BÃ¶rja prenumerera". Den hÃ¤mtar `STRIPE_SECRET_KEY` och `STRIPE_PRICE_ID` frÃ¥n kassavalvet, skapar en Stripe-session och returnerar en lÃ¤nk dit kunden skickas.
2. **`/api/stripe-webhook.js`**: En "lyssnare" som Stripe ropar pÃ¥ i smyg sÃ¥ fort en betalning gÃ¥r igenom eller misslyckas. Webkroken validerar Stripes kryptografiska signatur, hÃ¤mtar `household_id`, och uppdaterar kolumnen `stripe_status` ('active', 'past_due' eller 'canceled') i Supabase helt automatiskt i bakgrunden.
3. **`/api/create-portal.js`**: Anropas nÃ¤r anvÃ¤ndaren vill hantera sina kortuppgifter eller avsluta prenumerationen. Den hÃ¤mtar kundens Stripe Customer ID frÃ¥n databasen och skickar kunden till Stripes egna kundportal.

### 20.3 Master Switch & VIP-hantering
- **`global_settings`**: InnehÃ¥ller Master Switch fÃ¶r hela appen. Om `paywall_active` Ã¤r sann, kommer appen avbryta inlÃ¤sning av normala vyer och istÃ¤llet rendera `<PaywallModal />` fÃ¶r alla anvÃ¤ndare som har en `stripe_status` som Ã¤r 'trial', 'past_due' eller 'canceled'.
- **Prenumerationsinfo (`SubscriptionFeaturesModal`)**: PÃ¥ betalvÃ¤ggen finns en integrerad knapp som Ã¶ppnar en Ã¶verlagd informationsruta. DÃ¤r listas alla premiumfunktioner grafiskt fÃ¶r kunden (exempelvis Splitwise-matematik, Push-notiser, PWA, Separat Ekonomi) innan de genomfÃ¶r kÃ¶pet via Stripe.
- **VIP-system**: FÃ¶r vÃ¤nner och familj finns en VIP-sÃ¶kning i Admin-panelen. Via en RPC (`set_household_vip_by_email`) hittas hushÃ¥llet och statusen sÃ¤tts permanent till 'vip', vilket innebÃ¤r att betalvÃ¤ggen helt ignoreras fÃ¶r det hushÃ¥llet fÃ¶r all framtid, oavsett om Master Switchen Ã¤r PÃ… eller AV.
- **Admin Statistik (`get_admin_stats`)**: SystemadministratÃ¶ren har en unik Dashboard (`AdminDashboard.tsx`) som kringgÃ¥r det normala RLS-skyddet via en `SECURITY DEFINER`-funktion fÃ¶r att hÃ¤mta det exakta antalet registrerade medlemmar i systemet och totalt antal aktiva, betalande hushÃ¥ll.

---

## 21. Senaste UI/UX-uppdateringar & Insikter

Appens statistikdel och hanteringsflÃ¶de har kontinuerligt moderniserats fÃ¶r att ge en "Wow"-kÃ¤nsla och absolut tillfÃ¶rlitlighet.

### 21.1 Nya EkonomiTB (Insikter)
Statistik-vyn (`Statistics.tsx`) har byggts om i grunden:
- **"Glassmorphism" Design**: Ersatt Ã¤ldre grÃ¤nssnitt och tabeller med mÃ¶rka, transparenta kort med moderna indikatorer.
- **PÃ¥litlig Data-filtrering**: Koden filtrerar bort alla mÃ¥nader som inte har markerats som "hanterade" (`is_handled = true` eller `isLocked = true` fÃ¶r privata mÃ¥nader). Detta fÃ¶rhindrar att halvt ifyllda, framtida mÃ¥nader stÃ¶r statistik och genomsnittskostnader.
- **Smarta KPI:er**: Omedelbar Ã¶verblick av "Snittkostnad/mÃ¥nad", "Senaste mÃ¥nadens trend" (inklusive grÃ¶na/rÃ¶da pilar), "Dyrast/Billigast senaste mÃ¥naden", samt "Antal lÃ¥sta rÃ¤kningar".

### 21.2 Global LÃ¥sning (Total Summa)
FÃ¶r anvÃ¤ndare som aktiverat instÃ¤llningen fÃ¶r att visa "Total Summa" i mÃ¥nadsvyn (`showTopTotal`) finns nu en smidig "Markera som hanterad"-knapp direkt under totalsumman.
- Klick pÃ¥ denna knapp stÃ¤mplar mÃ¥naden med `payment_id = 'top_total_lock'`.
- Detta inaktiverar omedelbart alla inmatningsfÃ¤lt i hela mÃ¥naden och tystar Push-notisens Cron-jobb.
- UpplÃ¥sning sker sÃ¶mlÃ¶st via "LÃ¥s upp"-fliken under instÃ¤llningar.

### 21.3 Korrekt Lagring av SysteminstÃ¤llningar
Appens databas uppdaterades med kolumnen `show_top_total` i tabellen `household_settings`. Detta sÃ¤kerstÃ¤ller att anvÃ¤ndarens individuella vy-instÃ¤llningar (sÃ¥som att visa Total Summa) inte bara hanteras lokalt i klienten utan lagras permanent via `store.ts` och synkroniseras i realtid.

### 21.4 Offline-lÃ¤ge (NÃ¤tverksdetektion)
Tidigare kunde appen fÃ¶rsÃ¶ka spara data Ã¤ven vid bristande internetanslutning, vilket orsakade tysta fel och fÃ¶rlorad data nÃ¤r sidan laddades om. Nu Ã¤r samtliga mutationer i `store.ts` skyddade med `navigator.onLine`. Om anvÃ¤ndaren tappar tÃ¤ckningen, visas omedelbart en rÃ¶d fel-notis via `react-hot-toast` och sparningen avbryts direkt i klienten.

### 21.5 Historik & Arkivering av Data
IstÃ¤llet fÃ¶r att ladda ner all historisk data vid varje inloggning (vilket skulle bli lÃ¥ngsamt efter nÃ¥gra Ã¥rs anvÃ¤ndning) begrÃ¤nsas dataladdningen automatiskt till innevarande Ã¥r. FÃ¶r att Ã¤ndÃ¥ ge tillgÃ¥ng till historik finns nu en "HÃ¤mta Ã¤ldre Ã¥r"-knapp i *EkonomiTB*. Denna knapp anropar `loadYear(year)` on-demand och minskar initial laddningstid drastiskt, samtidigt som gammal data fÃ¶rblir 100% tillgÃ¤nglig.

---

## 22. Arkitekturella Designval & Filosofi

Under utvecklingen har vissa traditionella "Enterprise"-mÃ¶nster (som ofta fÃ¶reslÃ¥s av generella AI-verktyg) aktivt valts bort till fÃ¶rmÃ¥n fÃ¶r hastighet, prestanda och nollkostnads-drift. SmartEkonomi Ã¤r designad som en snabb PWA.

### 22.1 UtrÃ¤kningar (`calculateMonth`) sker i Frontend
Ett vanligt rÃ¥d Ã¤r att flytta tung logik till en backend-server fÃ¶r att isolera koden. I denna app sker istÃ¤llet alla Splitwise-utrÃ¤kningar direkt i React (anvÃ¤ndarens telefon/webblÃ¤sare). 
**VarfÃ¶r?** 
- **Blixtsnabbt grÃ¤nssnitt:** Genom att rÃ¤kna i klienten sker alla UI-uppdateringar pÃ¥ millisekunder. Ingen nÃ¤tverksladdning krÃ¤vs nÃ¤r anvÃ¤ndaren knappar in ett nytt belopp.
- **Noll serverkostnad:** All berÃ¤kningskraft lÃ¥nas av anvÃ¤ndarens enhet istÃ¤llet fÃ¶r att belasta Vercel/Supabase.
- **Offline-kapacitet:** Appen kan utfÃ¶ra matematiken Ã¤ven vid svajig uppkoppling.

### 22.2 RLS & Frontend som "Source of Truth"
I stÃ¤llet fÃ¶r att bygga en gigantisk Node.js/Python-backend fÃ¶rlitar sig appen pÃ¥ **Supabase RLS (Row Level Security)** som backend-skydd. 
- Frontend skÃ¶ter visuell statushantering (Optimistic UI).
- RLS skyddar datan sÃ¥ att ingen kan lÃ¤sa/skriva fel hushÃ¥lls data.
- RPC-funktioner anvÃ¤nds **endast** fÃ¶r sÃ¤kerhetskritiska uppgifter (som att uppgradera VIP-status eller spara Stripe-nycklar), vilket fÃ¶ljer best-practice fÃ¶r Supabase. Detta minskar behovet av "dubbel-logik" i en dedikerad backend.

### 22.3 Full Reload vs Patch-Sync
NÃ¤r en anvÃ¤ndare laddar eller Ã¤ndrar data anvÃ¤nder appen ofta en full reload av nuvarande Ã¥rets data (via `store.ts`), istÃ¤llet fÃ¶r avancerad patch-baserad synkronisering (som Redux + GraphQL-patches).
**VarfÃ¶r?** 
- Ett hushÃ¥lls data fÃ¶r ett helt Ã¥r Ã¤r extremt liten i kilobyte. Att ladda om allt gÃ¥r ofta pÃ¥ under 50 millisekunder.
- Det garanterar 100% dataintegritet. Avancerade patch-system introducerar stor risk fÃ¶r state-desync (ex. att en anvÃ¤ndare swishar baserat pÃ¥ inaktuella siffror). 

Dessa val gÃ¶r SmartEkonomi exceptionellt snabb, robust och nÃ¤stintill gratis att drifta, i full kontrast till tunga och trÃ¶ga Enterprise-arkitekturer.

---

## 23. DatabassÃ¤kerhet & Linter
Under systemets utveckling genomfÃ¶rdes en rigorÃ¶s granskning via Supabase Database Linter fÃ¶r att tÃ¤ppa till alla potentiella sÃ¥rbarheter:
- **Function Search Path Mutable:** Alla inbyggda RPC-funktioner (som `get_admin_stats`, `toggle_paywall` m.m.) har explicit tilldelats `SET search_path = ''` fÃ¶r att fÃ¶rhindra SQL-injection via spoofing av schema.
- **SECURITY DEFINER Access:** ExekveringsrÃ¤ttigheter fÃ¶r administrativa funktioner har Ã¥terkallats (`REVOKE EXECUTE`) frÃ¥n `PUBLIC` och `anon`-rollerna. Nu tillÃ¥ts endast inloggade (`authenticated`) anvÃ¤ndare att *fÃ¶rsÃ¶ka* anropa dessa (funktionerna validerar sedan ifall anvÃ¤ndaren Ã¤r Admin).
- **Leaked Password Protection:** Systemet Ã¤r fÃ¶rberett fÃ¶r att slÃ¥ pÃ¥ skyddet mot lÃ¤ckta lÃ¶senord via Supabase Auth-instÃ¤llningar.

---

## 24. Testning & KvalitetssÃ¤kring (QA)
SmartEkonomi har genomgÃ¥tt rigorÃ¶sa automatiska och manuella tester fÃ¶r att klassificeras som produktionsredo ("Live-ready"). Resultaten och metodiken finns detaljerat dokumenterad i en separat testrapport: [TEST_RAPPORT.md](TEST_RAPPORT.md).

### 24.1 Logik- och Enhetstester
HjÃ¤rtat i applikationen Ã¤r matematikmotorn i `store.ts` (`calculateMonth()`). Den testas via Vitest (`store.test.ts`) som sÃ¤kerstÃ¤ller att:
- "Splitwise"-logiken fungerar 100% balanserat.
- Skulder ("debts") och Ã¶verfÃ¶ringar ("transfers") fÃ¶rdelas exakt.
- Privata, gemensamma och autogiro-mÃ¤rkta rÃ¤kningar separeras korrekt och berÃ¤knas pÃ¥ rÃ¤tt individnivÃ¥.

### 24.2 Chaos Monkey & Stress Test
FÃ¶r att verifiera UI:ts tÃ¥lighet anvÃ¤ndes ett avancerat "Chaos Monkey"-testverktyg. Ett automatiserat robot-skript skapade ett anvÃ¤ndarkonto och framkallade extremt hÃ¶g last i webblÃ¤saren:
- Klickande mellan rutter (`/mypages`, `/month`, `/stats`) utan att invÃ¤nta animationer.
- Avbrytande av API-anrop frÃ¥n Onboarding-flÃ¶det.
- Testet lyckades inledningsvis identifiera en ovanlig React-loop (Maximum update depth exceeded) i `MyPages.tsx` som åtgärdades omedelbart genom att optimera Zustand-selectorns array-allokering.
- Efter rättningen kördes testet igen, och applikationen var **100% stabil** under intensiv belastning utan en enda varning i konsolen. All state-hantering (via Zustand) och optimering via `Suspense`/`lazy` hanterade kontextbyten felfritt.

### 24.3 End-to-End Test av Betalflödet (Stripe E2E)
Hela det fullständiga betalflödet har verifierats i en låst produktionsliknande miljö via Stripe Sandbox för att garantera att betalväggen är ogenomtränglig men ändå fungerar sömlöst för betalande kunder.
- **Admin-inmatning [GODKÄNT]:** Stripe-nycklar (Secret, Webhook, Price ID) valideras dynamiskt via Vercel-API:et. Systemet bekräftar omedelbart med en grön "Aktivt"-indikator om integrationen fungerar.
- **Paywall Modal [GODKÄNT]:** Betalväggen dyker upp korrekt och blockerar vyerna när master switchen är aktiverad. Administratörer (VIP) släpps igenom utan blockering, och vanliga användare kan säkert använda "Logga ut"-knappen utan att fastna.
- **Skapa Prenumeration [GODKÄNT]:** Stripe Checkout-session genereras felfritt via `/api/create-checkout.js` och tvingar fram 14 dagars gratis provperiod. Test-kreditkort går igenom framgångsrikt.
- **Webhook-synkronisering [GODKÄNT]:** Efter kassan anropar Stripe appens `/api/stripe-webhook.js` i bakgrunden. Koden uppdaterar `stripe_status` till `active` i databasen vilket låser upp hela appen för kunden i realtid.
- **Customer Portal & Uppsägning [GODKÄNT]:** Användaren kan klicka sig in på Stripes säkra kundportal via "Mina sidor". Att avbryta prenumerationen (Cancel) hanteras korrekt av webkroken som omedelbart nedgraderar `stripe_status`, vilket låser kontot och visar betalväggen vid nästa inloggning.

Dessa tester garanterar att SmartEkonomi tåla verklighetsanpassad och extrem användning utan att förlora dataintegritet.

---

## 25. Re-branding & Senaste Funktionstillägg

Den senaste iterationen av applikationen innebar ett officiellt namnbyte från "Ekonomiapp / Ekonomi & Swish" till **SmartEkonomi** över hela projektet (inklusive domän, PWA-manifest, e-postmallar och pakethanterare). Vidare implementerades flera viktiga förbättringar kring UX och marknadsföring.

### 25.1 Portals för Modaler (z-index fix)
Ett problem med CSS-stacking contexts (där modaler som `InfoModal` hamnade bakom login-rutan trots hög `z-index`) åtgärdades strukturellt. Genom att implementera **React Portals** (`createPortal` direkt till `document.body`) bryter nu modalerna sig fria från alla lokala CSS-begränsningar och garanteras rendera överst i applikationen oavsett var de anropas ifrån.

### 25.2 Dynamisk Kontaktinformation (Admin-styrd)
Sidfotens "Kontakt"-ruta har nu integrerats helt med `global_settings` och Admin-panelen. Administratören kan inte bara uppdatera företagets uppgifter, utan även **visa/dölja** enskilda fält (E-post, Telefon, Adress) via interaktiva checkboxes. Detta är implementerat via en case-insensitive säkerhetscheck i RPC:n `set_global_setting` (som nu använder `LOWER(auth.jwt()->>'email')` för att skydda mot fel i versalisering av admin-eposten).

### 25.3 Tydlig Marknadsföring (14 dagars provperiod)
Paywall-infrastrukturen har förtydligats för att öka konverteringen av nya användare:
- Checkout-koden i Vercel (`api/create-checkout.js`) skickar nu explicit med konfigurationen `subscription_data: { trial_period_days: 14 }` till Stripe. Detta tvingar automatiskt fram en 14-dagars gratis provperiod innan den första riktiga debiteringen genomförs, helt oberoende av manuella inställningar i Stripe Dashboard.
- En framträdande "💎 Prenumerera"-knapp ligger numera publikt i sidfoten. Den öppnar `SubscriptionFeaturesModal` (samma vy som används under Paywall) men utrustad med tydlig text om "Endast 59 kr/månad" och "Prova gratis i 14 dagar". Syftet är att besökare omedelbart ska förstå fördelarna och priset innan de skapar ett konto. Användarvillkoren har också uppdaterats för att återspegla dessa betalningsvillkor.

---

## 26. Onboarding & Psykologisk Värdeleverans

För att radikalt sänka tröskeln för nya användare, har onboarding-flödet ("setupen") designats om från grunden. Istället för att mötas av en tom skärm får användaren en guidad, interaktiv upplevelse (`OnboardingWizard.tsx`) baserad på psykologiska UX-principer.

### 26.1 "Quick Win" via One-Click-mallar
I första steget visas vanliga räkningar (t.ex. Hyra, El, Bredband) som klickbara "piller". Användaren behöver inte skriva något själv, vilket minimerar den kognitiva belastningen. De väljer bara de utgifter de har.

### 26.2 Förväntan (Build-up) och The WOW Moment
När användaren angett belopp för sina 3 första räkningar, bygger appen upp förväntan:
- **Loader-läge:** Skärmen visar tillfälligt *"Räknar ihop hushållets utgifter..."* med en roterande ikon i 2 sekunder. Denna artificiella fördröjning lurar hjärnan att förvänta sig en komplex beräkning (Aha-moment).
- **Värdeleverans & Konfetti:** Istället för att bara skjuta konfetti i ett vakuum, presenteras den summerade kostnaden för hushållet samtidigt som konfettiregnet startar. 
- **Solo Mode:** Om användaren inte har bjudit in en partner ännu, visas texten: *"Hushållets gemensamma utgifter: X kr. Med en partner blir din andel bara X/2 kr!"*. Detta kommunicerar det ekonomiska värdet av appen (Splitwise-uträkningen) omedelbart.

### 26.3 Semi-Optional Partner Commitment
Istället för att kräva att användaren direkt bjuder in sin partner under "setupen" (vilket skapar friktion), presenteras steget nu som en möjlighet efter att värdet redan bevisats.
- Koden och kopieringsfunktionen presenteras med rubriken *"Vill ni dela detta? (Rekommenderas)"*.
- En stor knapp under koden tillåter användaren att hoppa över steget (*"Hoppa över för nu - Ta mig till månadsvyn"*). 
- Detta skapar en känsla av kontroll och gör inbjudan till ett naturligt och fritt val istället för ett påtvingat formulär.

### 26.4 Magiskt färdig Månadsvy
För att säkerställa att momentum bibehålls när onboarding-guiden stängs, ändrades standardbeteendet i `MonthView.tsx`.
Sammanfattningsrutan ("Hushållets gemensamma utgifter" högst upp) tvingas nu vara synlig som standard för alla användare (såvida de inte aktivt går in i inställningarna och slår av den). Användaren möts alltså omedelbart av sin färdiga, uträknade total-summa snarare än bara en detaljerad lista, vilket förstärker "Wow"-upplevelsen.

---

## 27. Stripe Felsökning, Säkra Admin-kontroller & PWA-krav

För att göra systemet mer robust och minska supportärenden har vi infört tydligare felsökning och hanterat strikta webbläsarkrav.

### 27.1 Säker Validering av Stripe-kassavalvet (Vercel API)
Tidigare uppstod RLS-problem (Row Level Security) när Admin-panelen (frontend) skulle verifiera om Stripe-nycklarna sparats korrekt. 
- Lösningen är en ny Serverless-funktion `api/check-stripe.js` som körs i Vercel. 
- När administratören öppnar Dashboarden anropas detta API, som i sin tur använder `SUPABASE_SERVICE_ROLE_KEY` för att bypassa RLS och titta ner i `admin_secrets`-tabellen. 
- API:et returnerar antingen `{ active: true }` eller `{ active: false, reason: "Detaljerat felmeddelande" }`. 
- Admin-gränssnittet (`AdminDashboard.tsx`) renderar nu en oerhört tydlig och dynamisk statusbox (🟢 AKTIVT & INKOPPLAT eller 🔴 INTE AKTIVT med exakt orsak, t.ex. "Missing Vercel Envs" eller saknade nycklar).

### 27.2 Paywall "Escape Hatch" (Logga ut)
Tidigare dolde betalväggens backdrop hela menyn. Om en administratör loggade ut och en vanlig (obetald) användare loggade in i samma fönster, frystes skärmen på betalväggen utan möjlighet att logga ut eller byta konto.
- Lösningen: En "🚪 Logga ut"-knapp lades till i botten av `PaywallModal.tsx`. 
- Vidare uppdaterades `App.tsx` så att `currentView` *alltid* tvångsåterställs till `'month'`-vyn via en `useEffect` när en användare byts, vilket eliminerar risken att obehöriga renderar ett tomt admin-skal.

### 27.3 PWA-installation & Service Worker Fetch-krav
Ett doldt krav för Android/Chrome för att betrakta en hemsida som en fullvärdig PWA (och visa popupen "Lägg till på hemskärmen" / `beforeinstallprompt`) är att det måste finnas en aktiv Service Worker med en giltig `fetch`-lyssnare.
- Tidigare `main.tsx` raderade ("unregister") aktivt alla Service Workers, vilket effektivt stängde av PWA-installationsfunktionen.
- Koden har nu skrivits om så att `navigator.serviceWorker.register('/push-sw.js')` körs konsekvent vid sidladdning.
- `public/push-sw.js` har kompletterats med en tom men nödvändig `self.addEventListener('fetch', ...)` för att passera Googles PWA-validering. Målet är att säkerställa att mobilrutan (nedladdningsprompten) *alltid* visas för nya användare på Android.

## Senaste Uppdateringar

* **Felhantering (Chunk Load Errors):** Lade till en automatisk omladdning i ErrorBoundary vid \Failed to fetch dynamically imported module\-fel, s� att nya releaser automatiskt laddas om ifall klienten har cache-problem.
* **Beh�ll inloggning vid fel:** �ndrade ErrorBoundary-knappen till att endast g�ra en \window.location.reload()\ ist�llet f�r att rensa \localStorage\. Detta f�rhindrar att anv�ndare blir ofrivilligt utloggade (d� Supabase auth token lagras d�r).
* **Playwright E2E-tester:** Lade till \@playwright/test\ f�r end-to-end testning. Ett f�rsta smoke test (\e2e/app.spec.ts\) har implementerats som startar appen och verifierar inloggningsvyn utan konsolfel. Kan k�ras via \
pm run test:e2e\.
* **Excel-export f�rb�ttringar:** P� fliken 'Gemensamma R�kningar' sorteras numera alla utgifter per konto-namn (Hus konto, Andreas konto, Helenas konto etc.) innan de ritas ut. Detta l�ste problemet med att utgifterna l�g osorterade / blandade.

  
* **Dynamiska Administratörer:** Byggt ett säkert gränssnitt i admin-panelen för att lägga till och ta bort systemadministratörer dynamiskt. Använder tabellen system_admins och is_user_admin() RPC.
* **Live-Chatt Kundtjänst:** Integrerat en realtids-chatt (Kundservice) byggd med Supabase Realtime för direktkommunikation mellan inloggade användare och admin.
  

## 28. Dynamisk Administratörshantering & Live-Chatt

För att göra appen mer skalbar och ge administratörer bättre verktyg, har två större funktioner lagts till i backend och frontend: ett dynamiskt system för att utse administratörer, samt en fullskalig chatt för kundservice i realtid.

### 28.1 Dynamiska Administratörer
Istället för att hårdkoda specifika e-postadresser för admin-behörighet, styrs detta nu via databasen.
- **`system_admins`:** En ny Supabase-tabell lagrar godkända e-postadresser (text, primary key).
- **`is_user_admin()`:** En ny PostgreSQL-funktion (RPC) som verifierar om inloggad användares (via `auth.jwt()`) e-post finns i tabellen. Denna används sedan både i Row Level Security (RLS) policies för att skydda andra tabeller, och av applikationen i start-laddningen.
- **Gränssnitt:** I `AdminDashboard.tsx` finns en separat flik där en administratör kan skriva in en e-postadress för att ge någon admin-rättigheter (läggs till i tabellen) eller klicka på en papperskorg för att ta bort rättigheterna (tas bort från tabellen). Inloggad admin kan ej ta bort sig själv.

### 28.2 Live-Chatt / Kundservice i Realtid
Ett komplett system för kundtjänst skapades för att möjliggöra direktkontakt mellan användare och support.
- **Databasstruktur:** 
  - `chat_sessions`: Hanterar aktiva ärenden (`id`, `user_id`, `status: waiting|active|closed`, `updated_at`).
  - `chat_messages`: Hanterar meddelanden i varje ärende (`id`, `session_id`, `sender_type: user|admin`, `message`, `created_at`).
  - `on_new_chat_message`: Databastrigger (Trigger) som automatiskt uppdaterar `updated_at` i sessionen vid varje nytt meddelande.
- **Användargränssnitt (`ChatBubble.tsx`):**
  - En flytande "💬"-bubbla i nedre högra hörnet visas för inloggade användare om chatten är öppen globalt.
  - Ogenomskinlig, mobilanpassad chattruta som ligger ovanpå allt annat.
  - Minimeringsfunktion `_` gör det möjligt att stänga ner rutan tillfälligt.
  - En röd notis-ikon (Badge) visar antalet olästa meddelanden om supporten svarar medan chatten är minimerad.
- **Admin-vy (`AdminChat.tsx`):**
  - Administratörer ser en realtids-kö med ärenden uppdelat i "Väntar" (Röd) och "Aktiv" (Grön).
  - Vänster kolumn visar alla sessioner (med uppslag mot `profiles` för att visa e-post), och höger kolumn är själva chattrutan.
  - Vyn är fullt mobilanpassad via flexibla CSS-klasser (`admin-chat-layout`) med smart radbrytning.
  - Knappen "Avsluta Ärende" markerar sessionen som `closed`. När användaren får denna statuslås textinmatningen för dem med ett meddelande om att starta en ny session.
- **Supabase Realtime:** 
  - Kommunikationen drivs av Supabase Channels (WebSockets). Klienterna prenumererar på inserts i `chat_messages`, och uppdateringar i `chat_sessions` för att omedelbart bygga om chattgränssnittet utan att sidladdning krävs.
  

### 28.3 Ytterligare Kundservice-funktioner (Senaste tilläggen)
För att förbättra kundupplevelsen och göra chattformattet mer professionellt har följande funktioner lagts till:
- **Behållen Chatthistorik:** Logiken i `ChatBubble.tsx` har ändrats så att användarens chatt inte längre rensas när de minimerar rutan (`isOpen = false`), även om ärendet har avslutats (`closed`). Historiken rensas lokalt *endast* om användaren uttryckligen klickar på `✕` (Stäng) efter att admin har stängt ärendet. Detta säkerställer att användaren hinner läsa kundtjänstens sista meddelande.
- **Kö-system i Realtid:** Om en kund startar en chatt och administratören inte är tillgänglig, pollar klienten nu var 15:e sekund för att se hur många andra sessioner som står före i kön (`created_at` äldre än nuvarande session med `status = 'waiting'`). Kunden ser då texten "Din köplats: X" i toppen av chatt-bubblan.
- **Notis-Badge för Olästa Meddelanden:** Om en användare har chattrutan minimerad och admin skickar ett meddelande, ökar en röd siffer-badge (`unreadCount`) på chattikonen. Denna nollställs omedelbart när användaren öppnar rutan igen.
- **Robust felhantering (.maybeSingle):** Databasanropet för att hämta aktiva sessioner ändrades från `.single()` till `.maybeSingle()` för att förhindra HTTP 406 (Not Acceptable) nätverksfel när ingen aktiv chatt hittades i databasen.
  

## 29. Äkta Web Push-notiser (Bakgrundsnotiser för Chatt & Påminnelser)

För att lösa problemet med att mobiltelefoner pausar JavaScript (och därmed stänger WebSocket-uppkopplingen) när skärmen låses eller appen hamnar i bakgrunden, har ett system för **Web Push-notiser** implementerats. Detta garanterar att notiser kommer fram och "plingar" även om appen är stängd.

### Vad
Två huvudsakliga push-funktioner har lagts till:
1. **Kundtjänst-notiser:** Meddelar omedelbart administratörer (i bakgrunden) när en kund skriver i live-chatten.
2. **Räknings-påminnelser:** Schemalagda notiser som skickas automatiskt till användare när det är dags att låsa månaden och betala räkningar.

### Hur
Infrastrukturen bygger på branschstandarden för PWA-notiser och består av följande delar:
- **Kryptering (VAPID):** Systemet använder VAPID-nycklar (`VAPID_PUBLIC_KEY` och `VAPID_PRIVATE_KEY` sparade som miljövariabler i Vercel) för att bevisa för Apple och Google att notiserna kommer från rätt avsändare.
- **Service Worker (`push-sw.js`):** En Service Worker är installerad på användarens enhet som "sover" i bakgrunden. När ett push-event tas emot från Apple/Google vaknar den till, ritar upp notisen och spelar upp telefonens standardljud.
- **Databas & Prenumerationer:** 
  - Administratörers unika prenumerationsnycklar (tokens) sparas i tabellen `admin_push_subscriptions`.
  - Vanliga användares nycklar sparas i `push_subscriptions`.
- **Utskick via Supabase Webhook (Chatt):** När en kund skriver ett meddelande (`INSERT` i `chat_messages`) triggas en Supabase Webhook. Webhooken gör ett anrop till backend-API:et `api/send-push.js` (på Vercel), som i sin tur kontaktar Apples/Googles servrar och skickar ut notisen.
- **Utskick via Vercel Cron (Räkningar):** Användare kan i "Mina Sidor" välja vilket datum (`reminder_day` i `household_settings`) de vill ha påminnelser. Ett schemalagt "Cron-jobb" via `vercel.json` anropar `api/cron.js` automatiskt klockan 10:00 (UTC) varje dag. API:et kollar vilka hushåll som ska påminnas just idag och skickar ut notiserna.
- **Gränssnitt:** "Notiser PÅ/AV"-knappar som frågar webbläsaren om tillåtelse via `PushManager` API:t finns implementerade i både `AdminChat.tsx` (för kundtjänst) och i `MyPages.tsx` (för räknings-påminnelser, med en dropdown för datum).

### Varför
Eftersom operativsystem som iOS har strikta batterisparfunktioner, dör "realtids-kopplingen" när skärmen släcks. Äkta Web Push-notiser är det enda tillförlitliga sättet att skicka tids- och händelsekritiska uppdateringar till användare som inte aktivt tittar på appen. Detta gör plattformen mycket mer robust, likvärdig med inbyggda native-appar från App Store.


---

## Push-notiser och Realtids-chatt (Avancerad Arkitektur)

### Översikt
Systemet för push-notiser är byggt för att kringgå aggressiva batteri-optimeringar och notis-blockeringar (särskilt på Samsung/Android). Det använder en kombination av Vercel Serverless Functions, Supabase Database, och en anpassad PWA Service Worker.

### 1. PWA & Android WebAPK (Manifestet)
För att Android ska acceptera webbappen som en "Äkta" app (vilket krävs för att få en egen notiskanal i inställningarna och inte klumpas ihop med Chrome), används "Maskable Icons" i PWA-manifestet (`vite.config.ts`).
Genom att ange `purpose: 'maskable'` tvingas Chrome att generera en WebAPK vid installation på hemskärmen, vilket ger appen fulla rättigheter till operativsystemets push-tjänster och kringgår Samsungs standard-blockeringar av webbläsar-notiser.

### 2. Bypass av Supabase Webhooks
Vi förlitar oss **inte** på Supabase Webhooks (`pg_net`) för att skicka notiser, eftersom detta ofta är instabilt och leder till fördröjningar. Istället skickar frontend-koden (`ChatBubble.tsx`) en direkt `POST`-request till Vercel-API:et (`/api/send-push`) i samma millisekund som meddelandet sparas i databasen. Detta garanterar omedelbar leverans utan mellanhänder.

### 3. VAPID-nycklar & Vercel
För att autentisera mot Googles (FCM) och Apples push-servrar används VAPID-nycklar. 
- **Frontend** bygger in den offentliga nyckeln via `import.meta.env.VITE_VAPID_PUBLIC_KEY` och ber användarens webbläsare om tillåtelse (`pushManager.subscribe`). Adressen sparas sedan i tabellen `admin_push_subscriptions`.
- **Backend (Vercel)** använder `VITE_VAPID_PUBLIC_KEY` och `VAPID_PRIVATE_KEY` inifrån Vercel Environment Variables för att signera signalen. Om dessa saknas vägras åtkomst med felet "Received unexpected response code".

### 4. Anti-Spam & Stör-Ej (Service Worker)
I `push-sw.js` finns avancerad logik för att förhindra dubbletter och oönskade notiser:
- **`isAppActive` (Stör Ej):** Innan notisen visas kollar Service Workern om appen redan är öppen och fokuserad på skärmen (`visibilityState === 'visible'`). Om den är det, avbryts push-notisen tyst, eftersom användaren ändå ser chatten uppdateras i realtid via WebSockets.
- **Tag-gruppering:** Vercel-servern skickar notisen med `tag: 'chat-message'`. Om flera notiser skickas samtidigt (t.ex. vid nätverkslagg), skriver operativsystemet över den föregående notisen så att användaren endast får ett enda "pling" istället för fyra stycken på rad.
- **Borttagen Lokal Notis:** Den inbyggda `showNotification()` inuti WebSocket-lyssnaren i `AdminChat.tsx` har tagits bort helt. Detta förhindrar att WebSocket-trafiken och Web Push-trafiken krockar och skapar dubbletter när appen körs i bakgrunden.

Denna arkitektur är industri-standard och säkerställer maximal driftsäkerhet på både iOS, Android och Desktop-miljöer.

## 30. Anpassningsbara Vyer & Inställningar (Ny Uppdatering)

### Vad
Den senaste uppdateringen fokuserar på att ge användarna full kontroll över vilka element som visas i applikationens vyer, samt hur push-notiser beter sig utifrån dessa val. Vyer har också bytt namn ("Månadsvy" heter nu "Gemensam") för att tydligare reflektera funktionaliteten.

### Varför
Tidigare var vissa rutor (som totalbelopp) hårdkodade och ibland duplicerade (i den privata vyn fanns både en fast ruta och en inställningsbar ruta). Dessutom ville användare kunna använda appen som en "klassisk utgiftskoll" utan att behöva låsa/markera räkningar som hanterade. Det fanns även en dubblett av datuminställningen för push-notiser som skapade förvirring. Detta löstes för att skapa ett renare, mer flexibelt gränssnitt som anpassar sig till användarens behov.

### Hur
- **Gemensam vy (tidigare Månadsvy):** Namnbytet genomfördes i hela navigeringsstrukturen (`App.tsx`). Låsknappen för totalbeloppet fick också en visuell uppdatering för att matcha övriga "Låst"-knappar (solid grön bakgrund, `var(--success-color)`).
- **Separata Totalsummor:** Inställningen för totalbelopp delades upp i två separata toggles i `ManageBills.tsx`: en för "Gemensam vy" (`showTopTotal`) och en för "Privat vy" (`showPrivateTopTotal`). Den hårdkodade totalrutan i `PrivateView.tsx` togs bort.
- **Hanteringsknappar (Lås & Hanterat):** En ny inställning `enableManagementButtons` lades till. När denna är urkryssad döljs alla knappar för att markera överföringar och totalbelopp som klara i `Summary.tsx` och `MonthView.tsx`.
- **Intelligenta Push-notiser:** Cron-jobbet (`api/cron.js`) som skickar ut påminnelser läser nu av `enable_management_buttons` direkt från databasen (`household_settings`). Om hushållet stängt av hanteringsknapparna hoppas hushållet över helt i utskicket (eftersom det inte finns något sätt för dem att markera räkningarna som klara ändå).
- **Städning av UI:** Inställningen för "Påminnelsedatum" togs bort från 'Allmänt' eftersom den var duplicerad och redan fanns under 'Mina Sidor' (där användaren även aktiverar sina push-prenumerationer). Varningstexten om historik flyttades från App-skalets rotnivå in direkt i `MonthView.tsx` så att den ligger naturligt under totalbelopps-rutan.
- **Databas (Schema):** För att bibehålla "Frontend som Source of Truth" för tillfälligt state, men ändå kunna styra Cron-jobbet, kompletterades `household_settings` med nya kolumner: `show_swish_summary`, `show_transfer_summary`, `enable_management_buttons`, och `show_private_top_total`.
