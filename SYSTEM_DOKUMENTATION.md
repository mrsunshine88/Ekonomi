# SmartEkonomi - Systemdokumentation

**Plattform:** React + TypeScript + Vite (PWA) | Databas: Supabase (PostgreSQL) | Hosting: Vercel  

---

## 1. Vad Ã¤r SmartEkonomi?

Det Ã¤r en webb-applikation (byggd i React, TypeScript och Vite) som automatiskt rÃ¤knar ut hur hushÃ¥llets gemensamma rÃ¤kningar ska delas. Den eliminerar behovet av minirÃ¤knare och kalkylark.

Appen stÃ¶der ett obegrÃ¤nsat antal gemensamma konton och personliga konton, och hanterar avancerad Splitwise-matematik i bakgrunden. Den Ã¤r byggd som en PWA (Progressive Web App) och fungerar som en riktig app pÃ¥ mobilen â€“ ingen App Store behÃ¶vs.

**Appens fem huvudvyer (i ordning uppifrÃ¥n och ner i menyn):**
- `ðŸ“… MÃ¥nadsvy` â€“ Gemensamma rÃ¤kningar, mata in belopp, markera som Ã¶verfÃ¶rda.
- `ðŸ”’ Privat` â€“ Personliga utgifter och privata lÃ¥n, synliga enbart fÃ¶r dig.
- `ðŸ“Š Statistik` â€“ Historisk statistik, grafer, skuld-avbetalningskontroll.
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
MÃ¶jlighet att markera en rÃ¤kning (privat eller gemensam) som ett lÃ¥n/skuld med en ursprunglig totalsumma. Statistik visar en visuell progress-bar som krymper varje gÃ¥ng en mÃ¥nad lÃ¥ses.

### Hur:
- `bills` och `private_bills` i databasen har kolumnerna `is_loan boolean` och `total_debt numeric`.
- I `âš™ï¸ InstÃ¤llningar â†’ RÃ¤kningar` finns kryssrutan **"ðŸ’³ Detta Ã¤r en skuld/ett lÃ¥n som ska betalas av Ã¶ver tid"**. NÃ¤r den kryssas i visas ett fÃ¤lt fÃ¶r ursprunglig skuldsumma.
- I `Statistik` berÃ¤knas `paidSoFar` dynamiskt: fÃ¶r varje lÃ¥st mÃ¥nad summeras inmatat belopp fÃ¶r den rÃ¤kningen.
- Formeln: `remaining = max(0, totalDebt - paidSoFar)`, `progress = min(100, paidSoFar / totalDebt * 100)`.
- Progress-baren visas i sektionen **"ðŸ’³ Skulder & LÃ¥n"** i Statistik.
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

## 15. Analys & Statistik (Statistik)

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
| `src/components/Statistics.tsx` | Statistik: grafer (recharts), skuld-progress-bars, Excel-knapp, Gemensam/Privat-vÃ¤xel. |
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
- Tunga vyer som `Statistics.tsx` laddas med `React.lazy()` och `<Suspense>`. Det gÃ¶r att appen startar omedelbart, och statistikmodulen hÃ¤mtas enbart nÃ¤r anvÃ¤ndaren klickar pÃ¥ fliken "Statistik".

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

### 21.1 Nya Statistik (Insikter)
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
IstÃ¤llet fÃ¶r att ladda ner all historisk data vid varje inloggning (vilket skulle bli lÃ¥ngsamt efter nÃ¥gra Ã¥rs anvÃ¤ndning) begrÃ¤nsas dataladdningen automatiskt till innevarande Ã¥r. FÃ¶r att Ã¤ndÃ¥ ge tillgÃ¥ng till historik finns nu en "HÃ¤mta Ã¤ldre Ã¥r"-knapp i *Statistik*. Denna knapp anropar `loadYear(year)` on-demand och minskar initial laddningstid drastiskt, samtidigt som gammal data fÃ¶rblir 100% tillgÃ¤nglig.

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


## 31. Förbättrad Användarupplevelse (UX/UI Uppdateringar)

### Vad
En omfattande upputsning av användargränssnittet i inställningarna och onboarding-flödet har genomförts. Fokus har legat på att göra det lättare att förstå funktioner utan att läsa långa manualer, samt att minska visuell "clutter" (rörighet).

### Varför
Tidigare kändes formulär och inställningar stela och otydliga (t.ex. dropdown-listor med långa beskrivande namn). Genom att använda moderna UI-mönster (steg-för-steg-guider, dolda fält tills de behövs, och visuella kort istället för select-boxar) sänks tröskeln för nya användare avsevärt.

### Hur
- **Visuell "Wow"-effekt vid Onboarding:** I slutet av onboarding-guiden visas nu en interaktiv sammanställning av hushållets valda standardräkningar. Totalbeloppet animeras från noll upp till slutsumman med hjälp av ett skräddarsytt `CountUp`-script (react-effekt) som höjer premium-känslan i applikationen.
- **Onboarding UUID Fix:** En bugg åtgärdades där Onboarding-guiden försökte spara kategorinamn (t.ex. "boende") i relations-databasen istället för det faktiska UUID:t för det Gemensamma Kontot. Koden `useStore` implementerades för att matcha rätt konto och skicka rätt `accountId`.
- **Smarta Formulär (Räkningar):** När man lägger till en ny räkning (i Hantera Räkningar) har fälten organiserats om:
  - En **rullgardin med "Vanliga räkningar..."** lades till bredvid inmatningsfältet för namn. Användaren kan snabbt välja t.ex. "El" så fylls textrutan i automatiskt.
  - Intervalls-knapparna ("Betalas varje månad" / "Välj månader") är nu **dolda** och visas enbart om användaren kryssar i rutan *"Varna med röd färg om jag glömmer fylla i denna"*.
  - Rutan för ursprunglig skuld/lån flyttades så den visas **direkt under** låne-kryssrutan, snarare än att ligga separerad i slutet av formuläret.
- **Skapa Konto UI-Overhaul:** Inställningarna för att lägga till nya konton/personer (under fliken Konton) byggdes om från rullgardiner till en 3-stegs guide ("1. Typ av konto", "2. Namn", "3. Hur tar kontot emot pengar?"). Layouten använder grid-baserade kort som klickas i, med mjuk och beskrivande text ("En person" vs "Ett gemensamt mål") istället för versaler och tekniska beskrivningar.
- **Rensning av Lås-vyn:** I inställningarna för "Lås upp månader/konton" togs de duplicerade knapparna för delade konton bort. Vyn visar nu istället en enda övergripande `Total kostnad (Hela månaden) 🔒`-knapp som låser upp hela månaden på ett klick, vilket speglar funktionaliteten i MonthView.
- **Förenklad Text:** Uttryck som *"Mottar pengar via Swish"* har bytts ut till det mer standardiserade *"Betalningsmetod: Swish"* för ett renare utseende.

## 32. Demo-läge för nya användare

### Vad
Ett låtsas-läge (mock-state) för helt nya användare (utan räkningar) där appen fylls med realistisk testdata, historik och låsta månader.

### Varför
För att minska tröskeln för nya användare att förstå appens värde. Genom att utforska färdig data i Gemensam vy och Statistik kan användaren se slutmålet innan de börjar bygga sin egen ekonomi.

### Hur
- Ett tillfälligt UI-state (isDemoMode, ealState) infördes i src/store.ts via Zustand.
- Funktionen startDemo() sparar undan den riktiga, tomma datan i minnet och ersätter statet med mock-konton ('Johan', 'Maria') och mock-räkningar.
- Spärrar lades in i samtliga state-mutationer (t.ex. updateBillAmount) så att if (get().isDemoMode) return; blockerar databasanrop (Supabase) när demo-läget är aktivt. Testdata kan alltså aldrig råka sparas för alltid.
- En stopDemo() funktion laddar tillbaka originaldatan från minnet.
- UI för 'Starta Demo' renderas endast i MonthView.tsx när listan på räkningar är helt tom (state.bills.length === 0).

## 31. Förbättrad Användarupplevelse (UX/UI Uppdateringar)

### Vad
En omfattande upputsning av användargränssnittet i inställningarna och onboarding-flödet har genomförts. Fokus har legat på att göra det lättare att förstå funktioner utan att läsa långa manualer, samt att minska visuell "clutter" (rörighet).

### Varför
Tidigare kändes formulär och inställningar stela och otydliga (t.ex. dropdown-listor med långa beskrivande namn). Genom att använda moderna UI-mönster (steg-för-steg-guider, dolda fält tills de behövs, och visuella kort istället för select-boxar) sänks tröskeln för nya användare avsevärt.

### Hur
- **Visuell "Wow"-effekt vid Onboarding:** I slutet av onboarding-guiden visas nu en interaktiv sammanställning av hushållets valda standardräkningar. Totalbeloppet animeras från noll upp till slutsumman med hjälp av ett skräddarsytt `CountUp`-script (react-effekt) som höjer premium-känslan i applikationen.
- **Onboarding UUID Fix:** En bugg åtgärdades där Onboarding-guiden försökte spara kategorinamn (t.ex. "boende") i relations-databasen istället för det faktiska UUID:t för det Gemensamma Kontot. Koden `useStore` implementerades för att matcha rätt konto och skicka rätt `accountId`.
- **Smarta Formulär (Räkningar):** När man lägger till en ny räkning (i Hantera Räkningar) har fälten organiserats om:
  - En **rullgardin med "Vanliga räkningar..."** lades till bredvid inmatningsfältet för namn. Användaren kan snabbt välja t.ex. "El" så fylls textrutan i automatiskt.
  - Intervalls-knapparna ("Betalas varje månad" / "Välj månader") är nu **dolda** och visas enbart om användaren kryssar i rutan *"Varna med röd färg om jag glömmer fylla i denna"*.
  - Rutan för ursprunglig skuld/lån flyttades så den visas **direkt under** låne-kryssrutan, snarare än att ligga separerad i slutet av formuläret.
- **Skapa Konto UI-Overhaul:** Inställningarna för att lägga till nya konton/personer (under fliken Konton) byggdes om från rullgardiner till en 3-stegs guide ("1. Typ av konto", "2. Namn", "3. Hur tar kontot emot pengar?"). Layouten använder grid-baserade kort som klickas i, med mjuk och beskrivande text ("En person" vs "Ett gemensamt mål") istället för versaler och tekniska beskrivningar.
- **Rensning av Lås-vyn:** I inställningarna för "Lås upp månader/konton" togs de duplicerade knapparna för delade konton bort. Vyn visar nu istället en enda övergripande `Total kostnad (Hela månaden) 🔒`-knapp som låser upp hela månaden på ett klick, vilket speglar funktionaliteten i MonthView.
- **Förenklad Text:** Uttryck som *"Mottar pengar via Swish"* har bytts ut till det mer standardiserade *"Betalningsmetod: Swish"* för ett renare utseende.


## 2026-06-13 Enterprise Säkerhet & Onboarding

- **Enterprise Admin-struktur:** Tabellen `system_admins` är nu ombyggd för högsta säkerhetsklassificering. Den använder `user_id` (UUID) som Primary Key med en Foreign Key-koppling direkt mot `auth.users(id)` och `ON DELETE CASCADE`. Detta innebär att om en admin raderar sitt konto utplånas deras admin-rättigheter omedelbart och permanent. Det förhindrar kontoövertagande ifall någon försöker registrera samma mejladress igen.

- **Strikt E-postbekräftelse:** E-postbekräftelse är tvingande. Nyskapade konton hamnar i `auth.users` med `email_confirmed_at = null` och kan inte logga in. För att förhindra missbruk har vi även infört en databasfunktion `check_email_confirmed()` som blockerar återställning av lösenord för konton som inte har bekräftat sin e-postadress. Detta eliminerar alla bakdörrar.

- **Självständig Onboarding:** Flödet för nya konton har städats upp. Tidigare dolda auto-skapanden av hushåll i `LoginScreen.tsx` har raderats. Nu hanterar `Onboarding.tsx` hela skapandet av hushållet på ett säkert sätt.

- **Rätt Standardinställningar:** Vid nyskapade konton (via Onboarding) initieras `household_settings` nu med strikta standardvärden: endast `show_top_total` och `enable_management_buttons` är aktiverade, medan Swish- och överföringssammanställningar är dolda från start. Som kontrast förblir alla funktioner påslagna när man klickar "Prova Demo" för att maximera upplevelsen för besökare.

## 33. Onboarding & RLS Felkorrigeringar (Bug Fixes)

### Vad
En serie kritiska buggar som gjorde att nya användare fastnade i loopar vid godkännande av användarvillkor, eller blev insläppta i appen utan konto, har identifierats och åtgärdats. Dessutom har 'Demoläge' och 'Live-chatt' lagts till i funktionerna för prenumeranter.

### Varför
När e-postbekräftelse slogs på (och Supabase PKCE-flöde började användas) uppstod en kedjereaktion:
1. **Misslyckad Profilskapelse:** Vid registrering skapades ingen session (pga krav på e-postbekräftelse). RLS-regeln för `profiles` krävde dock en aktiv session (`auth.uid() = id`) för att få göra en `INSERT`. Detta ledde till att nya konton aldrig fick någon profilrad i databasen.
2. **Loop i Policyn (Terms of Service):** När användaren sedan loggade in och godkände policyn, försökte koden uppdatera `tos_accepted = true` på en profil som inte fanns. Felet fångades inte av Supabase utan ignorerades (0 rader uppdaterades). Vid sidladdning trodde appen därför att policyn fortfarande var ogodkänd.
3. **Onboarding Bypass:** Koden för att visa 'Skapa Hushåll'-rutan utvärderade `state.accounts.length === 0`. Men vid frånkoppling/felaktig profil laddade Zustand `DEFAULT_STATE` (som innehöll dummy-konton med `length === 3`). Därmed trodde appen felaktigt att användaren redan hade konton och släppte in dem i applikationen direkt, utan rättigheter.

### Hur
- **Supabase Auth Trigger:** Skapade SQL-funktionen `handle_new_user` och en databastrigger (`AFTER INSERT ON auth.users`) som automatiskt skapar profilraden på server-sidan med admin-behörighet (Security Definer), vilket förbigår RLS och garanterar att profilen existerar redan innan bekräftelsemailet klickas.
- **RLS för Uppdateringar:** Implementerade `FOR UPDATE` RLS policy på `profiles`-tabellen för att uttryckligen tillåta användare att uppdatera sina egna rader (t.ex. `tos_accepted` och `role`).
- **Förbättrad Gate-logik:** Onboarding-rutan (`needsOnboarding`) i `App.tsx` triggas numera säkert av `!householdId` (kontrollerar ifall hushåll ID saknas helt) istället för att lita på `accounts.length`. Detta förhindrar helt att dummy-data släpper in obehöriga.
- **Förbättrad PKCE URL-detektion:** `AuthContext.tsx` kollar nu efter `code=` och `access_token=` i URL-hashen (samt negerar `type=recovery`) för att säkert fastställa om det är en lyckad e-postbekräftelse (och därefter visa 'Grattis din mejl är bekräftad'-rutan).
- **Åtgärdat Databas-schema:** Lade till den saknade `name`-kolumnen (VARCHAR) i `households`-tabellen, vilket eliminerade schema error när användare fyllde i namnet på sitt hushåll.
- **Åtkomst för alla:** Tog bort `role === 'owner'` spärren på knapparna till inställningsflikarna (`Allmänt` och `Konton`) i `ManageBills.tsx`.
- **UI-Uppdatering för SaaS:** Live-chatt och Demoläge lades till som punkter i `SubscriptionFeaturesModal.tsx` och `LoginScreen.tsx` för att förtydliga appens värdeerbjudande.

## 34. Avancerad Lånehantering & Nettolön (Enterprise-logik)

### Vad
Två stora uppdateringar gjordes för att hantera lån och inkomster mer professionellt:
1. **Lån med automatisk Ränteuträkning:** Istället för att användaren manuellt behöver räkna ut sin ränta varje månad på ett lån, sköter appen nu matten.
2. **Nettolön & Utbetalningsdag:** Hanteringen av lön förenklades drastiskt. Vi bytte från att spara fast/rörlig lön till att enbart fokusera på Nettolön och vilken dag lönen kommer.
3. **Alfabetisk sortering:** Alla listor (räkningar och konton) visas nu bokstavsordning för att göra UI:t tydligare när man har många poster.

### Varför
- För huslån och privatlån varierar räntan månad för månad, men de fasta avgifterna (aviavgift) och amorteringen är ofta känd eller lättläst från fakturan. Att tvinga användaren att skriva in tre separata fält (Ränta, Amortering, Avgift) var för krångligt. Den nya Enterprise-lösningen gör att de fyller i "Totalt" och "Amortering", och appen löser resten.
- Lönemodellen med fast/rörlig användes aldrig på djupet, det viktiga för budgeten var när pengarna kommer in (`pay_date`) och hur mycket (`amount`) så att appen kan applicera månadens inkomst på rätt räkningar (exempel: lön den 25:e juni är budgeten för juli).
- Osorterade listor orsakade frustration då användare fick leta efter sina konton i den ordning de skapades.

### Hur
- **Alfabetisk Sortering:** `.sort((a,b) => a.name.localeCompare(b.name, 'sv'))` lades till på renderingen av `accounts`, `bills` och `privateBills` i filerna `ManageBills.tsx`, `MonthView.tsx` och `PrivateView.tsx`.
- **Nettolön Database & Store:** `user_monthly_salaries` uppdaterades med `amount` (Nettolön) och `pay_date` (utbetalningsdag). Fälten för rörlig/fast togs bort. `store.ts` (`saveMonthlySalary`, `loadMonthlySalaries`) anpassades till den nya datamodellen.
- **Enterprise Låne-Logik:** 
  1. Inställningarna (`ManageBills.tsx`) fick ett fält för "Fast avgift / månad (kr)" som mappas mot nya db-kolumnen `fixed_fee` i `bills` och `private_bills`.
  2. Inmatningen i Månadsvy/PrivatVy fick en diskret "Amortering"-ruta inuti input-fältet för lån.
  3. I `store.ts` (`updateBillAmount` / `updatePrivateBillAmount`) läggs matematiken på: `Ränta = Totalt Inmatat Belopp - Amortering - Fast Avgift`. Är räntan negativ sätts den till 0.
  4. Om "Amortering" lämnas tomt (t.ex. vid CSN där det dras automatiskt utan ränta), faller koden tillbaka på att `Amortering = Totalt Inmatat Belopp`.
  5. Skulden (progress-baren) i `Statistics.tsx` räknar numera ned uteslutande baserat på `billAmortization` från databasen istället för totalbeloppet, så att räntan inte felaktigt krymper lånet.
- **Databas-Migrering:** Ett SQL-skript (`add_loan_columns.sql`) skapades som lade till kolumnerna `fixed_fee` på lån-tabellerna, och `amortization`, `interest`, `fee` på belopps-tabellerna (`month_bill_amounts` / `private_month_amounts`).

## 35. UI/UX Uppfräschning & Realtids-Demo (Enterprise-polering)

### Vad
En rad estetiska och funktionella finjusteringar genomfördes för att höja appens premiumkänsla och göra utforskandet (Demoläget) mer kraftfullt:
1. **Ytdiagram till Linjediagram:** Graferna i Statistik byttes ut från fyllda AreaCharts till slimmade LineCharts med tydliga belopp på varje datapunkt, och en sammanfattande trend-indikator.
2. **Realtidsuppdateringar i Demo:** Användare kan nu ändra siffror i demoläget och omedelbart se resultatet i graferna utan att behöva "låsa" månaden först.
3. **Privata Demodata:** Låtsasdata för den privata vyn (Spotify, Gymkort, CSN, Sparande) lades till så att besökare omedelbart kan förstå den privata funktionens värde.
4. **Z-index & Layout Buggar:** Modaler (t.ex. prenumerationsrutan) bröts ut ur sina föräldra-containrar för att inte klippas av på stora skärmar.
5. **Tydlig kommunikation:** Inloggningssidans copy uppdaterades för att tydliggöra att Live-support-chatten är exklusiv för prenumeranter.

### Varför
- De tidigare fyllda diagrammen (AreaCharts) kändes för "avlånga" och överväldigande när det enbart fanns två månader att jämföra, och användaren saknade direkta summor på punkterna.
- Användare som testade appen ville leka runt med siffrorna och direkt se hur Statistik förändrades, men tidigare logik krävde att månaden var "låst" för att den skulle synas i statistiken.
- CSS `overflow: hidden` på inloggningens vänsterpanel orsakade att breda modaler klipptes av i vissa webbläsare (som Edge på Desktop).

### Hur
- **Graferna:** `Statistics.tsx` byggdes om. `AreaChart` ersattes med `LineChart` med inbyggd `LabelList` som renderar summorna (`val.toLocaleString('sv-SE') kr`) direkt på linjen. En anpassad `renderTrend()`-funktion lades till som jämför senaste månaden med föregående och skriver ut differensen med pilar (▲ / ▼) och dynamiska färger ovanför varje graf.
- **Demoläget i Statistik:** En bypass lades in i `Statistics.tsx` filtreringslogik (`validMonths`). `if (isDemoMode) return true;` tvingar nu Statistik att inkludera alla tillgängliga månader (även olåsta), vilket skapar omedelbar återkoppling vid siffror-tweakande.
- **Privat Demodata:** `store.ts` utökades till att injecta mock-räkningar i `state.privateBills` och mock-belopp i `state.privateMonths` under `startDemo()`. En bugg som kopplade privatdata till den obefintliga inloggade användaren fixades genom att hårdkoda fallback-ID `demo_user_1` i de privata vyerna vid `isDemoMode`.
- **Globala Modaler via Portals:** `SubscriptionFeaturesModal.tsx` lindades in i Reacts `createPortal(..., document.body)`. Detta bryter ut modalen ur den aktuella DOM-hierarkin och renderar den direkt på `body`, vilket fullständigt eliminerar alla z-index- och overflow-klippningar (t.ex. från `.login-info-section`).
- **Input Styling (Amortering):** Layouten i `MonthView.tsx` för lån stuvades om. Den inbyggda `bill-amount-wrapper` som lägger till "kr" isolerades till att enbart omsluta "Totalt"-fältet, medan Amorterings-fältet fick en egen, ren input med tydlig kontrast och spacing så att siffror och valutor inte flöt in i varandra.

## 36. 100% Typsäkerhet (Borttagning av 'any')

### Vad
En stor refaktorering av hela kodbasen genomfördes för att uppnå 100% typsäkerhet ("Fortnox-nivå"). Detta innebar att samtliga förekomster av TypeScript-typen `any` identifierades och ersattes med strikta typer, interfaces eller `unknown`.

### Varför
Att använda `any` är en genväg i TypeScript som stänger av kompilatorns typkontroll för den variabeln. Genom att eliminera alla `any`-typer från systemet garanterar vi att all data har den struktur som koden förväntar sig. Detta eliminerar oväntade körtidsfel ("runtime errors"), gör det blixtsnabbt att hitta fel när man ändrar kod i framtiden, och höjer appens övergripande tekniska standard till en modern Enterprise-nivå.

### Hur
- **Supabase-mappning (`store.ts`):** Dynamiska data-returer från databasen (t.ex. vid laddning av månadslöner eller hushållsinställningar) typsattes från att lita på `(s: any)` till att använda definierade objekt (`s: { user_id: string; pay_date: string; amount: number }`) och `Record<string, unknown>` för payloads.
- **Recharts (`Statistics.tsx`):** `CustomTooltip` (som renderar svävande info-rutor över grafer) fick ett eget gränssnitt `TooltipProps` (med `active`, `payload`, `label`) för att matcha vad Recharts matar in, och formaterare till `LabelList` typsattes till att enbart acceptera nummer/strängar.
- **Excel-export (`excel.ts`):** Den osäkra typen `rowData: any[]` byttes ut mot `(string | number)[]` vilket är vad ExcelJS förväntar sig. Sökningar i listor typsattes strikt mot domänobjekt som `HouseholdProfile` och `Account`.
- **Global Felhantering (Try/Catch):** Alla felhanteringsblock runt om i appen (t.ex. `MyPages.tsx`, `AdminDashboard.tsx`, `PaywallModal.tsx`, `AuthContext.tsx`) refaktorerades. Istället för den omoderna TypeScript-genvägen `catch (e: any)` används nu den säkra branschstandarden `catch (e: unknown)`. Där vi tidigare direkt anropade `e.message` implementerades en säkerhetskontroll: `(e instanceof Error ? e.message : String(e))`. 
- **Byggprocess (CI/CD):** Efter refaktoreringen sattes verifikationskrav med kommandot `npx tsc --noEmit` för att tvinga fram en kompilering helt utan typ-fel, vilket nu fungerar felfritt utan varningar.

## 37. Felsökning och Remote Logging (Sentry)

### Vad
För att kunna identifiera och åtgärda fel hos slutanvändare utan att de behöver kontakta supporten manuellt, har vi integrerat **Sentry** (`@sentry/react`). Sentry är ett branschledande verktyg för felövervakning ("Error Tracking") i realtid.

### Varför
Tidigare förlitade sig appen enbart på lokala loggar (`console.error`) och den inbyggda React Error Boundaryn för att presentera en fallback-vy. Det fanns inget sätt att få reda på om en kund upplevde en krasch. Med Sentry skickas en detaljerad felrapport (inklusive stack-trace, webbläsarinformation och aktuell komponent-vy) omedelbart och osynligt till utvecklingsteamets dashboard så fort något går snett i klienten.

### Hur
- **Installation:** NPM-paketet `@sentry/react` lades till som ett dependency.
- **Konfiguration i `main.tsx`:** Sentry initieras innan React hinner börja rendera applikationen. Funktionen `Sentry.init` anropas med en specifik `DSN` (Data Source Name) som fungerar som adressen till projektet på Sentry.io.
- **Produktions-spärr:** Initieringen innehåller konfigurationen `enabled: import.meta.env.PROD` för att säkerställa att Sentry *enbart* skickar iväg felrapporter när koden körs i produktion, och därmed hålla utvecklingsmiljön (`localhost`) fri från falska larm.
- **ErrorBoundary-koppling:** Inuti vår befintliga, skräddarsydda `ErrorBoundary` i `main.tsx` utökades metoden `componentDidCatch(error)` till att anropa `Sentry.captureException(error)`. Detta bibehåller vårt användarvänliga fallback-UI ("Något gick fel!") samtidigt som felet sparas för teknisk granskning på Sentry.
- **ErrorBoundary-koppling:** Inuti vår befintliga, skräddarsydda `ErrorBoundary` i `main.tsx` utökades metoden `componentDidCatch(error)` till att anropa `Sentry.captureException(error)`. Detta bibehåller vårt användarvänliga fallback-UI ("Något gick fel!") samtidigt som felet sparas för teknisk granskning på Sentry.

---

## 38. Fullständig Säkerhetshärdning (Supabase + Kod)

### Vad
En djupgående, fullständig säkerhetsgranskning och härdning av alla lager i systemet genomfördes. Arbetet kan delas in i fyra delar:
1. **Supabase Database Linter-varningar** (alla funktioner härdade)
2. **User Enumeration-attack** eliminerad i lösenordsåterställning
3. **Förbättrade felmeddelanden** för nätverksfel
4. **Playwright End-to-End-tester** (automatiserad testning av hela flödet)

---

### 38.1 Supabase Database Linter-härdning (SQL)

#### Varför
Supabase inbyggda säkerhetsgranskare (Database Linter) flaggade 3 kategorier av risker:
1. `function_search_path_mutable` — En angripare med schemarättigheter kan teoretiskt skapa ett "evil schema" och lura databasen att köra fel kod när en privilegierad funktion exekverar.
2. `anon_security_definer_function_executable` — Anonyma (ej inloggade) användare kunde direkt anropa admin-funktioner via REST API (`/rest/v1/rpc/...`), trots att koden inuti blockerade dem.
3. `authenticated_security_definer_function_executable` — Inloggade användare utan admin-roll kunde anropa känsliga admin-funktioner.

#### Hur
En SQL-patch (`database_security_fixes.sql`) kördes i Supabase SQL Editor med tre sektioner:

**Del 1 — `SET search_path = public` på alla funktioner:**
Låser sökvägen så att databasen alltid hittar rätt inbyggda funktioner och inte kan luras av ett skadligt schema.

**Del 2 — `REVOKE EXECUTE FROM anon`:**
Blockerar anonyma helt från att ens nå dörrhandtaget på känsliga funktioner:
- `add_system_admin`, `remove_system_admin`, `get_system_admins`, `get_admin_stats`
- `set_admin_secret`, `delete_admin_secret`, `get_vip_emails`
- `set_household_vip_by_email`, `revoke_household_vip_by_email`
- `toggle_paywall`, `set_global_setting`, `set_user_role`
- `handle_new_user`, `is_user_admin`, `update_chat_session_timestamp`, m.fl.

**Del 3 — `REVOKE EXECUTE FROM authenticated` (enbart admin-funktioner):**
Tar bort rättigheterna för inloggade vanliga användare att anropa känsliga admin-funktioner.
*Undantagna* (behöver fortfarande vara körbara av inloggade): `delete_user`, `toggle_share_private_economy`, `user_in_household`, `update_chat_session_timestamp`, `check_email_confirmed`.

#### Fil
`database_security_fixes.sql` — Körs en gång i Supabase SQL Editor. Är idempotent (kan köras om utan bieffekter).

---

### 38.2 Eliminering av User Enumeration-sårbarhet

#### Vad
En *User Enumeration*-attack innebär att en angripare kan ta reda på vilka e-postadresser som har konton i systemet, genom att testa olika adresser och tolka felmeddelandena.

#### Varför det var ett problem
I den gamla lösenordsåterställningslogiken i `LoginScreen.tsx` anropades funktionen `check_email_confirmed` *innan* `resetPasswordForEmail`. Om e-posten inte hade ett bekräftat konto kastades ett specifikt fel: *"Kunde inte hitta ett bekräftat konto med den e-postadressen"*. En angripare kunde brute-forca e-postadresser och lista hela vår användarbas.

#### Lösningen (fil: `src/components/Auth/LoginScreen.tsx`)
`check_email_confirmed`-anropet togs helt bort. Nu anropas `supabase.auth.resetPasswordForEmail` direkt, alltid, oavsett om e-posten existerar eller inte. Supabase skickar bara ett mail om kontot finns — annars händer ingenting.

Meddelandet som visas för användaren är nu alltid generiskt och avslöjar ingenting:
> *"Om e-postadressen finns i systemet skickas en återställningslänk inom kort. Kolla även skräpposten!"*

Detta är branschstandarden som används av Google, GitHub och alla moderna system.

---

### 38.3 Förbättrade Felmeddelanden & Sentry-integration i `safeDb`

#### Vad
Appens centrala databasanrops-wrapper (`safeDb` i `src/store.ts`) förbättrades för att ge användarvänliga, kontextuella felmeddelanden vid nätverksproblem, och för att skicka alla oväntade fel till Sentry.

#### Varför
Tidigare visade `safeDb` alltid samma generiska meddelande `"Nätverksfel. Försök igen."` oavsett vad som faktiskt gick fel. En användare på tunnelbanan utan signal fick samma meddelande som en användare vars databas-query kraschade av annan anledning.

#### Lösningen (fil: `src/store.ts`)
En hjälpfunktion `getNetworkErrorMessage(err)` lades till som analyserar feltypen:

| Feltyp | Meddelande |
|---|---|
| `Failed to fetch` / `NetworkError` | "Ingen internetuppkoppling. Kontrollera din anslutning och försök igen." |
| `timeout` / `timed out` | "Servern svarar inte just nu. Försök igen om en stund." |
| Alla andra fel | "Något gick fel. Försök igen." + skickas till Sentry |

Sentry-integration lades även till i `safeDb` via `Sentry.captureException(err)` på alla oväntade fel, så att varje databasfel loggas i Sentry-dashboarden med full stack trace.

---

### 38.4 End-to-End-tester med Playwright

#### Vad
Tre automatiserade End-to-End (E2E)-testfiler skapades med Playwright (Microsofts gratis testramverk för webbappar) som simulerar en riktig användares beteende i en riktig webbläsare (Chromium).

#### Varför
Appens befintliga Vitest-tester testar enbart isolerade logikfunktioner (2 stycken). Det finns ingen automatiserad kontroll på att hela flödet — inloggning, navigering, knappar — fungerar som det ska. Om en framtida kodändring råkar bryta inloggningssidan eller Statistics-vyn hittar vi det inte förrän en riktig användare rapporterar det.

#### Testfiler

**`e2e/auth.spec.ts` — Autentisering**
- Inloggningssidan renderas korrekt med e-post- och lösenordsfält
- Fel lösenord ger felmeddelande utan att trigga ErrorBoundary
- Lösenordsåterställning visar korrekt generiskt meddelande (verifierar fix 38.2)
- Demo-läget kan startas utan inloggning

**`e2e/navigation.spec.ts` — App-navigering**
- Appen startar utan ErrorBoundary ("Oops!"-texten syns aldrig)
- Statistics-vyn (lazy-loadad) laddas och renderar utan blank skärm
- Navigering mellan vyer fungerar korrekt

**`e2e/robustness.spec.ts` — Robusthet & Edge Cases**
- Sidan laddas på under 5 sekunder (prestandakontroll)
- Inga kritiska JavaScript-konsolfel vid uppstart
- Tom e-post vid inloggning kraschar inte appen
- Extremt lång e-postinmatning (500 tecken) kraschar inte appen

#### Köra testerna
```bash
npx playwright test
```
Playwright startar automatiskt dev-servern (`npm run dev`) och kör alla tre testfiler i Chromium. Konfiguration i `playwright.config.ts`.

---

### 38.5 Supabase Auth — Leaked Password Protection

#### Vad
En Auth-inställning aktiverades i Supabase Dashboard: **"Enable Leaked Password Protection"**.

#### Varför
Utan denna inställning kan användare registrera sig med lösenord som är kända från offentliga dataintrång (t.ex. `password123`, `123456`). Supabase kontrollerar nu varje nytt lösenord mot databasen HaveIBeenPwned.org och avvisar komprometterade lösenord automatiskt.

#### Hur
Aktiverat via: Supabase Dashboard → Authentication → Providers → Email → "Enable Leaked Password Protection" → Spara. Kräver noll kodändringar.

---

### Filförteckning — Ändringar i detta kapitel

| Fil | Typ av ändring |
|---|---|
| `database_security_fixes.sql` | NY — SQL-patch som körs i Supabase. Låser search_path, återkallar rättigheter för anon och authenticated. |
| `src/components/Auth/LoginScreen.tsx` | ÄNDRAD — Tog bort `check_email_confirmed`-anropet, visar nu generiskt meddelande vid lösenordsåterställning. |
| `src/store.ts` | ÄNDRAD — `safeDb` förbättrad med nätverksfeldetektering och Sentry-integration. Sentry-import tillagd. |
| `e2e/auth.spec.ts` | NY — E2E-tester för autentiseringsflödet. |
| `e2e/navigation.spec.ts` | NY — E2E-tester för appnavigering i Demo-läge. |
| `e2e/robustness.spec.ts` | NY — E2E-tester för robusthet och edge cases. |
| `playwright.config.ts` | BEFINTLIG — Playwright-konfiguration (var redan på plats). |

---

## 24. Flexibelt Inkomstsystem (Fasta och Rörliga Inkomster)

### Vad:
Det tidigare lön-systemet (`user_monthly_salaries`) byttes ut mot ett mer flexibelt system för att hantera alla typer av inkomster (`user_incomes`), inte bara en specifik lön. Systemet har nu stöd för både **fasta inkomster** och **rörliga inkomster**.

### Hur:
- **Databasen:** Skapade tabellen `user_incomes` med kolumnerna `id`, `household_id`, `user_id`, `name`, `amount`, `type` (vilket är 'fixed' eller 'variable') och `pay_date` (av typen DATE).
- **Gamla Data:** En datamigrering gjordes från `user_monthly_salaries` till `user_incomes` i `add_user_incomes_table.sql` med `INSERT INTO ... SELECT ... pay_date::DATE`.
- **Tillståndshantering (`src/store.ts`):** `monthlySalaries` byttes ut mot `incomes` av typen `Income[]`. Hämtningen och muteringarna uppdaterades för att arbeta mot `user_incomes`.
- **UI (`src/components/ManageBills.tsx`):**
  - Fliken "Min Lön" döptes om till "Inkomster".
  - Den delades in i två sektioner: "Fast Inkomst (Varje månad)" för återkommande inkomster (ex. Barnbidrag, Underhåll) och "Rörlig Inkomst (Specifikt datum)" (ex. Lön, Försäkringskassan).
- **Statistik och Beräkningar (`src/components/Statistics.tsx`):** `InkomstUtgiftView` beräknar inkomsten dynamiskt:
  - Fasta inkomster läggs på varje månadsobjekt.
  - Rörliga inkomster appliceras (precis som tidigare lönelogik) på *följande månad* baserat på dess datum.

### Varför:
Användare hade behov av att inkludera andra inkomstkällor såsom barnbidrag och underhåll. Eftersom dessa inkomster kommer varje månad oberoende av ett fast lönedatum, behövdes ett `fixed` inkomst-läge. För bidrag som kan variera eller infalla oregelbundet (såsom utbetalningar från försäkringskassan), är `variable`-läget (där inkomsten är bunden till ett specifikt utbetalningsdatum) bättre lämpat. På detta sätt ges hushållet en korrekt totalkalkyl för "Kvar att leva på".

---

### Filförteckning — Ändringar i detta kapitel

| Fil | Typ av ändring |
|---|---|
| `add_user_incomes_table.sql` | NY — Skapar `user_incomes` tabellen och migrerar existerande löner från `user_monthly_salaries`. |
| `src/types.ts` | ÄNDRAD — Ersatte `MonthlySalary` med `Income` interface (`id`, `name`, `amount`, `type`, `payDate`). |
| `src/store.ts` | ÄNDRAD — Anpassade databasanrop, state och funktioner (`saveIncome`, `removeIncome`) att hantera `Income`. |
| `src/components/ManageBills.tsx` | ÄNDRAD — Uppdaterade inställnings-UI:t att stödja Fasta och Rörliga inkomster under en och samma flik. |
| `src/components/Statistics.tsx` | ÄNDRAD — Kalkyleringen i `InkomstUtgiftView` stödjer dynamisk iterering över `incomes`-arrayen för båda inkomsttyperna. |

---

## 25. Besöksstatistik och Säkerhetsuppdatering (Admin Dashboard)

### Vad:
En utökning av Admin-panelen för att inkludera detaljerad besöksstatistik (idag, igår, denna vecka, denna månad) för både inloggade och oinloggade (anonyma) besökare. Samtidigt fixades säkerhetsvarningar (`SECURITY DEFINER`) från Supabase genom att återkalla publika åtkomsträttigheter för administrativa databasfunktioner.

### Hur:
- **Databas & Säkerhet:** Ett SQL-skript (`fix_security_and_visitor_tracking.sql`) kördes för att köra `REVOKE EXECUTE ON FUNCTION ... FROM public, anon` på alla admin-funktioner.
- **Loggning (Databas):** En ny tabell `page_visits` skapades med `session_id`, `path` och `visited_at`. RLS-policys sattes upp så att `anon` kan göra `INSERT` (logga besök) men endast `is_user_admin()` kan göra `SELECT`.
- **Loggning (Klient):** I `App.tsx` lades en `useEffect` till som genererar ett unikt (men anonymt) `sessionId` via `crypto.randomUUID()` och sparar det i `localStorage`. Ett besök sparas i databasen max en gång per timme (spåras i `sessionStorage`).
- **Beräkning:** Funktionen `get_admin_stats` uppdaterades (`update_visitor_stats.sql`) för att direkt i PostgreSQL räkna fram `COUNT(DISTINCT session_id)` och `COUNT(*)` för olika tidsintervaller (`CURRENT_DATE`, `CURRENT_DATE - INTERVAL '1 day'`, `date_trunc('week')`, `date_trunc('month')`).
- **UI:** `AdminDashboard.tsx` uppdaterades med en ny kort-baserad layout ("Cards") i ett rutnät som presenterar statistiken visuellt med ikoner och färger.

### Varför:
Systemadministratören ville ha inbyggd, integritetsvänlig (inga cookies-banners krävs, endast anonymt session-id) och blixtsnabb analys av webbplatstrafik direkt inbyggd i befintlig admin-panel, utan att förlita sig på tredjepartsverktyg som Google Analytics. Säkerhetsuppdateringen krävdes för att följa Supabases best-practices och stänga ute potentiella attacker mot oskyddade `SECURITY DEFINER`-funktioner från publika API:et.

---

### Filförteckning — Ändringar i detta kapitel

| Fil | Typ av ändring |
|---|---|
| `fix_security_and_visitor_tracking.sql` | NY — Löser säkerhetsvarningar och skapar tabellen `page_visits`. |
| `update_visitor_stats.sql` | NY — Uppdaterar `get_admin_stats` att inkludera historisk trafik. |
| `src/App.tsx` | ÄNDRAD — Lägger till logik för anonym tracking (`localStorage` / `sessionStorage`). |
| `src/components/AdminDashboard.tsx` | ÄNDRAD — Ny UI/UX-design för statistik i rutnät, uppdaterade TypeScript-gränssnitt. |

---

## 26. Demostatistik i Admin-panelen

### Vad:
Funktionalitet för att logga och visa besöksstatistik specifikt för "Demoläget". Systemet spårar hur många besökare som klickar sig in på "Testkör utan konto" och visar denna statistik i Admin-panelen, med samma tidsintervaller som den allmänna besöksstatistiken (Idag, Igår, Denna Veckan, Denna Månaden).

### Hur:
- **Databas & Säkerhet:** Skapade en ny tabell `demo_visits` som loggar `session_id` och `visited_at`. Tabellen använder RLS (Row Level Security) som tillåter anonyma inlägg (`INSERT`) men begränsar läsning (`SELECT`) till administratörer.
- **SQL-funktion:** Uppdaterade funktionen `get_admin_stats()` för att räkna antalet unika sessions-ID:n och totala sidvisningar för demoläget under de angivna tidsperioderna, i tillägg till den existerande statistiken.
- **Frontend (Spårning):** I `src/store.ts` utökades funktionen `startDemo()` till att skicka ett anrop (insert) till tabellen `demo_visits` med besökarens unika `visitor_session_id` från `localStorage` varje gång demoläget startas.
- **Frontend (Visning):** I `src/components/AdminDashboard.tsx` uppdaterades typningen och datahämtningen för att hantera de åtta nya datafälten. Demostatistiken (Unika och Visningar) integrerades visuellt inuti de existerande besökskort-rutorna med en subtil avgränsare, för att behålla en kompakt och ren design.

### Varför:
För att ge administratören insikt i hur populärt demoläget är bland besökarna, och mäta konverteringen eller intresset hos potentiella nya användare utan att behöva förlita sig på externa spårningsverktyg. Systemet bygger på appens inbyggda och integritetssäkra sessionshantering.

### Filförteckning — Ändringar i detta kapitel

| Fil | Typ av ändring |
|---|---|
| `add_demo_stats.sql` | NY — Skapar tabellen `demo_visits` och uppdaterar `get_admin_stats`. |
| `src/store.ts` | ÄNDRAD — Spårar "startDemo" händelser mot databasen. |
| `src/components/AdminDashboard.tsx` | ÄNDRAD — Implementerar visning av demostatistik inuti befintliga trafikkort. |

---

## 27. Arkitektur 10/10: Enterprise-filosofi & "The Engine"

För att säkra upp systemet inför massiv skalning ("10/10 Michelin-stjärna nivå") och undvika att teknisk skuld (emergent complexity) smyger sig in via överlappande features, bygger arkitekturen på följande stöttepelare och defensiva mönster:

### 27.1 Single point of conceptual gravity (Renodlad Engine)
Hela appens affärslogik (den komplexa "Splitwise-matematiken") har separerats från UI och tillståndshantering. 
- **Fil:** `src/engine/calculator.ts`
- **Hur:** `calculateMonth()` är en 100% isolerad, framework-agnostisk funktion. Den tar in rena datastrukturer (`AppState`, `monthId`) och returnerar ett absolut utfall (`CalculationResult`). 
- **Varför:** Genom att ha en "lagbok" frikopplad från React och Zustand möjliggörs framtida batch-jobb, isolerade enhetstester (Vitest) och en arkitektur som kan exekveras exakt likadant i en backend (Node/Vercel) som i en frontend-webbläsare.

### 27.2 Versionerad affärslogik via "Data Snapshots"
Istället för att bygga en överdrivet komplex versionsmotor för matematiken löser systemet historisk reproducerbarhet via *produktflöden*.
- **Hur:** När ett hushåll låser en månad (`is_handled = true`), fryser appen datan i databasen. Även om algoritmen i `calculator.ts` uppdateras radikalt ett år senare, är gamla månader låsta i sitt historiska tillstånd. 
- **Varför:** Att skydda verkligheten med datalås (immutability) minskar subtila buggar och är oändligt mycket mer intuitivt för användaren än historiska "replays".

### 27.3 Defensiv design (Trust nothing, verify everything)
Ett dubbellagrat "immunförsvar" för dataintegritet.
- **Klientnivå:** Zod agerar gatekeeper i formulären och vägrar skicka iväg ogiltiga format.
- **Databasnivå:** PostgreSQL `CHECK Constraints` (som att skulder inte kan bli negativa, belopp $\ge$ 0) är "The Last Line of Defense". Om klienten hackas eller Zod falerar tvärvägrar databasen att korrumpera informationen.

### 27.4 Realtids Anomalidetektion (Finansiellt Immunförsvar)
En inbyggd skyddsmekanism mot handhavandefel ("fat-fingers").
- **Hur:** Applikationen analyserar ständigt historiska extremvärden (min/max över tre månader). Om en inmatning avviker med > 50% blockeras sparningen asynkront och användaren tvingas verifiera summan med "Är du säker?".
- **Varför:** Att stoppa fel *innan* de skrivs till databasen är avsevärt mycket billigare, säkrare och ger ett extremt starkt förtroende från användaren (SaaS-kritiskt).

### 27.5 Kontroll över Metrics (Native SQL)
Istället för att slänga in tredjepartsverktyg som Amplitude eller Mixpanel för besöksstatistik:
- **Hur:** Appen loggar anonyma page views och demo-starter direkt i Supabase, och sammanställer detta via dedikerade RPC-funktioner (`get_admin_stats`) direkt till `AdminDashboard.tsx`.
- **Varför:** Det säkerställer fullständig kontroll, eliminerar GDPR-problematik/cookies-banners och optimerar för maximal app-hastighet. Lösningen signalerar att vi äger och förstår vår egen data fullt ut.


---

## 23. Startsida & Förbättrad Navigering

### Vad:
För att göra appen mer välkomnande och enkel att förstå för nya (och befintliga) användare skapades en dedikerad "Startsida" som agerar nav för hela applikationen.

### Hur:
- **Ny Komponent (`src/components/StartPage.tsx`):** En visuell överblicksvy med 5 eleganta rutor ("Gemensam", "Statistik", "Privat", "Mina sidor", "Inställningar").
- **Tydliga Förklaringar:** Varje ruta har en ikon, en rubrik och en kort beskrivning som förklarar exakt vad vyn gör (t.ex. "Översikt över din privata ekonomi. Se månadens räkningar.").
- **Omdöpning av Statistik:** För att göra appen mer självförklarande har fliken "Statistik" döpts om till "Statistik" i alla menyer och rubriker.
- **Smart Tillbaka-navigering:** Istället för att användare alltid skickas till "Gemensam" när de stänger en undermeny (t.ex. Inställningar eller Mina Sidor), leds de nu konsekvent tillbaka till Startsidan ("← Tillbaka till Startsida").

### Varför:
Appen har vuxit med många avancerade funktioner. En startsida med tydliga beskrivningar minskar inlärningströskeln drastiskt och ger ett mer premium och strukturerat intryck. 

---

## 24. Kundtjänst-chatt & Optimistic UI (Race Condition Fix)

### Vad:
En inbyggd chatt-funktion för kommunikation mellan användare och support/admin, med realtidsuppdateringar och "Optimistic UI" för att säkerställa att meddelanden aldrig upplevs försvinna.

### Hur:
- **Komponenter:** `ChatBubble.tsx` (för klienten) och `AdminChat.tsx` (för administratören).
- **Databas & Realtid:** Meddelanden sparas i tabellen `chat_messages` och klienterna lyssnar på nya meddelanden via Supabase Realtime (`postgres_changes`).
- **Problemet som löstes:** Tidigare hände det att det absolut första "Hej"-meddelandet inte syntes i klientens fönster. Detta berodde på ett "Race Condition": Klienten skickade meddelandet, men hann inte starta prenumerationen på realtidskanalen (som skapades dynamiskt med session-ID) innan databasen redan svarat.
- **Lösningen (Optimistic Update):** Istället för att uteslutande förlita sig på databasens realtidsnotiser, uppdateras nu det lokala React-statet (`setMessages`) omedelbart så fort användaren trycker på "Skicka". När realtidsnotisen väl kommer från databasen, används meddelandets `id` för att filtrera bort dubbletter.

### Varför:
En chatt måste kännas blixtsnabb och 100% pålitlig. Genom att hantera utgående meddelanden lokalt direkt ("Optimistic UI") löstes inte bara buggen med det försvunna första meddelandet, utan hela chatten upplevs nu mycket snabbare.


---

## 25. Avslut av Chattsessioner (Livscykel)

### Vad:
Hantering av en chattsessions livscykel, från skapande till stängning, för att säkerställa att kundtjänstens vy över aktiva ärenden hålls ren.

### Hur:
- **Minimera ("_"):** Döljer fönstret lokalt i klienten via React-state (`isOpen = false`). Sessionen förblir `active` (eller `waiting`) i databasen och kundtjänst kan fortfarande svara på den.
- **Avsluta ("✕"):** Stänger fönstret, men gör även ett aktivt databasanrop för att sätta `status = 'closed'` på sessionen i tabellen `chat_sessions`. Det lokala statet rensas helt (`sessionId = null`, tömda meddelanden).
- **Kundtjänstens vy (`AdminChat.tsx`):** Prenumererar via realtid enbart på chattar med status `waiting` eller `active`. När en användare klickar på krysset försvinner sessionen omedelbart från listan i admin-gränssnittet, vilket skapar ett självränsande kö-system.

### Varför:
Utan en funktion för att expliciet stänga ärenden skulle kundtjänstens lista fyllas upp av "klara" konversationer. Att integrera avslutet i den naturliga "stäng-knappen" gör att användarna automatiskt städar upp efter sig när de är nöjda med hjälpen de fått.


---

## 26. Omdesign av Startsidan (Dashboard / Landningssida)

### Vad:
Startsidan gjordes om från en enkel meny med knappar till en fyllig, modern "Dashboard" eller landningssida som säljer in appens funktioner till nya användare och ger en bra överblick.

### Hur:
- **Ny Layout (`StartPage.tsx`):** Lade till en stor Hero-sektion med säljande copy ("Slipp miniräknaren..."), uppdaterade navigationsrutorna med mer förklarande texter, samt lade till två helt nya sektioner: "Så fungerar det" (4 steg) och en checklista med "Därför använder hushåll SmartEkonomi".
- **Styling:** Minskade padding och margin ovanför hero-sektionen på mobila enheter för att ta bort tomma hål och glapp, så att texten kommer direkt under logotypen.

### Varför:
För att sänka tröskeln för nya användare att förstå appens värde. En tydlig 4-stegsguide och en checklista ökar konverteringen och får appen att kännas mer som en premiumprodukt direkt efter inloggning.


---

## 27. Layout: Vänster-Sidebar för Desktop

### Vad:
En stor strukturell layoutförändring där huvudmenyn flyttades från att vara topp-knappar till att bli en permanent vänsterställd sidopanel (Sidebar) på datorer, medan mobiler behåller sin topp-meny med hamburgarknapp.

### Hur:
- **Strukturell Ändring i `App.tsx`:** Införde en övergripande `<div className="app-layout">` som omsluter allt. Denna delas upp i `<aside className="desktop-sidebar">` (som innehåller loggan, huvudmenyerna och utloggning) och `<main className="main-content">` (som innehåller den mobila headern och de faktiska vyerna).
- **CSS (`index.css`):** Använder `@media (max-width: 768px)` för att helt dölja sidopanelen på mobiler, och `@media (min-width: 769px)` för att dölja hamburgermenyn på datorer. Sidopanelen använder `position: sticky; height: 100vh` för att alltid vara synlig när användaren scrollar.
- **Inre menyer bevaras:** Lokala menyer, som flikarna inne på Statistik-sidan ("Gemensam Statistik", "Privat Statistik"), lämnades orörda i `main-content`. De agerar nu som snygga lokala sid-flikar (Page Tabs) istället för att kollidera med en global topp-meny.
- **Header-text borttagen:** Den lilla underrubriken "Automatisk uträkning av hushållets räkningar" togs bort helt för att förhindra att menyn "hoppade upp och ner" (Layout Shift) när man växlade mellan sidor som hade olika rubriker.

### Varför:
När appen växte blev toppmenyn plottrig på datorer och kolliderade grafiskt med de inre menyerna (som i Statistik). En klassisk Sidebar-layout (som används i t.ex. Slack, Discord och de flesta moderna SaaS-plattformar) utnyttjar breda skärmar mycket bättre och skapar en stark visuell hierarki. Samtidigt krävdes det att vi inte rörde mobillayouten, eftersom mobila webbappar navigeras bäst via en dold hamburgermeny.


---

## 28. UX Copywriting: Värdebaserad Försäljning i Prenumerationsrutan

### Vad:
Texterna i prenumerationsrutan (`SubscriptionFeaturesModal.tsx`) skrevs om för att fokusera på **känsla och resultat** snarare än rent tekniska funktioner.

### Hur:
- **"Mindre tjafs":** En ny punkt lades till (som nummer två i listan): *"Mindre ekonomiskt tjafs: Alla kostnader samlas på ett ställe och systemet räknar automatiskt ut vem som ska betala vad. Ingen behöver hålla reda på siffrorna manuellt."*
- **Avdramatisering av priset:** Lade till den kursiva undertexten *"Mindre än 2 kr per dag för hela hushållet"* precis under huvudpriset på 59 kr/månad.
- **Rensning av teknisk jargong:**
  - *"Äkta app-känsla (PWA)"* ändrades till det mer förståeliga *"Installera som app på mobilen"*.
  - *"EkonomiTB"* döptes om till det raka och självförklarande *"Statistik"*.
  - Buzzwords som *"vårt system analyserar er historik..."* (i felskrivningskontrollen) byttes till det mer trovärdiga *"systemet upptäcker ovanligt höga eller låga belopp"*.

### Varför:
Konverteringsoptimering (CRO). Målgruppen för appen letar i första hand efter en lösning på vardagsfriktion och irritation kring vem som betalat vad, inte efter komplexa algoritmer eller "PWA-teknik". Att bryta ner 59 kr/månad till "Mindre än 2 kr per dag" gör priset psykologiskt extremt lätt att acceptera. Sammantaget lyfter detta prenumerationsrutan från att vara en "utvecklar-featurelista" till en slipad försäljningspitch.

---

## 29. Copywriting och UX-Polering (Juni 2026)

### Vad:
En omfattande revidering av copy och UX på flera nyckelsidor för att göra appen mer säljande, professionell och användarvänlig. Detta inkluderar Inloggningssidan, Startsidan, Prenumerationsrutan, Sammanställningar (Swish-terminologi) och formulärsnavigering.

### Hur:
- **Inloggningssidan (`LoginScreen.tsx`):**
  - Hero-texten skärptes till: *"SmartEkonomi hjälper hushåll att automatiskt räkna ut hur kostnader ska delas och ger full kontroll över både gemensam och privat ekonomi."* Detta ger ett bättre flyt och minskar onödig text.
  - Sälj-listan ("Varför välja oss") trimmades från upprepningar till 5 knivskarpa punkter utan överlappning (bl.a. betonades *"Separat hantering av gemensam och privat ekonomi"*).
  - Huvudbadge ändrades från "Gemensam ekonomi" till varumärket "SmartEkonomi".
- **Startsidan (`StartPage.tsx`):**
  - **Navigationsboxar:** Kalla menybeskrivningar byttes mot värdedriven copy. "Inställningar" lovar nu att man kan *"Anpassa ekonomin"*, och "Mina sidor" lovar *"Full kontroll över ditt konto"*.
  - **Ärlighet i Steg 3:** Löften om automatisk "sparkalkylator" ströks för att undvika falska förväntningar. Istället lovar vi det appen faktiskt gör: en *"tydlig bild av hushållets ekonomi"*.
  - **Borttagning av Admin-box:** Admin-menyn dolts helt från Startsidan (den nås fortfarande i sidomenyn) för att behålla startsidan ren för vanliga hushållssysslor.
  - **Hero Layout (WOW-faktor):** Hero-sektionen fick samma premium-design som Inloggningssidan via `.login-hero-title` och `.text-gradient`. Ett tidigare överdimensionerat toppmarginal-avstånd (`4rem` -> `1rem` på mobiler) reducerades också för att skapa en mycket tightare och mer inbjudande välkomstvy.
- **Prenumerationsrutan (`SubscriptionFeaturesModal.tsx`):**
  - Textväggar bröts ner till skannbara, snabba punktlistor med bockar (✅) framför, så att kunden på 3 sekunder ser värdet innan de betalar.
- **Terminologibyte (Swish -> Överföringar i `Summary.tsx` & `Statistics.tsx`):**
  - Raderade hårdkodad terminologi kring "Swishar till" för generella banköverföringar. Det står nu "för över till" om kontot är inställt på banköverföring.
  - Fixade ett grammatiskt fel där svenska namn som slutar på "s konto" (t.ex. "Helenas konto") oavsiktligt strippades fel. Systemet identifierar nu "Helenas" och konverterar det till "Helena" för ett snyggare UI (t.ex. "Helena för över till hus kontot").
- **Scroll-bugg fixad (`ManageBills.tsx`):**
  - När formuläret för att ändra en räkning flyttades från botten till toppen av sidan, scrollade "Ändra"-knappen fortfarande användaren ner till botten av sidan (`document.body.scrollHeight`). Detta fixades så att `window.scrollTo` nu pekar uppåt (`top: 0`), vilket skapar ett logiskt och naturligt flow.

### Varför:
Dessa till synes små ändringar bygger enormt mycket förtroende. En potentiell användare dömer appens pålitlighet utifrån hur professionell copyn är och hur smooth UX-flödena (som scroll och konsekvent terminologi) känns. Att ta bort upprepningar, rensa "developer-speak" och fixa knasiga formuleringar (som "Helenas för över") förvandlar systemet från en hobbyapp till en Premium-tjänst.


### 21.6 UX: Idiotsäker Inställningsvy (Lägg till Räkning / Konto)
För att minimera den kognitiva belastningen för användaren (särskilt helt nya hushåll) har de kritiska inställningsflödena för att lägga till nya räkningar och konton blivit ombyggda.

**Lägg till ny räkning:**
- Namnfält och dropdown (Vanliga räkningar) har slagits ihop till ett enklare gränssnitt visuellt.
- Avancerade inställningar (Varning för saknad, Lån/Skuld, Autogiro) är nu placerade i snygga, klickbara kort under rubriken "Smarta inställningar". Varje val aktiverar en tydlig färg och förklarande undertext.

**Lägg till nytt konto (Hushålls-setup):**
- Den förvirrande frågan "Hur tar kontot emot pengar? (Swish/Bank)" har helt avlägsnats.
- Istället visas ett 2-stegsflöde ("Vad vill du lägga till?").
- Genom att välja "Lägg till en Person (Hushållsmedlem)" förstår appen automatiskt att det handlar om person-till-person överföringar. Texten förklarar direkt varför valet finns: *👉 Detta krävs för att appen ska räkna ut om ni är skyldiga varandra pengar*.
- Genom att välja "Lägg till ett Gemensamt Bankkonto" förstår appen automatiskt att det är en pott/banköverföring. Förklaringen lyder: *👉 Detta krävs för att se hur mycket ni ska sätta in*.
- Detta gör det fullständigt intuitivt för nya användare att snabbt sätta upp den perfekta hushållsstrukturen (t.ex. Andreas -> Hus kontot, Helena -> Hus kontot, Andreas -> Helena).

### 21.7 Centraliserad Kontokoppling (Makt till Administratören)
**Vad:** 
Rullgardinsmenyn "Kopplat konto" har raderats helt från "Mina Sidor". Istället har en ny sektion ("Koppla Inlogg till Person") skapats under fliken "Konton" i Inställningar. Denna sektion är endast synlig för användare med behörighetsnivån `owner`. Här listas alla e-postadresser som har loggat in i hushållet, och administratören får koppla varje e-postadress till ett specifikt virtuellt Personkonto (t.ex. "Andreas" eller "Helena"). Den inloggade ägaren kopplar även sig själv här. Samtidigt rensades överflödig hjälptext i "Lägg till räkning"-vyn för ett minimalistiskt UI.

**Varför:** 
1. **Säkerhet & Kontroll:** En inbjuden medlem ska inte själv kunna klicka runt och byta ut vem de representerar i hushållet, det skapar risk för felräkningar.
2. **UX & Logik:** Tidigare skapades personerna (de virtuella kontona) under Inställningar, men kopplingen till e-postadressen gjordes under Mina Sidor. Detta var ologiskt och kändes splittrat. Nu är "Skapa Person" och "Koppla Inlogg till Person" samlat på en och samma skärm, vilket ger administratören (ägaren) en tydlig dashboard-upplevelse och total kontroll.

---

## 30. Nya Funktioner: Besökarchatt, Excel-import & UI-Förbättringar (Juni 2026)

### 30.1 Chatt för oinloggade besökare
**Vad:** Kundtjänstchatten (`ChatBubble.tsx`) finns nu tillgänglig direkt på inloggningsskärmen. Besökare kan starta en chatt utan att skapa ett konto. Dessutom dyker chattbubblan upp "magiskt" utan sidomladdning när en admin aktiverar den.
**Hur:** En `visitor_id` kolumn lades till i `chat_sessions`-tabellen och `user_id` gjordes valfri (`DROP NOT NULL`). Klienten genererar ett unikt sessions-ID som lagras i `localStorage` (`visitor_session_id`). 
- **Auto-popup-fix:** En `useEffect` med `setInterval` lades till i `ChatBubble.tsx` för att binda `visitor_session_id` till Reacts state. Detta gör att bubblan renderas i realtid så fort App.tsx skapar ID:t, utan att besökaren behöver ladda om sidan.
- **Säkerhet & Permission-fix:** Supabase utvärderar alla RLS-policies när en rad infogas. Eftersom anonyma (oinloggade) användare inte hade rättighet (`EXECUTE`) att köra `is_user_admin()`, nekades de av databasen när de försökte skicka meddelanden. SQL-skriptet byggdes om med `GRANT EXECUTE ON FUNCTION is_user_admin TO anon` och funktionen uppdaterades att returnera `false` ifall `auth.uid() IS NULL`.
**Varför:** Sänker tröskeln för att kontakta support. Nya användare som har frågor kring prissättning eller funktioner innan de registrerar sig kan nu få direkt hjälp, vilket ökar konverteringen. Att lösa RLS-rättigheterna säkerställer stabilitet i databasens behörighetssystem utan att blotta administratörsfunktioner.

### 30.2 Excel-import av räkningar
**Vad:** En "Importera Excel"-knapp har lagts till i Hantera Räkningar (`ManageBills.tsx`).
**Hur:** Vi integrerade biblioteket `xlsx`. När användaren laddar upp sin budget-fil i Excel-format letar systemet automatiskt upp kolumner för *Kategori*, *Räkning* och *Belopp*. 
- Om en kategori (t.ex. "Hus kontot") saknas i systemet, skapas det automatiskt ett gemensamt konto. 
- Räkningarna läggs in med första månadens belopp som `defaultAmount`.
**Varför:** Enormt värdeskapande (Onboarding). Hushåll som vill flytta till appen slipper sitta och manuellt skriva in sina 30+ räkningar. Filen laddas upp, och på två sekunder är hela deras ekonomiska struktur uppbyggd.

### 30.3 "Mina Sidor" - Tab-uppdelning
**Vad:** Den tidigare mycket långa och oöverskådliga vyn "Mina Sidor" har delats upp i tre separata flikar.
**Hur:** Introducerade ett lokalt `activeTab`-state i `MyPages.tsx`. 
- **Flöde:** Istället för all info på samma sida har vi nu "👤 Profil", "🏠 Hushåll" och "⚙️ Premium" som val. Namnen kortades ner för att få plats snyggt på mobila enheter. CSS-klassen för desktop exkluderades så menyn fungerar på både dator och mobil.
- **Funktioner bibehållna:** Inga funktioner (såsom Byt e-post/Lösenord, Prenumerationshantering, Bjuda in medlemmar) har raderats. All funktionalitet existerar intakt, sorterat under rätt logiska rubrik.
**Varför:** Minskad kognitiv belastning (UX). Användaren möts inte längre av en vägg av text och "Farlig zon"-varningar, utan kan navigera smidigt baserat på vad de vill utföra. Att flikarna gjordes mobilanpassade säkerställer appens core design value (mobile-first).

### 30.4 Helskärmsläge i Kundservice (Admin)
**Vad:** En "Helskärm"-knapp i `AdminChat.tsx`.
**Hur:** Vid klick togglas ett state (`isFullscreen`). Eftersom en vanlig `position: fixed` blev kapad i kanterna på grund av föräldraelementens CSS (t.ex. `transform` i dashboard-layouten), implementerades en `React Portal` (`createPortal`). Chattvyn teleporteras då ut direkt till `document.body` och undviker därmed alla layout-restriktioner.
**Varför:** Kundtjänst kan ibland vara intensivt. Att kunna expandera chattverktyget över hela skärmen tar bort störande meny-element och ger maximal arbetsyta, särskilt uppskattat när admin sitter på en mobil enhet. Portals var ett robust tekniskt val för att undvika komplex och skör CSS-nästling.

---

## 31. Admin Användarhantering (Admin User Management)

### 31.1 Räknare för obekräftade konton
**Vad:** En ny statistikruta ("📧 Obekräftade E-post") har lagts till högst upp i Admin Dashboarden.
**Hur:** Den befintliga PostgreSQL-funktionen `get_admin_stats()` uppdaterades till att även returnera `unconfirmed_users BIGINT`. Eftersom funktionen körs med `SECURITY DEFINER` har den tillgång till den dolda `auth.users`-tabellen. SQL-frågan hämtar alla rader där `email_confirmed_at IS NULL`. I frontend (React) lades rutan till bredvid "Totala Medlemmar".
**Varför:** För att ge administratören en direkt inblick i konverteringsgraden och hur många potentiella användare som fastnar i registreringssteget (t.ex. hamnar bekräftelsemailet i skräpposten?).

### 31.2 Medlemslista & Säkerhet (Modal)
**Vad:** Den gamla röriga Admin Dashboarden har städats upp. De lösa inmatningsfälten för VIP och Admins är borttagna. Klickar man nu på "Totala Medlemmar" öppnas en smidig och fullständig Modal-vy.
**Hur:** Ett nytt SQL-skript (`admin_user_management.sql`) introducerades.
1. **`admin_get_all_users()`**: Returnerar hela databasens lista över användare (e-post, inloggningsdatum, blockerad-status). Den mappar dessutom in om användaren tillhör ett VIP-hushåll eller är en registrerad systemadministratör, med hjälp av `EXISTS()` via underliggande tabeller (`profiles` och `households`).
2. **Frontend:** React-komponenten `AdminDashboard.tsx` byggdes om kraftigt. En ny `MembersModal` skapades och renderas som en fullscreen overlay med z-index. Listan renderas med `.filter()` baserat på textinmatning i en ny sökruta för omedelbar filtrering.
**Varför:** Dashboarden blev för vertikalt lång och rörig. Genom att samla all användarhantering i en sökbar lista skapades ett modernt CRM-gränssnitt där administratören direkt kan identifiera en användare och hantera deras rättigheter med ett enda klick, utan att skriva in mailadresser manuellt.

### 31.3 Blockering och Borttagning av Konton
**Vad:** Nya knappar för att "Blockera" (Lås upp) och "Radera" användare lades till per individ i Medlemslistan.
**Hur:** 
- **Blockera:** Genom SQL-funktionen `admin_ban_user()` uppdateras kolumnen `banned_until` i `auth.users`. Vid en blockering sätts datumet till år 3000, vilket nekar personen all framtida tillgång (och via Supabase auth bryts aktiva sessioner).
- **Radera:** SQL-funktionen `admin_delete_user()` utför en `DELETE FROM auth.users WHERE id = target_user_id`. (Som ett extra skyddsnät körs även en delete i `profiles`). Supabase hanterar sedan kaskad-borttagning internt.
**Varför:** Vid missbruk av appen, bedrägerier, testkonton eller spam-registreringar behövs ett enkelt grafiskt sätt att agera omedelbart, utan att behöva logga in i backend-databasen (Supabase Dashboard). Egenutvecklade RPC-funktioner via `SECURITY DEFINER` garanterar att enbart administratörer kan manipulera dessa kritiska data.

---

## 32. Product-Led Growth (PLG) Onboarding & Betalvägg

### 32.1 Setup Wizard (Onboarding & Premium-Sammanställning)
**Vad:** Ett helt nytt, interaktivt onboarding-flöde där nya användare sätter upp sin hushållsekonomi och sedan möts av betalväggen *innan* de kommer in i appen.
**Hur (`SetupWizard.tsx`):**
- Systemet guidar användaren genom steg: Val av namn på hushållet, val av hushållskonstellation, inmatning/importering av räkningar och inkomster.

#### 32.1.1 Dynamisk Multi-User Bankimport (Steg 3)
**Vad:** Istället för en ensam uppladdningsknapp anpassas bankimporten dynamiskt efter hur många vuxna som lagts till i hushållet, vilket eliminerar mentala glapp för par och familjer.
**Hur:**
- **Dynamisk UX:** Om hushållet består av 1 vuxen visas en ren vy med *en* uppladdningsknapp och inga namn. Om det består av fler loopar systemet ut varje person: *Andreas - Bankfil saknas*, *Emma - Bankfil saknas*, tillsammans med individuella uppladdningsknappar och en progressionsräknare högst upp (t.ex. *1 av 2 bankfiler uppladdade*).
- **Auto-märkning:** När en användare klickar på Emmas knapp, skickas hennes ID med in i `bankParser.ts`. Parsen stämplar automatiskt `selectedUserId = Emma_ID` på alla transaktioner från hennes fil. Detta gör att i den gemensamma granskningen slipper paret sortera vems utgift som är vems – allt är redan färdigsorterat.
- **Flexibilitet:** Systemet uppmanar till att båda ska ladda upp filer direkt (*"Ladda gärna upp allas bankfiler för bästa resultat..."*), men tillåter dem att fortsätta direkt om t.ex. sambon inte är hemma.
- **Premium Sammanställning (Steg 4):** Istället för en enkel lista visas en lyxig dashboard med tre färgkodade "Cards" (Inkomst, Utgift, Sparutrymme) och siffror som animerat räknar upp från noll. Detta förstärker "Wow"-känslan och psykologin kring hur mycket pengar de faktiskt har kvar.
- **Atomisk Databas-commit (`create_initial_household_setup`):** Insamlad data paketeras och skickas via *ett enda* anrop till en PostgreSQL RPC-funktion. Funktionen stämplar nu användaren direkt med `setup_status = 'completed'` istället för readonly.

### 32.2 Den Magiska Betalväggen (Inbakad i Wizarden)
**Vad:** Vi har skrotat det gamla "titta-men-inte-röra" (Read-Only) läget. Nu är betalningen det logiska avslutande steget direkt efter att de sett sitt sparutrymme.
**Hur:**
- Efter premium-sammanställningen klickar de på "GÅ VIDARE FÖR ATT SPARA DIN BUDGET". Detta leder dem till Steg 5: Betalväggen.
- Betalväggen säljer appens värde (endast 59kr/mån, dela med hushållet etc.).
- När användaren klickar på "Betala" sparas deras budget till databasen, och direkt därefter slussas de till Stripe. När Stripe är klart, studsar de in i appen till deras färdiga budget.

### 32.3 Hard Gate Fallback & Master Switch
**Vad:** Säkerhetsnät ifall de smiter undan, samt en global strömbrytare för att göra applikationen gratis.
**Hur (`PaywallModal.tsx` & `App.tsx`):**
- **Hard Gate i Appen:** Om en användare sparar budgeten, men sedan klickar *bakåt* i Stripe-utcheckningen och försöker logga in i appen igen, blockeras de omedelbart av den generiska globala `PaywallModal` som renderas direkt i roten på `App.tsx` (kollar `stripe_status`). Det går alltså inte att komma runt betalningen.
- **Master Switch:** Om `paywall_active` sätts till AV i databasen, känner `SetupWizard.tsx` av detta. Vid klick på "Gå vidare" hoppas betalsteget (Steg 5) över fullständigt. Budgeten sparas och användaren slussas omedelbart in i en gratis-version av appen, varpå appen tillåter alla interaktioner utan några spärrar.

---

## 🔄 Versionshistorik

### Version 2.2.0 (Senaste ändringar - Admin & UX)
- **FAQ Uppdaterad:** Instruktionen för att avsluta prenumerationen pekar nu korrekt till "Inställningar" i sidomenyn.
- **Admin UI Rutor:** Ersatte webbläsarens inbyggda `window.confirm` (Windows-rutor) med skräddarsydda React Portal-modaler för blockering och radering av användare för en mycket modernare känsla.
- **Globala Admin-notiser (Toasts):** Flyttade admin-meddelanden från vanliga divs till en global "Toast"-notis högst upp på skärmen. Notiserna svävar över alla vyer och stänger ner sig automatiskt efter 5 sekunder via en timer.
- **Realtidsuppdateringar för Admin:** Applikationen prenumererar nu på `postgres_changes` från tabellen `system_admins` (filtrerat på `user_id`). När en användare får administratörsrättigheter uppdateras deras `AuthContext` omedelbart via WebSocket, och "Admin"-knappen i sidomenyn ploppar upp på direkten utan behov av siduppdatering (F5).
- **Åtgärdad VIP-logik:** Byggde om funktionerna `set_household_vip_by_email` och `revoke_household_vip_by_email` till enhetliga PL/pgSQL-funktioner (TEXT). Löste en databaskonflikt så att VIP-knappen nu kan togglas felfritt.
- **Dold VIP-knapp för ägare:** För root-administratören döljs VIP-knappen helt från adminpanelens medlemslista för att hålla gränssnittet rent.
- **Korrekt Betalningsstatistik:** Funktionen `get_admin_stats()` räknar nu endast hushåll med `stripe_status = 'active'`. VIP-konton ingår inte längre i rutan "Betalande Hushåll".
- **Svenskt Inloggningsfel:** Fångar upp Supabase-felet "User is banned" och visar tydligt texten "Ditt konto är blockerat av en administratör."

## 15. Bank-import & Minnesfunktion ("Botemedlet mot Tomt Konto-syndromet")

### Vad:
En premium-funktion som låter användaren ladda upp en bankfil (t.ex. SEB, Swedbank, Länsförsäkringar). Appen läser filen och mappar automatiskt både **Utgifter (Räkningar)** och **Inkomster (Lön/Utbetalningar)** till rätt konton och personer. Den skapar lärdomar för att bygga ett sömlöst hushållsminne över tid, men håller stenhårt isär gemensamma och privata flöden.

### Hur – 4-stegs Matchningshierarki:
Import-logiken (`bankParser.ts`) bygger på en deterministisk hierarki med tillhörande UX-färgkodning:

1. **Hushållets Minne (🟢 Bekräftad)**
   - Appen kollar först om transaktionen matchar ett mönster som hushållet själva tidigare importerat.
   - **Beloppskontroll:** För inkomster och utgifter kontrolleras också om summan ligger inom ett *Historiskt intervall* (±15% från standardbeloppet). Visar omedelbart varningsflagga om Netflix kostar 899 kr istället för 159 kr.
2. **SYSTEM-kategorier & Alias (🟣 Ny upptäckt)**
   - Om inget hushållsminne finns, mappar parsern transaktionen mot ett inlärt bibliotek (`SYSTEM_CATEGORIES`).
   - Säkra alias normaliserar bankskräp för att hitta rätt. Korta osäkra alias undviks för att eliminera falska träffar.
3. **Textanalys (🟡 Behöver granskas)**
   - Transaktioner som innehåller nyckelord som "LÖN", "BARNBDR", "AUTOGIRO", eller matchar exakt på ett kontonamn. Auto-markeras inte utan hjälper bara användaren att placera posten.
4. **Ingen Match (⚪ Grå)**
   - Okända transaktioner. Ignoreras för import om de inte checkas i manuellt under "Övriga transaktioner".

### Hur – Dubblett-skydd (Deduplicering):
- **Utgifter:** Parsern verifierar omedelbart ifall en räkning med exakt samma namn redan är inlagd i appen.
- **Inkomster:** Eftersom inkomster varierar över tid, matchar parsern på *Namn + Datum + Belopp* för att inte råka flagga nästa månads lön som en dubblett.
- Träffar resulterar i statusen **✅ Redan inlagd**, de får en neutral grå färg, och rutorna *kryssas ur automatiskt* för att förhindra dubbel-import ifall användaren laddar upp flera överlappande excel-filer i rad.

### Hur – Privat vs Gemensam Routing (Scope-Aware):
- Bank-importen är kontext-medveten baserat på i vilken vy användaren befinner sig (`newBillScope`).
- **Gemensam Vy:** Importerar posterna som `BillDefinition` med kopplingar till gemensamma bankkonton. System-regler (minnet) aktiveras och sparas för hela hushållet.
- **Privat Vy:** Importerar posterna direkt som `PrivateBill` kopplat till enbart den aktuella användaren. Konto-väljaren i UI:t stängs av (visar "Privat utgift") och "Lär SmartEkonomi"-checkboxarna är inaktiverade för att inte störa hushållets gemensamma minne med privata transaktioner.

**Användargränssnitt & Förtroende (`BankImportModal.tsx`):**
- **Filtrering & Färgkodning:** Minskar larmtrötthet och låter användaren välja bort bruset.
- **Extrem Transparens ("Visa varför"):** Genom att klicka på `▼ Visa varför` kan användaren exakt se hur appen fattat sitt beslut: Ursprunglig text, Alias-omvandling och Matchningskälla.
- **Explicit Inlärning:** Inga bakgårds-AI-regler skapas utan att "Lär SmartEkonomi"-checkboxen är ibockad.
- **Auto-Konto:** Om användaren kryssar i en "Övrig transaktion" väljs automatiskt första tillgängliga konto/person för att undvika att raden ljudlöst sorteras bort pga ogiltig data.

### Varför:
Filosofin bygger på tillit och absolut kontroll. Om systemet utger sig för att "Vara säkert till 86%" bygger det omedvetet upp osäkerhet hos användaren. Genom transparenta färger, skydd mot dubbletter, vattentäta skott mellan Privat och Gemensamt, samt manuell handpåläggning känns produkten pålitlig. Systemet får hellre "missa" än att automatiskt chansa och skapa ett rörigt konto för användaren.

## 16. Sandbox & Demoläge ("Lekplatsen")

### Vad:
Ett fullt fungerande demoläge (aktiveras via en inbjudande knapp på inloggningsskärmen) där besökare kan testa plattformen och dess premium-funktioner (som Bank-import) med påhittad dummy-data. Allt sparas endast lokalt i webbläsarens session, så besökare kan "leka hejvilt" och testa gränserna utan att en enda siffra rör molndatabasen.

### Hur – Arkitektur & Routing:
- **Zustand Interceptor:** Frontendens logik (`store.ts`) sköter alla matematiska beräkningar exakt som i skarp drift. Det enda demoläget gör är att tyst köra `if (get().isDemoMode) return;` millisekunden innan appen försöker synkronisera ändringarna mot Supabase. Resultatet är ett fullt reaktivt UI där Splitwise-sammanställningar, Swish-beräkningar och grafer uppdateras i exakt realtid - men ingen data sparas permanent.
- **Falsk Bank-import (`handleDemoImport`):** Istället för att kräva en fysisk Excel-fil från användaren genereras 23 stycken färdiga mockup-transaktioner (1 lön, 7 räkningar och 15 övriga kortköp). Den riktiga importknappen döljs till förmån för en iögonfallande demo-knapp. All känslig/verklig namndata är borttvättad (ex. `LÖN FÖRETAG AB`).
- **Upplåst UI:** Den annars dolda "Inställningar"-vyn låses upp medvetet så besökaren kan undersöka hur man bygger upp sin konto-struktur, vilket normalt kräver inloggning.

### Varför:
Interaktion säljer. Istället för statiska bilder eller videoguider får användaren "känna och klämma" på hur systemet drar magiska slutsatser ur rå bankdata. Att se Månadsvyns utjämningskassa räkna om sig sekunden efter att man importerar 23 räkningar bygger direkt förtroende för appens kraft. Den lokala interceptorn säkerställer samtidigt att plattformen är säker och att inget sparas.

---

## 35. Crowdsourcad Inlärning & Global Regelmotor

### Vad:
Ett system som gör att SmartEkonomis bankimport blir smartare för **varje ny användare som ansluter sig**. Systemet skapar en nätverkseffekt (vallgrav) där appen lär sig kollektivt av alla hushålls anonyma val, utan att röra personlig data.

Konkret: Om 50 hushåll i Sverige alla klassar "KLARNA" som en räkning, kan administratören med ett knapptryck omvandla det till en global systemregel – och sekunden efter kategoriseras Klarna automatiskt korrekt för **alla** som laddar upp en bankfil.

### Varför:
- **Nätverkseffekt:** Appen blir märkbart bättre för varje ny användare som registrerar sig. Ingen konkurrent som startar om ett år kan kopiera den historiska data som redan samlats in.
- **Vallgrav:** Data som inte samlas in idag kan aldrig återskapas. Genom att starta insamlingen nu (från dag 1) byggs ett data-försprång som är omöjligt att köpa.
- **Användarvärde:** Inom 6–12 månader börjar bankimporten kännas "magisk" – systemet vet redan vad Spotify, Telenor och Hemköp är, utan att användaren behöver lära upp appen manuellt.

---

### 35.1 Databasmodell (`global_learning_votes`)

En strikt, GDPR-säker tabell som sparar anonyma "röster" från hushållen:

| Kolumn | Typ | Beskrivning |
|---|---|---|
| `id` | UUID | Primärnyckel |
| `household_id` | UUID | Röstande hushåll (anonymiserat, visas ej för admin) |
| `normalized_name` | TEXT | Det hårt rengjorda företagsnamnet. **Enda** strängen vi sparar. T.ex. `"KLARNA"` |
| `transaction_direction` | ENUM (`IN`/`OUT`) | Om det var en inkommande eller utgående transaktion |
| `category` | ENUM | `BILL`, `FIXED_INCOME`, `VARIABLE_INCOME` |
| `source` | ENUM | `ONBOARDING`, `BANK_IMPORT`, `MANUAL_ENTRY` |
| `normalization_version` | INTEGER | Version av normaliseringsalgoritmen. Framtidssäkrar datamigreringar |
| `is_active` | BOOLEAN | `false` om hushållet tagit bort regeln (soft delete – bevarar historik) |
| `first_seen_at` | TIMESTAMPTZ | När rösten skapades |
| `updated_at` | TIMESTAMPTZ | När rösten senast uppdaterades |

**Unique Constraint:** `(household_id, normalized_name, transaction_direction, category)`

> **Varför category i constrainten?** Samma företag (t.ex. `SKATTEVERKET`) kan vara en `BILL` (kvarskatt, OUT) OCH `VARIABLE_INCOME` (skatteåterbäring, IN) för samma hushåll. Utan category i constrainten skulle systemet krocka. Med category kan ett hushåll ha båda rösterna oberoende av varandra.

**Index:**
- `idx_glv_name` på `normalized_name` – för snabb GROUP BY i Fas 2.
- `idx_glv_active` på `is_active` – för att filtrera bort inaktiva röster.

**Upsert-logik:** Om ett hushåll ångrar sig och ändrar "LÖN VOLVO" från `FIXED_INCOME` till `VARIABLE_INCOME` skrivs deras gamla röst över via `ON CONFLICT DO UPDATE`. Historik bevaras aldrig på bekostnad av korrekthet.

---

### 35.2 Postgres ENUMs

Istället för fritext-fält använder tabellen Postgres-inbyggda ENUMs:
- `learning_category_enum`: `'BILL'`, `'FIXED_INCOME'`, `'VARIABLE_INCOME'`
- `learning_source_enum`: `'ONBOARDING'`, `'BANK_IMPORT'`, `'MANUAL_ENTRY'`
- `transaction_direction_enum`: `'IN'`, `'OUT'`

**Varför?** Detta gör det omöjligt att råka spara `"bill"` eller `"BILLS"` istället för `"BILL"`. All data är garanterat konsekvent från dag ett, oavsett om rösten kom från SetupWizard, ManageBills eller en framtida mobilapp.

---

### 35.3 Centraliserad Normalisering (`src/utils/normalization.ts`)

All normalisering sker via en enda central funktion `normalizeLearningString(name: string)`:

1. **Tvätta bort brus:** Tar bort ord som `AB`, `Sverige`, `AUTOGIRO`, `INC`, `.COM`, etc.
2. **Rensa specialtecken:** Tar bort siffror och icke-alfanumeriska tecken.
3. **Kvalitetsspärr:** Om resultatet är under 3 tecken returneras `null` och rösten ignoreras tyst. Detta förhindrar att meningslösa strängar som `"A"`, `"AB"`, eller `"SE"` sipprar in i databasen.

**Varför centraliserat?** Om `SetupWizard.tsx` och `ManageBills.tsx` vardera har sin egen normalisering kan de producera olika resultat för samma sträng, vilket splittrar datan i databasen. Med en enda gemensam funktion garanteras att `"TELENOR AB"` och `"AUTOGIRO TELENOR"` alltid normaliseras till exakt `"TELENOR"`, oavsett var i appen rösten skapas.

Funktionen återanvänds dessutom av `bankParser.ts` (via `normalizeBankString`) för att säkerställa att normaliseringen är 100% identisk i hela systemet.

---

## 36. Sessionshantering & Inloggningspersistens

### 36.1 Problemet

Användare loggades ut "plötsligt" på både dator och mobil simultant, trots att de var hemma på WiFi. Orsaken var en kombination av två saker:

**Problem 1 – För kort token-livstid:**
`JWT Access Token expiry` stod på standardvärdet **3600 sekunder (1 timme)**. Det innebar att appen behövde hämta en ny "biljett" varje timme.

**Problem 2 – Supabase "Token Reuse Detection" aktiverad:**
Supabase hade inställningen **"Detect and revoke potentially compromised refresh tokens"** påslagen. Denna funktion är designad för att skydda mot hackare som stjäl tokens.

**Varför den slog fel mot mobilanvändare:** När mobilens OS (iOS/Android) låser skärmen för att spara batteri, fryser det appen mitt i ett `refresh_token`-anrop. Appen hinner skicka begäran men aldrig ta emot svaret. När användaren sedan tar upp mobilen, skickar appen **samma token igen**. Supabase tolkar detta som ett replay-attack från en hackare och kastar genast ut användaren från **alla enheter** (dator inkluderat).

### 36.2 Lösning

**Steg 1 – Öka token-livstiden (i Supabase Dashboard):**
Settings → JWT Keys → **Access token expiry time**
Ändrat från `3600` till `604800` (7 dagar = max på gratisplanen).

**Steg 2 – Stäng av överkänslig säkerhetsfunktion (i Supabase Dashboard):**
Authentication → Sessions → **"Detect and revoke potentially compromised refresh tokens"**
Stängt **av** (grå knapp istället för grön).

### 36.3 Effekt

Användaren behöver nu bara logga in igen om hen inte öppnat appen på mer än **7 dagar**. Normal användning på mobil och dator håller sessionen aktiv utan avbrott.

---

## 37. Global Inlärning – Buggfixar och Förbättringar

### 37.1 Bugg: Kolumnerna `target_id` och `rule_target_type` saknas

**Problemet:** Flera SQL-funktioner försökte skriva kolumner (`target_id`, `rule_target_type`) till `household_import_rules`-tabellen som aldrig existerade i produktionsdatabasen. Dessa kolumner togs bort i ett tidigare arkitekturbeslut (systemet mappar inte regler mot specifika konton längre), men INSERT-satserna i RPC-funktionerna var inte uppdaterade.

**Felmeddelandena:**
- *"column target_id of relation household_import_rules does not exist"* – visades vid onboarding av nytt konto
- *"column rule_target_type of relation household_import_rules does not exist"* – visades när admin tryckte OK i Inlärningsvyn

**Fix 1 – `add_rpc_create_household_setup.sql`:**
Tog bort alla `INSERT INTO household_import_rules`-block ur onboarding-RPC:n. Motivering: `global_learning_votes` hanterar nu crowdsourcad inlärning. Lokala regler skapas automatiskt vid faktisk bankimport, inte vid registrering.

**Fix 2 – `add_global_learning_votes.sql`:**
Tog bort `target_id` och `rule_target_type` ur `admin_approve_system_rule`-funktionens INSERT-sats.

### 37.2 Admin Inlärningsgränssnitt – Förbättringar

Fil: `src/pages/AdminLearning.tsx`

| Förut | Nu |
|---|---|
| Webbläsarens `window.confirm()` (vit OS-ruta) | Anpassad mörk modal som matchar appens design |
| Webbläsarens `window.alert()` vid fel | Anpassad felmeddelanderuta med rödorange accent |
| Ingen Neka-knapp | Röd "Neka"-knapp bredvid OK på varje kandidat |
| Kategori kan ej ändras | Dropdown i godkänn-modalen för att korrigera kategori innan sparning |

**Neka-flöde:**
Admin trycker "Neka" → bekräftelsedialog → `admin_reject_system_rule` RPC anropas → kandidatens röster sätts till `is_active = false` → kandidaten försvinner från listan direkt.

**Redigera kategori vid godkännande:**
Godkänn-modalen visar en `<select>` med tre alternativ: `🧾 Räkning`, `💰 Fast inkomst`, `📈 Rörlig inkomst`. Admin kan korrigera en felklassad post (t.ex. "LÖN" klassad som Fast inkomst → ändra till Rörlig inkomst) direkt i modalen innan sparning.

### 37.3 Uppdaterade SQL-funktioner (`admin_learning_update.sql`)

`admin_approve_system_rule` fick två nya parametrar:
- `p_original_category` – den kategori rösterna ursprungligen hade (används för att avaktivera rätt röster)
- `p_new_category` – den kategori admin valt (kan skilja sig, styr `is_bill`-fältet i den sparade regeln)

Ny funktion `admin_reject_system_rule` lades till – avaktiverar alla röster för ett givet `normalized_name` + `transaction_direction` + `category`.

**OBS: Dessa funktioner måste köras manuellt i Supabase SQL Editor från filen `admin_learning_update.sql`.**

### 37.4 Demo-läge läcker inte längre till Global Inlärning

**Problemet:** Sidan `/demo` låter besökare testa bankfilsimport. Koden i `ManageBills.tsx` skickade UPSERT till `global_learning_votes` oavsett om man var i demo-läge. Alla fejk-transaktioner (BARNBDR, BOENDE, EON KUNDSUPPORT, GOOGLE GOOGLE ONE DUBLIN etc.) hamnade i admin-inlärningslistan.

**Fix (`src/components/ManageBills.tsx`):**
`isDemoMode` var redan importerat från store men skyddade inte inlärningsskrivningarna. Lade till `if (!isDemoMode)` runt **båda** UPSERT-blocken (ett för inkomster/IN, ett för räkningar/OUT):

```typescript
// EJ i demo-läge
if (!isDemoMode) {
  await supabase.from('global_learning_votes').upsert({ ... });
}
```

**Effekt:** Demo-besökare kan testa hur som helst utan att förorena inlärningssystemet. Befintliga fake-kandidater kan adminen rensa med den nya Neka-knappen.

### 37.5 Filer som berörs

| Fil | Förändring |
|---|---|
| `add_global_learning_votes.sql` | **[UPPDATERAD]** `admin_approve_system_rule` – tog bort `target_id` och `rule_target_type` |
| `add_rpc_create_household_setup.sql` | **[UPPDATERAD]** Tog bort alla `INSERT INTO household_import_rules`-block |
| `admin_learning_update.sql` | **[NY]** Uppdaterade RPC:er med stöd för neka och kategoriändring |
| `src/pages/AdminLearning.tsx` | **[UPPDATERAD]** Custom modaler, Neka-knapp, kategori-dropdown |
| `src/components/ManageBills.tsx` | **[UPPDATERAD]** Demo-skydd runt `global_learning_votes` UPSERT |

---

**A) SetupWizard (`ONBOARDING`)**
När en ny användare slutför onboardingen och sparar sina räkningar/inkomster via RPC-funktionen `create_initial_household_setup`, skickas automatiskt rösterna in till `global_learning_votes`. Varje räkning får `transaction_direction = 'OUT'` och `category = 'BILL'`. Inkomster får `direction = 'IN'` och `category` baserat på om det är fast eller rörlig lön.

**B) ManageBills – Bankimport (`BANK_IMPORT`)**
Varje gång en användare laddar upp en bankfil och bekräftar importen via `BankImportModal`, skickas en röst till `global_learning_votes` för varje ny räkning/inkomst som sparas. Befintliga regler som redan är lärda skapar inga nya röster (för att undvika att ett hushåll "röstar" upprepade gånger på samma sak).

**C) Upsert-skyddet**

---

### 35.5 Konsensusmotor (`global_learning_candidates_view`)

En PostgreSQL-View som i realtid räknar ut hur stark konsensus det finns kring varje kandidat:

```sql
SELECT normalized_name, transaction_direction, category,
  COUNT(DISTINCT household_id) as household_count,
  MIN(first_seen_at) as first_discovered_at
FROM global_learning_votes
WHERE is_active = true
GROUP BY normalized_name, transaction_direction, category
HAVING COUNT(DISTINCT household_id) >= 1;
```

I Fas 2 justeras `HAVING`-tröskeln till `>= 5` och läggs till ett konsensusfilter på `>= 85%` enighet. Under Fas 1 står den på `>= 1` för att administratören ska kunna se systemet växa i realtid.

---

### 35.6 Admin-gränssnitt (`/admin/learning`)

En dold, skyddad sida (`src/pages/AdminLearning.tsx`) som bara visas för system-administratörer (de som finns i tabellen `system_admins`).

**Flödet:**
1. Admin loggar in och navigerar till "🧠 Inlärning" i menyn.
2. Sidan läser live-data från `global_learning_candidates_view`.
3. En tabell visar alla kandidater: Namn | Riktning | Kategori | Antal hushåll.
4. Admin klickar `[Godkänn]` på t.ex. "KLARNA | OUT | BILL | 42 hushåll".
5. Frontend anropar RPC-funktionen `admin_approve_system_rule(...)`.
6. Databasen skapar en ny rad i `household_import_rules` med `rule_type = 'SYSTEM'` och `household_id = NULL`.
7. `bankParser.ts` hämtar redan alla regler oavsett `household_id` – den nya SYSTEM-regeln är omedelbart live för **alla** användare i hela systemet.
8. Rösterna i `global_learning_votes` sätts till `is_active = false` och kandidaten försvinner från listan.

**Säkerhet:** Godkännande sker via RPC-funktionen `admin_approve_system_rule` som är skyddad med `SECURITY DEFINER` och dubbelkollar `is_user_admin()` inuti databasen. Ingen vanlig användare kan kringgå detta.

---

### 35.7 Sparad-till-Fas-2-lista (Medvetet uteslutna funktioner)

Följande funktioner diskuterades men uteslöts medvetet ur Fas 1 för att undvika teknisk skuld och overengineering:

| Funktion | Varför väntar vi? |
|---|---|
| `bank_name` (SEB, Swedbank...) | Risk för overfitting. Inga hårda regler baserade på bank i Fas 2 förrän vi har tillräcklig data. |
| `normalized_name_hash` (SHA-256) | "Arkitekturporr". Ingen faktisk nytta så länge klartexten ändå finns i samma tabell. Kan läggas till senare om GDPR-krav förändras. |
| Adminpanel för konsensusmotor | Byggs nu (Fas 1) men aktiveras när data växt till > 5 hushåll per kandidat. |
| Auto-genererade SYSTEM-regler | Aldrig automatiskt. Admin godkänner alltid manuellt för att garantera datakvalitet. |
| `confidence_score` | Reserverat i tabellen (NULL default) men används inte förrän konsensusmotorn är aktiv. |

---

### 35.8 GDPR-design

- **Ingen `original_name` sparas.** Råa banksträngarna (som `"AUTOGIRO KLARNA BANK AB 55610..."`) kan innehålla personnummer eller organisationsnummer. Systemet sparar aldrig originaltexten – enbart det normaliserade resultatet (`"KLARNA"`).
- **Röster är anonyma.** `household_id` kopplar rösten till ett hushåll, men administratören ser bara det normaliserade namnet och hur många hushåll som röstat. Ingenting kan spåras tillbaka till en enskild person.
- **`is_active = false` istället för DELETE.** Data raderas aldrig – den inaktiveras. Detta möjliggör historisk analys och eventuell dataåterställning utan att tappa spårbarhet.

---

### 35.9 Framtida Fas 2-plan (Konsensusmotorn)

När plattformen har 500–1000 hushåll aktiveras nästa fas:
1. **Dashboard med konsensuspoäng:** Visar `household_count` och `%` eniga.
2. **Tröskeljustering:** Höj `HAVING`-gränsen till `>= 5` och lägg till ett `>= 85% enighet`-filter direkt i SQL-vyn.
3. **`confidence_score`-kolumnen aktiveras:** Systemet kan börja lagra och visa konfidenspoäng per kandidat.
4. **Automatiska kategoriförslag:** Parsern kan visa användaren `"97% av hushåll klassar detta som en räkning"` som ett informationsmeddelande (utan att tvinga kategorin).

### 35.10 Filer som berörs

| Fil | Förändring |
|---|---|
| `add_global_learning_votes.sql` | **[NY]** Skapar ENUMs, `global_learning_votes`, index, RLS-policies, konsensus-vyn och `admin_approve_system_rule`-RPC |
| `add_rpc_create_household_setup.sql` | **[UPPDATERAD]** RPC-funktionen tar nu emot `normalized_name`, `transaction_direction`, `source` per räkning/inkomst och sparar röster |
| `src/utils/normalization.ts` | **[NY]** Central normaliseringsfunktion `normalizeLearningString()` |
| `src/utils/bankParser.ts` | **[UPPDATERAD]** `normalizeBankString()` återanvänder nu `normalizeLearningString()` istället för duplicerad kod |
| `src/components/SetupWizard.tsx` | **[UPPDATERAD]** Skickar `normalized_name`, `transaction_direction` och `source` med i RPC-anropet |
| `src/components/ManageBills.tsx` | **[UPPDATERAD]** UPSERT till `global_learning_votes` vid bekräftad bankimport |
| `src/pages/AdminLearning.tsx` | **[NY]** Admin-sida för att granska och godkänna kandidater |
| `src/App.tsx` | **[UPPDATERAD]** Routing för `/admin/learning`-vyn och ny menypost "🧠 Inlärning" för admins |

---

## 38. Produkttelemetri-roadmap – Bakgrund och Strategi

### Vad
Ett komplett system för att mäta, förstå och förbättra konverteringsflödet i SmartEkonomi. Byggt i fem sprintar 2026-06-17.

### Varför
Med 85 unika besökare, 12 demo-användare och 1 betalande kund är den kritiska frågan inte *hur man bygger fler funktioner* – utan *varför 84 av 85 besökare inte skapade ett konto*. Svaret finns i tre lager:

1. **Funnel Analytics** – var i flödet folk lämnar (aggregerad data)
2. **Session Replay** – exakt vad de gjorde och var de fastnade (inspelning)
3. **Live Presence** – vem som är inne på sajten just nu (realtid)

Prioriteringen är medveten: varje procents förbättring i konvertering ger mer intäkt än att skaffa fler besökare.

### Prioritetsordning (affärsvärde per timme)
| Sprint | Feature | Motivering |
|---|---|---|
| 1 | funnel_events + hooks | Datainsamling startar direkt |
| 2 | Microsoft Clarity | 15 min setup, spelar in från första besökaren |
| 3 | Funnel-dashboard i Admin | Visualiserar Sprint 1-data |
| 4 | Live Presence-panel | Support och realtidsinsikt |
| 5 | Crowdsourcing Fas 2 | Aktiveras vid 500+ hushåll |

---

## 39. Funnel Analytics – funnel_events (Sprint 1)

### Vad
Händelsebaserad spårning av konverteringssteg. Varje steg i flödet loggas anonymt i tabellen `funnel_events`.

### Varför händelsebaserat?
Att spara sidvisningar (`visitor_stats`) och räkna ut vad användarna *gjorde* blir alltid oprecist. Event-baserad tracking ger exakta svar: "hur många startade bankimport" vs "hur många fullföljde den".

### Databas
```sql
CREATE TABLE public.funnel_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  TEXT NOT NULL,       -- anonymt UUID per flik (sessionStorage)
    user_id     UUID,                -- null om ologgad
    event       TEXT NOT NULL CHECK (event IN (...)),
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT now()
);
```

**RLS:** Alla (inkl. anonyma) får INSERT via anon-nyckeln. Enbart admin får SELECT.

### Events
| Event | Triggas i |
|---|---|
| `page_view` | `App.tsx` – varje vybyte (ej demo) |
| `demo_start` | `LoginScreen.tsx` – demo-knapp klickad |
| `register_start` | `LoginScreen.tsx` – formulär byts till "Skapa konto" |
| `bank_upload_complete` | `ManageBills.tsx` – lyckad bankimport |
| `onboarding_complete` | `SetupWizard.tsx` – lyckad `create_initial_household_setup` |
| `premium_complete` | *(planerat – Stripe webhook)* |

### Hook: useFunnelTracker.ts
Fire-and-forget – misslyckas tyst, påverkar aldrig UX. Hämtar `session_id` från `sessionStorage` och `user_id` asynkront från Supabase auth.

### SQL-fil
`add_funnel_events.sql` – kör i Supabase SQL Editor en gång.

---

## 40. Session Replay – Microsoft Clarity (Sprint 2)

### Vad
Gratis verktyg utan sessionsgränser som spelar in besökarsessioner och genererar heatmaps.

### Varför Clarity?
- Gratis, obegränsade sessioner
- Ingen backend behövs – ett JS-snippet räcker
- GDPR-kompatibelt

### Implementation
Snippet i `<head>` i `index.html`:
```html
<script type="text/javascript">
  (function(c,l,a,r,i,t,y){...})(window, document, "clarity", "script", "x8gc3z5r1r");
</script>
```

**Projekt-ID:** `x8gc3z5r1r`  
**Åtkomst:** [clarity.microsoft.com](https://clarity.microsoft.com)

---

## 41. Funnel-dashboard i AdminDashboard (Sprint 3)

### Vad
Visuell konverteringsfunnel i adminpanelen under "Besöksstatistik".

### Funktioner
- **Tidsfilter:** 7 dagar / 30 dagar / Totalt
- **Staplar per steg** med animering
- **Färgkodning:** Grön (≥70%), Orange (40–69%), Röd+⚠️ (<40% av föregående)
- **Störst drop-off:** Automatisk röd ruta som pekar ut värsta flaskhalsen

### Data
Hämtas direkt från `funnel_events`. Unika sessioner räknas med `Set<string>` på klientsidan.

---

## 42. Live Presence-panel (Sprint 4)

### Vad
Realtidspanel i adminpanelen – visar aktiva sessioner, fördelade per sida, med stuck-lista.

### Teknik: Supabase Realtime Presence
WebSocket-baserat. Klienter anmäler sin närvaro. Kopplar en klient ner (stänger fliken) försvinner de omedelbart – ingen polling, ingen databas, ingen kostnad.

### Arkitekturprincip – En kanal, centralt hanterad
Supabase tillåter INTE att lägga till `presence`-callbacks på en kanal som redan är subscribed. Regeln:

> **Lägg alltid till alla `.on()`-callbacks INNAN `.subscribe()` kallas.**

Lösning:
- **`App.tsx`** – Skapar kanalen, lägger till `sync`-listener OCH kallar `.track()` i samma `useEffect`. Sparar sessioner i Zustand.
- **`AdminDashboard.tsx`** – Läser bara från Zustand. Ingen egen channel, ingen subscription.

### Payload per session
```typescript
{
  session_id: string,       // UUID per flik (sessionStorage)
  user_id: string,          // auth UID eller 'anonymous'
  role: 'admin'|'user'|'anonymous',
  page: '/dashboard',
  page_label: 'Dashboard',
  page_entered_at: string,  // ISO-timestamp
}
```

### Stuck-tröskelvärdena (minuter)
| Sida | Flaggas efter |
|---|---|
| `/login` | 2 min |
| `/register` | 3 min |
| `/` | 5 min |
| `/demo` | 8 min |
| Alla andra | 10 min |

Stuck-listan är **inte automatisk** – admin väljer aktivt att kontakta. Avsiktligt för att undvika känsla av övervakning.

### Demo-läge
Presence-tracking aktiveras inte i demo-läge. Demo-sessioner syns aldrig i adminpanelen.

### Zustand-integration
`PresenceEntry` exporteras från `store.ts`. `presenceSessions: PresenceEntry[]` läggs till i StoreState.

### Filer
| Fil | Ändring |
|---|---|
| `src/store.ts` | **[UPPDATERAD]** `PresenceEntry`-typ exporteras, `presenceSessions` i state |
| `src/App.tsx` | **[UPPDATERAD]** En kanal – tracking + lyssning + Zustand-uppdatering |
| `src/components/AdminDashboard.tsx` | **[UPPDATERAD]** Läser från Zustand, `useMemo` för stuck/grupper |

---

## 43. Admin Learning Engine – Fas 1 (RPC-funktioner)

### Vad
Två SQL-funktioner som ger admin kontroll över crowdsourcing-kandidater.

### Funktioner
| RPC | Vad den gör |
|---|---|
| `admin_approve_system_rule(...)` | Skapar en SYSTEM-regel baserat på *ny* kategori (om admin ändrat) och inaktiverar ursprungliga röster |
| `admin_reject_system_rule(...)` | Inaktiverar röster (`is_active = false`) utan att skapa regel |

### Säkerhet
Båda funktionerna kontrollerar `is_user_admin()` i SECURITY DEFINER-kontexten. Anrop utan admin-rättigheter kastar `EXCEPTION 'Access denied'`.

### SQL-fil
`admin_learning_update.sql` – kör i Supabase SQL Editor en gång.

---

## 44. Sprint 5 – Crowdsourcing Fas 2 (planerat, ej byggt)

### Aktiveras vid
500–1000 aktiva hushåll. Meningslös med färre – datan för gles.

### Vad som ändras
Tre SQL-rader i konsensus-vyn:

| Ändring | Från | Till |
|---|---|---|
| Minsta antal hushåll | `>= 1` | `>= 5` |
| Enighetsfilter | saknas | `>= 85%` |
| Confidence score | saknas | beräknas och visas |

Admin godkänner alltid manuellt – ingen auto-godkännande planeras.

---

## 45. Kundservice & Supportchatt (Live)

### Vad
Ett inbyggt, liveuppdaterat chattsystem för kundtjänst/support. Administratörer eller utvalda agenter kan chatta i realtid med inloggade medlemmar eller anonyma besökare. 

### Hur
Systemet är helt byggt på Supabase Realtime (`postgres_changes`) för blixtsnabba uppdateringar utan page reloads och manuella hämtningar.

#### Databasarkitektur
| Tabell | Beskrivning |
|---|---|
| `chat_sessions` | Representerar ett ärende. Har en status (`waiting`, `active`, `closed`). Kopplas till `user_id` (inloggad kund) eller `visitor_id` (anonym), samt `assigned_to` (vilken agent som tagit ärendet). |
| `chat_messages` | Innehåller själva chattmeddelandena. `sender_type` är antingen `user` eller `admin`. Kopplas till ett `session_id`. |
| `agent_sessions` | Representerar agenternas inloggningsstatus (`offline`, `available`, `busy`, `post_work`, `break`, `lunch`). Om ingen agent är available, busy eller post_work stängs chatten automatiskt ned. |

#### Agenthantering (Gud-användare & chat_agent flaggan)
- Agenträttigheter hanteras via kolumnen `chat_agent` (boolean) på `profiles`-tabellen. Endast systemadministratörer kan aktivera eller stänga av agenter. Detta görs via "Kundservice-knappen" i Admin Dashboard.
- **Gud-användare (apersson508@gmail.com):** Har alltid tillgång till Kundservice i huvudmenyn oavsett om `chat_agent`-flaggan är true eller false. Funktionen döljs dock för gud-användaren i *Admin-vyns* toggles för att undvika oavsiktlig avaktivering.
- **Live-uppdatering av åtkomst:** Om en admin aktiverar kundtjänsträttigheten för en kollega uppdateras `isChatAgent`-state live i frontend tack vare en dedikerad `supabase.channel` som lyssnar på uppdateringar av `profiles`-tabellen i `AuthContext`. 

#### Agent Statusar & Efterarbete
Agenter har detaljerad kontroll över sin tillgänglighet i systemet utan att behöva logga ut:
- **Ledig (`available`):** Redo att ta nya ärenden.
- **I ärende (`busy`):** Hanterar aktivt en chatt.
- **Efterarbete (`post_work`):** Administrativt arbete direkt efter ett samtal (ex. dokumentation). Chatten hålls öppen för nya besökare på sajten, men agenten förväntas inte svara omedelbart.
- **Rast (`break`) & Lunch (`lunch`):** Agenten är på paus. Om inga andra agenter är tillgängliga kommer kundtjänsten automatiskt stängas ner för nya besökare på sajten.
- **Hur:** Hanteras via status-rullgardin i SupportView. Status ändras via RPC `agent_set_status`.

#### Helskärmsläge för agenter (Fullscreen Chat)
I `SupportView.tsx` kan en agent toggla "helskärmsläge" genom en dedikerad knapp (🖵).
- **Varför:** För att ge agenten en ostörd miljö utan sidomenyer när kön är stor.
- **Hur:** Använder ett React-state (`isFullscreen`) som dynamiskt sätter CSS-regler (`position: fixed`, z-index, etc.) på huvudcontainern så att den täcker hela fönstret.

#### Ärendehantering (Auto-Routing, Andrum och Tilldelning)
1. **Kund skriver ("Hej"):** Skapar en ny `chat_session` med status `waiting`. Kunden ser informationen "Du ställs i kö. Din köplats är X."
2. **Kön är dold (SupportView):** Agenter ser inte längre en lista på väntande kunder som de aktivt måste välja ifrån. Istället visas enbart övergripande statistik på väntande kunder och längsta kötid. Detta eliminerar stress och tvekan.
3. **20-sekunders Andrum (Cooldown):** För att ge agenten tid att pusta ut och byta status mellan samtal, infaller en 20-sekunders fördröjning ("Cooldown") varje gång agenten blir `Ledig`.
4. **Automatisk Tilldelning (Ring-logik):** Ett "Smart-Routing"-system kontrollerar löpande via frontend-klienterna vem som är den "äldsta" tillgängliga (Lediga) agenten. Om kön är tom och en ny kund plötsligt skriver, får alltså den agent som stått ledig längst tid ärendet tilldelat till sig omedelbart (förutsatt att andrummet på 20s är över). Klienten ropar på RPC:n `auto_assign_oldest_chat`.
5. **Assigned & Kundnotis:** Databasen tilldelar det äldsta ärendet och ändrar statusen från `waiting` till `assigned`. I detta ögonblick uppdateras kundens chattbubbla från "Köplats" till att visa: *"Agent kopplas in..."*. Hos agenten plingar det (push-notis) och en stor knapp *"🔔 Ta ärende"* visas.
6. **Chatt & Live Timer:** När agenten klickar "Ta ärende" körs RPC:n `accept_assigned_chat_session` som sätter status till `active`. Databasen skjuter automatiskt ut ett välkomstmeddelande ("Agenten är här, vad kan jag hjälpa dig med?"). I UI:t visas en realtidsuppdaterande klocka (`⏱ Öppet i 0:15`) bredvid ärende-ID:t.
7. **Avslut:** Agenten klickar på den enda avslutningsknappen "✅ Avsluta ärende". Via RPC `release_chat_session` sätts ärendet till `closed` och agenten blir automatiskt `available` (`Ledig`), varpå det 20 sekunder långa andrummet (cooldown) startar på nytt.

#### Agent Live-Monitor & Prestationer (Admin Dashboard)
Systemadministratörer kan följa upp hur effektiv supporten är och se vad agenterna gör i realtid under "Kundservice"-fliken.
- **Live Monitor (`AgentLiveMonitor`):** En widget som visar en lista på alla online-agenter, vilken specifik status de har just nu (Ledig, I ärende, Rast etc) samt en tickande klocka (tidtagarur) som visar exakt hur länge de haft denna status. Synkas helt utan dröjsmål via Supabase Realtime (`postgres_changes` på `agent_sessions`).
- **Historisk Prestation (`SupportAgentStatsWidget`):** En tabell som visar antal lösta ärenden och genomsnittlig hanteringstid per agent. Kan filtreras på idag, igår, senaste veckan och senaste månaden. Istället för tunga databas-views hämtar React-komponenten alla `chat_sessions` där `status = 'closed'` inom det valda tidsintervallet och räknar snitt-tiden live i webbläsaren baserat på skillnaden mellan `created_at` och `updated_at`.

#### Auto-open & Close
En SQL-Trigger (`sync_chat_open_from_agents`) ligger på `agent_sessions`-tabellen. 
- När antal agenter med status `available`, `busy` eller `post_work` är > 0 sätts globala inställningen `chat_open` till `true`.
- När alla agenter går till `offline`, `break` eller `lunch` sätts den till `false`. Frontend-klienten anpassar sedan om supportknappen/chattrutan ska gå att öppna för slutanvändarna.

#### Säkerhet för Anonyma och RLS-låsningar
Besökare har via ett fix-skript (`support_user_rls.sql`) givits tillgång till att sätta in `chat_sessions` utan ett aktivt `user_id` inloggnings-objekt (med hjälp av en webbläsargenererad cookie). RLS-reglerna är kalibrerade för att tillåta läsning av den egna sessionen med en `OR (visitor_id IS NOT NULL AND user_id IS NULL)` check.
För att undvika att databasen kastar "permission denied" i RLS-kedjan har de inbyggda ofarliga helper-funktionerna `user_in_household` och `is_user_admin` aktiverats för public access.

#### Felsökning vid SQL-missar
Om tabellerna eller RPC:erna (som `agent_connect`) inte har exekverats via SQL Editor i Supabase (t.ex. efter databasåterställning), kommer agenten att se en tydlig röd banner med felmeddelande istället för att funktionen tyst misslyckas.

#### Automatiskt Dold Chatbubbla i Kundservice-vyn
- **Vad:** När en agent eller behörig användare navigerar till kundservice-vyn (`/support`) döljs den flytande kundservice-chatbubblan (`ChatBubble`) automatiskt. På alla andra sidor visas den som vanligt.
- **Hur:** I `App.tsx` renderas `<ChatBubble />` villkorligt med `{!isChatAgent && currentView !== 'support' && <ChatBubble />}`. Villkoret `currentView !== 'support'` säkerställer att bubblan försvinner så snart vyn byter till `'support'` och återkommer omedelbart när agenten navigerar till en annan vy.
- **Varför:** Chatbubblan är avsedd för slutanvändare som behöver kontakta support. När en agent redan befinner sig inne i kundservice-panelen och aktivt hanterar ärenden är bubblan onödig — den tar upp skärmyta, kan överlappa med chattfönstret och skapar en förvirrande upplevelse. Att dölja den ger agenten en renare arbetsyta.


### SEO, UI-Finputsning & Legal Compliance (Stripe & GDPR)

#### SEO & Sökordsoptimering
- **Sitemap & Robots:** Har lagts till i `public/` mappen (`sitemap.xml` och `robots.txt`) för att säkerställa att Google indexerar hela sajten och kan navigera den effektivt.
- **FAQ Structured Data (JSON-LD):** En dold `<script type="application/ld+json">` har lagts till i `index.html` <head> tagg. Detta definierar en "FAQPage" enligt Schema.org vilket ger Google möjlighet att visa frågor och svar direkt i sökresultaten ("Utökat resultat").

#### Inloggning & Demoläge UI
- **Renare Inloggningsvy:** Tydligare fokus på "Testa fritt i 14 dagar". Texterna har städats upp och primära actions pekar direkt till "Starta provperiod". Ordet "gratis" har tagits bort från knapparna.
- **Tydligare Demo-Banner:** I demoläget har uppmaningen till att skapa konto förtydligats. Den tidigare röriga layouten med två lila element har förenklats så att informationstexten är ren text och den faktiska Call-to-Action knappen för att starta provperiod sticker ut ordentligt.

#### Stripe & GDPR-Compliance (Användarvillkor & Integritetspolicy)
För att klara Stripes granskning och uppfylla GDPR har juridiska policys i sidfoten (`InfoModal.tsx`) byggts ut med kompletta texter:
- **Användarvillkor (TOS):**
  - **Ansvarsfriskrivning:** Specifik ansvarsbegränsning att appen är ett kompletterande hjälpmedel och ingen finansiell rådgivning. Företaget hålls skadelöst från ekonomiska beslut baserade på appens data.
  - **Uppsägning:** En exakt beskrivning för hur användaren avslutar tjänsten via "Mina Sidor -> Premium -> Hantera Prenumeration" (som öppnar Stripe Portal).
  - **Återbetalningar:** Tydligt villkor om att inga återbetalningar görs för delvis utnyttjade månader.
- **Integritetspolicy (Privacy Policy):**
  - **Dynamisk Personuppgiftsansvarig:** Hämtar automatiskt företagsnamn och e-postadress från inställningar i databasen via `global_settings`.
  - **Tredjepart & GDPR-Rättigheter:** Klargör att Stripe hanterar all betaldata (vi sparar inte kort), rätten till radering (SQL Cascade), samt rätten att klaga till IMY.
