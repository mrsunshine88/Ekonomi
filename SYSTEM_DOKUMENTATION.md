# Ekonomi & Swish - Systemdokumentation

**Plattform:** React + TypeScript + Vite (PWA) | Databas: Supabase (PostgreSQL) | Hosting: Vercel  
**Uppdaterad:** 2026-06-11

---

## 1. Vad är Ekonomi & Swish?

Det är en webb-applikation (byggd i React, TypeScript och Vite) som automatiskt räknar ut hur hushållets gemensamma räkningar ska delas. Den eliminerar behovet av miniräknare och kalkylark.

Appen stöder ett obegränsat antal gemensamma konton och personliga konton, och hanterar avancerad Splitwise-matematik i bakgrunden. Den är byggd som en PWA (Progressive Web App) och fungerar som en riktig app på mobilen – ingen App Store behövs.

**Appens fem huvudvyer (i ordning uppifrån och ner i menyn):**
- `📅 Månadsvy` – Gemensamma räkningar, mata in belopp, markera som överförda.
- `🔒 Privat` – Personliga utgifter och privata lån, synliga enbart för dig.
- `📊 EkonomiTB` – Historisk statistik, grafer, skuld-avbetalningskontroll.
- `👤 Mina sidor` – Kontoinformation, hushållskod och lämna-hushåll.
- `⚙️ Inställningar` – Hantera räkningar, konton, lås och allmänna inställningar.

---

## 2. Databasarkitektur – Relationsdatabas (v3.0)

### Vad:
All data lagras i en **fullt normaliserad relationsdatabas** i Supabase (PostgreSQL). Varje datatyp har sin egen tabell. Detta är den avgörande skillnaden mot v2.0 som sparade allt som ett enda stort JSON-dokument.

### Hur – Databastabeller:

| Tabell | Innehåll |
|--------|----------|
| `households` | Ett hushåll per rad. Används fortfarande som ankarpunkt med `id` (UUID). |
| `profiles` | En profil per användare. Kopplar `user_id → household_id`. |
| `accounts` | Konton (gemensamma och personliga). En rad per konto. |
| `bills` | Gemensamma räkningar. En rad per räkning med alla inställningar. |
| `month_bill_amounts` | **En rad per (hushåll + månad + räkning).** Belopp som matats in. |
| `month_handled_payments` | **En rad per (hushåll + månad + payment_id).** Avprickade betalningar. |
| `month_confirmed_anomalies` | En rad per bekräftad avvikelse (anomalidetektion). |
| `private_bills` | Privata räkningar. Stämplade med `user_id`. |
| `private_month_amounts` | En rad per (hushåll + user + månad + privat räkning). |
| `private_month_locks` | En rad per (hushåll + user + månad). Håller lås-status för privata månader. |
| `private_month_anomalies` | Bekräftade avvikelser för privata räkningar. |
| `household_settings` | En rad per hushåll. Allmänna inställningar som `show_summary`. |

### Varför relationsdatabas (och inte JSON)?

Den gamla v2.0-arkitekturen sparade **hela appens tillstånd** som ett enda JSON-dokument. Det innebar att om du och Helena ändrade olika räkningar i exakt samma sekund, vann den som sparade *sist* och den andras ändring försvann.

Med relationsdatabasen uppdateras **enbart den exakta raden** som ändrades. Om du ändrar beloppet på "Elen" uppdateras en enda rad i `month_bill_amounts`. Om Helena ändrar "Hyran" uppdateras en annan rad. De är helt oberoende och kan aldrig skriva över varandra. **Ingen data kan gå förlorad.**

---

## 3. Datainläsning & Realtidssynkronisering

### Vad:
All data laddas från Supabase när appen startar, och uppdateras automatiskt i realtid när någon annan i hushållet gör en ändring.

### Hur (`src/store.ts → useStore(householdId)`):

**Steg 1 – Migrationskontroll:**
Vid allra första inläsningen kontrollerar appen om `accounts`-tabellen är tom för hushållet. Om ja, och det finns data i den gamla `state_json`-kolumnen, körs `runRelationalMigration()` automatiskt en enda gång. Det gamla JSON-dokumentet läses av och all data packas in i de nya tabellerna utan att en enda siffra går förlorad.

**Steg 2 – Initial laddning (`Promise.all`):**
Appen hämtar data från alla 10 tabeller **parallellt** via en enda `Promise.all(...)`. Det gör inläsningen snabb oavsett hur mycket historik som finns.

**Steg 3 – Rekonstruktion av `AppState`:**
De 10 svarspaketen mappas samman till det interna `AppState`-objektet som komponenterna förstår. T.ex. aggregeras alla rader från `month_bill_amounts` till `months[monthId].billAmounts[billId]`.

**Steg 4 – Realtidslyssnare (`supabase.channel`):**
Appen prenumererar på `postgres_changes`-händelser på **alla 10 tabeller** via en och samma Supabase-kanal. Varje ändring i databasen (oavsett vem som gjorde den) triggrar en ny komplett inläsning (`loadCloud()`), debounced till 500ms för att undvika flodvågor av requests om många saker ändras på en gång.

**Steg 5 – Optimistisk UI:**
Varje mutationsfunktion (t.ex. `updateBillAmount`) gör **två saker direkt:**
1. Uppdaterar det lokala React-state omedelbart (UI svarar på en bråkdel av en sekund).
2. Skickar `upsert` till rätt Supabase-tabell asynkront i bakgrunden.

### Varför:
Kombinationen av optimistisk UI + relationsuppdateringar + realtidsprenumeration ger en upplevelse som är lika snabb som en lokal app men alltid i synk med molnet. Inget debounce-fönster med risk för dataförlust längre.

---

## 4. Migreringslogik (`src/migrateToRelational.ts`)

### Vad:
Ett automatiskt engångsskript som körs osynligt i bakgrunden första gången appen startar efter version 3.0-uppdateringen.

### Hur:
1. Läser av `state_json` från `households`-tabellen.
2. Mappar varje del av JSON-dokumentet till rätt ny tabell:
   - `state.accounts` → `accounts`
   - `state.bills` → `bills`
   - `state.months[m].billAmounts` → `month_bill_amounts`
   - `state.months[m].handledPayments` → `month_handled_payments`
   - `state.privateBills` → `private_bills`
   - `state.privateMonths[m].billAmounts` → `private_month_amounts`
   - `state.privateMonths[m].isLocked` → `private_month_locks`
   - `state.settings` → `household_settings`
3. Alla inserts använder `upsert` med `onConflict`-hantering – migreringen kan köras om utan att skapa dubbletter.

### Varför:
Befintliga hushåll med månaders historik behöver inte förlora ett enda öre av sin data. Migreringen sker utan nertid, utan manuellt arbete och utan att användaren märker det.

---

## 5. Row-Level Security (RLS) & Säkerhet

### Vad:
Alla databastabeller är låsta med PostgreSQL Row-Level Security. Ingen kan läsa eller skriva data som inte tillhör deras eget hushåll – inte ens om de skulle manipulera klientkoden.

### Hur:
- **RLS är aktiverat** på alla 10+ tabeller.
- En hjälpfunktion i databasen `user_in_household(hid uuid)` kontrollerar om den inloggade användaren (`auth.uid()`) tillhör hushållet via tabellen `profiles`.
- Alla policys är av typen `FOR ALL USING (user_in_household(household_id))` – funkar för SELECT, INSERT, UPDATE och DELETE i ett svep.
- Privata tabeller (`private_bills`, `private_month_amounts` etc.) kräver dessutom att `user_id = auth.uid()` i klientlogiken, som extra skyddslager.
- Hushålls-ID (UUID) genereras via `crypto.randomUUID()` direkt i webbläsaren *innan* det skickas till Supabase (i `AuthContext.tsx`).
- Registrering och hushållsskapande använder `upsert` för att vara idempotent – kan köras om utan att skapa dubbletter om nätverket tappar förbindelsen mitt i.

### Varför:
Ekonomidata är känslig. Även om någon skulle lyckas dekompilera JavaScript-koden och skicka manuella API-anrop, vägrar databasen att svara med eller acceptera data som inte tillhör dem.

---

## 6. Mobilapp och PWA (Progressive Web App)

### Vad:
Appen fungerar precis som en äkta app på mobilen. Man kan lägga till den på hemskärmen och den öppnas i fullskärm utan adressfält eller webbläsarkontroller.

### Hur – PWA-teknik & Installation:
`vite-plugin-pwa` i `vite.config.ts` genererar automatiskt:
- **Service Worker (`sw.js`):** Cachar appens filer lokalt. Appen laddas snabbt även vid dålig signal och fungerar i offline-läge. Appen uppdaterar sig själv automatiskt i bakgrunden när ny kod laddas upp (`autoUpdate`).
- **Web App Manifest (`manifest.webmanifest`):** Berättar för telefonen att appen är installationsbar.
- **Ikon-optimering:** Ikonerna (192x192 och 512x512) är utskrivna som solida, opaka fyrkanter (lila gradient-bakgrund). Detta görs för att Android (Adaptive Icons) och iOS ska kunna applicera sin egen mask (t.ex. rundade hörn) utan att bakgrunds-UI lyser igenom transparenta kanter.
- **Custom Install Prompt:** Appen innehåller en egen, designad installationsruta (`InstallPrompt.tsx`) som visas för nya användare. På Android lyssnar den på `beforeinstallprompt` och fångar eventet för att installera direkt via ett klick. På iOS detekteras enheten via User Agent och istället visas en steg-för-steg-guide hur man installerar appen via Safaris Dela-meny, eftersom Apple inte stödjer API:et fullt ut.

### Hur – Responsiv Navigering (`src/App.tsx` + `src/index.css`):
- **På datorn (>768px):** Alla fem flikar visas som knappar i en fast header längst upp på sidan.
- **På mobilen (≤768px):** Desktop-headern döljs (`display: none`). Istället visas en lila **☰ Hamburgermeny-knapp** uppe till vänster. Vid klick glider en panel in från vänster och täcker 75% av skärmen med alla fem menyval. Aktiv vy markeras med lila bakgrund. Klickar man utanför panelen (på det mörka skärmsläcket) stängs menyn. Knappen byter ikon till **✕** när menyn är öppen.

### Hur – Inställningar UX (dropdown på mobil):
- **På datorn:** Flikarna i Inställningar (Räkningar, Konton, Lås upp, Allmänt) visas som fyra knappar i en rad.
- **På mobilen:** Samma knappar ersätts av en native `<select>`-rullgardin. Detta säkerställer att knappen "Allmänt" aldrig hamnar utanför skärmen och att användaren alltid hittar alla underalternativ direkt.
- **CSS-klasser:** `.settings-tabs-desktop { display: flex }` och `.settings-tabs-mobile { display: none }` växlas via `@media (max-width: 768px)`.

### Varför:
En ekonomiapp används oftast på språng – i kassan, på bussen, efter en stor månad. PWA-tekniken ger en exklusiv native-app-känsla, och de mobilanpassade UI-mönstren (hamburgermeny + rullgardin) garanterar att ingen funktion är gömd eller kräver horisontell scrollning.

---

## 7. Uträkningar (Splitwise-logik)

### Vad:
Appen räknar automatiskt ut exakt vem som ska betala vem, oavsett hur komplex konstellationen av räkningar och konton är.

### Hur:
All matematik sker i `calculateMonth(state, monthId)` i `src/store.ts`:

1. **Identifiera konton:** Systemet separerar `sharedAccounts` (gemensamma) och `personAccounts` (personliga).
2. **Beräkna skulder (`liabilities`):** För varje räkning, baserat på `splitType`:
   - `'equal'` → beloppet delas lika på alla personkonton.
   - `specificAccountId` → 100% skuld för den personen.
3. **Automatisk överföring (`isAutoTransfer`):** Om räkningen har inställningen `isAutoTransfer` satt hoppar `calculateMonth()` över att lägga till den i `transfersToShared`. Från version 5.4 kan detta styras på personnivå:
   - `'all'` → Inget krav på manuell överföring genereras för *någon* person.
   - `accountId` (specifik person) → Inget krav genereras enbart för *den specifika personen*, övriga personer måste fortfarande föra över sin del manuellt.
   Detta innebär att räkningens belopp fortfarande syns i månadsvyn och räknas med i hushållets totala utgifter, men fjärran överföringssummorna i "Sammanställning"-rutan minskar därmed automatiskt för de personer som har autogiro utan att man behöver räkna manuellt.
4. **Räkna balansen:** Om räkningen är på ett **delat konto** (t.ex. huskontot) → varje person måste *föra över* sin andel (såvida inte `isAutoTransfer` är satt). Om räkningen är betald av en **person** direkt → den personen får kredit, de andra debiteras.
5. **Splitwise-algoritm (Debt Simplification):** Balanserna sorteras i fordringsägare och gäldenärer. Algoritmen parar ihop dem och skapar minimalt antal `SwishTransfer[]`-objekt.

### Varför:
Kärnan i hela appen. Oavsett om sambon tog elräkningen och du tog hyran, fixar appen nettobeloppet på en bråkdel av en sekund. Eliminerar all manuell räkning och missförstånd. Med `isAutoTransfer` slipper man dessutom sitta och räkna bort fasta stående order-belopp ur det som ska betalas manuellt varje månad.

---

## 8. Månadsvy (Gemensamma räkningar)

### Vad:
Huvudvyn där man varje månad fyller i belopp på sina räkningar och markerar betalningar som genomförda.

### Hur (`src/components/MonthView.tsx`):
- Navigerar mellan månader via `← Föregående` / `Nästa →` pilar (format: `YYYY-MM`).
- Visar bara räkningar som ska betalas just den månaden (filtrerat via `interval`-logik).
- Belopp sparas via `updateBillAmount(monthId, billId, amount)` → direkt `upsert` i `month_bill_amounts`.
- **"Hämta siffror från förra månaden"** (`copyFromPreviousMonth`): Kopierar belopp för alla olåsta räkningar. Skickar en batch-`upsert` till `month_bill_amounts`.
- **"✅ Markera som överfört"**: Triggar `togglePaymentStatus()` → `upsert` i `month_handled_payments`. Sätter `is_handled = true`. Kopplade inmatningsfält blir `disabled` och en `🔒`-ikon visas.

### Varför:
Varje månad är unik (elräkningar varierar, hyra är fast). Att kunna kopiera förra månaden sparar tid, och låsmekanismen skyddar mot råkändringar efter att pengar redan är överförda.

---

## 9. Flexibilitet & "Allmänna Inställningar"

### Vad:
Appen är helt dynamisk och oberoende av vilka personer som använder den – den passar en ensamstående, ett par eller kompisar som delar lägenhet.

### Hur:
I `⚙️ Inställningar → Allmänt` kan man:
- **Kryssa ur "Visa sammanställning"** → döljer Swish- och Överföringsrutorna. Sparas i `household_settings.show_summary` via `updateSettings()` → `upsert`.
- **Dynamiska konton:** Inga hårdkodade namn. Man kan radera, lägga till och byta namn på konton fritt via `addAccount`, `removeAccount`, `updateAccount` → direkt till `accounts`-tabellen. All matematik anpassar sig i realtid.

### Varför:
Appen ska inte vara låst till "Andreas och Helena". Alla hushållskonstellationer är välkomna.

---

## 10. Räkningar & Intervall

### Vad:
Varje räkning kan ha ett eget betalningsintervall – varje månad, varannan månad eller specifika månader per år.

### Hur:
`BillDefinition` och `PrivateBill` har fältet `interval: PaymentInterval`:
- `'all'` – Varje månad.
- `'odd'` – Udda månader (januari, mars, maj...).
- `'even'` – Jämna månader (februari, april, juni...).
- `'custom'` – Specifika månader. Lagras som `custom_months: integer[]` (1–12) i `bills`-tabellen.

I vyn filtreras räkningarna via en `shouldShowBill(bill, monthNumber)`-funktion.

### Varför:
Verkliga räkningar betalas inte alltid varje månad. El- och vattenräkningar kan komma varannan månad. Hushållsavgifter kan komma bara på sommaren.

---

## 11. Privat Ekonomi (Helt separerad från Swish-logik)

### Vad:
En egen flik (`🔒 Privat`) där varje användare hanterar sina egna, privata utgifter som aldrig påverkar den gemensamma uträkningen.

### Hur:
- Privata räkningar lagras i tabellen `private_bills` med `user_id: user.id` (inloggad användares UUID).
- Privata räkningar skapas på *samma* ställe som gemensamma (`⚙️ Inställningar → Räkningar`), men med växeln **"🔒 Privat Räkning"** istället för "Gemensam Räkning".
- Varje användare kan ställa in **"Dela hela min privata ekonomi"** i "Mina Sidor". Detta sätter flaggan `share_private_economy = true` på deras profil i databasen.
- `PrivateView.tsx` visar en "dropdown"-lista högst upp där användare kan välja vilkens privata ekonomi de vill titta på (förutsatt att personen har delat sin). Siffrorna för någon annans ekonomi är alltid låsta för redigering (skrivskyddade).
- En grön **"✅ Markera månad som klar"**-knapp kör `togglePrivateLock(monthId)` → `upsert` i `private_month_locks`. Stänger månaden och förhindrar vidare redigering.
- Belopp per månad sparas i `private_month_amounts` (en rad per räkning och månad).
- Upplåsning sker via `⚙️ Inställningar → 🔒 Lås upp → "Mina Privata Lås"`.

### Hur – Arkivering (Papperskorgen):
- Raderade räkningar tas aldrig bort från databasen. Istället sätts flaggan `is_archived = true`.
- För att förhindra att gamla, raderade räkningar smutsar ner framtida månader tillämpas en smart filter-logik i UI:t: Om en räkning är arkiverad visas den **enbart** i månader där den redan har ett sparat belopp som är **större än 0 kr**. Detta gör att all historik och matematik bibehålls för gamla månader, medan räkningen är permanent osynlig i nya månader.

### Hur – Kringgående av RLS vid inställningsändringar (RPC Bypass):
- Tidigare hanterades ändring av `share_private_economy` via standard PostgreSQL `UPDATE`-kommandon. Dock påverkades detta starkt av RLS-policys, vilket skapade en konflikt (och infinite recursion) vid vissa tabelluppslagningar när policyn försökte kolla i sig själv.
- Ännu värre var att klienten kraschade tyst i `loadCloud` på grund av saknade databaskolumner (exempelvis `display_name`).
- Lösningen är nu **"RPC Bypass"**. Appen använder en *Remote Procedure Call* (`toggle_share_private_economy`) som körs med `SECURITY DEFINER` på databasnivån. Detta tillåter appen att ignorera standard-RLS just för detta specifika ändamål, vilket garanterar att datan sparas även i strikt låsta miljöer. Samtidigt använder UI:t e-postadress istället för obefintliga kolumner.

### Hur – Skapandedatum (`start_month`):
- När en ny räkning (privat eller gemensam) skapas, stämplas den med den aktuella månaden (`YYYY-MM`) i kolumnen `start_month`.
- Systemet filtrerar automatiskt bort räkningen från vyer och beräkningar som avser månader före `start_month`. Detta förhindrar att nya utgifter plötsligt dyker upp "bakåt i tiden" i gammal historik.

### Varför:
Hushållsmedlemmar vill ha en komplett bild av *all* sin ekonomi på ett ställe. Privata kostnader ska *aldrig* räknas in i den gemensamma Swish-uppgörelsen. Global delning ger transparens för par som vill se varandras helhetsbild, utan att blanda ihop matematiken.

---

## 12. Skulder & Lånespårning (Avbetalningskontroll)

### Vad:
Möjlighet att markera en räkning (privat eller gemensam) som ett lån/skuld med en ursprunglig totalsumma. EkonomiTB visar en visuell progress-bar som krymper varje gång en månad låses.

### Hur:
- `bills` och `private_bills` i databasen har kolumnerna `is_loan boolean` och `total_debt numeric`.
- I `⚙️ Inställningar → Räkningar` finns kryssrutan **"💳 Detta är en skuld/ett lån som ska betalas av över tid"**. När den kryssas i visas ett fält för ursprunglig skuldsumma.
- I `EkonomiTB` beräknas `paidSoFar` dynamiskt: för varje låst månad summeras inmatat belopp för den räkningen.
- Formeln: `remaining = max(0, totalDebt - paidSoFar)`, `progress = min(100, paidSoFar / totalDebt * 100)`.
- Progress-baren visas i sektionen **"💳 Skulder & Lån"** i EkonomiTB.
- När `progress >= 100` visas "🎉 Fullt betald!" med grön färg.

### Varför:
Det är motiverande att visuellt se hur ett lån krymper. Istället för att räkna manuellt vet man alltid exakt hur mycket som är kvar att betala.

---

## 13. Säkerhetslås (Kontolås)

### Vad:
När en betalning är genomförd fryses siffrorna för att förhindra oavsiktliga ändringar.

### Hur:
- **Gemensam Månadsvy:** "✅ Markera som överfört" kör `togglePaymentStatus()` → `upsert` i `month_handled_payments` med `is_handled = true`. Inmatningsfält kopplade till det kontot blir `disabled`.
- **Privat Vy:** "✅ Markera månad som klar" kör `togglePrivateLock()` → `upsert` i `private_month_locks` med `is_locked = true`. Alla inmatningsfält låses.
- **Upplåsning:** Via `⚙️ Inställningar → 🔒 Lås upp`. Uppdelat i två sektioner:
  - **Gemensam Månadsvy** – Lista per månad med konto-namn och "🔓 Lås upp"-knapp → sätter `is_handled = false` för berörda payment_ids via `upsert`.
  - **Mina Privata Lås** – Lista per månad och "🔓 Lås upp"-knapp → sätter `is_locked = false`.

### Varför:
Pengar är redan överförda – det ska inte gå att råka ändra siffran efteråt och förstöra uträkningen för hela månaden.

---

## 14. AI-driven Felskrivningskontroll (Anomalidetektion)

### Vad:
Skyddar mot "fat-fingers" – att råka skriva in fel belopp (t.ex. 10 000 istället för 1 000).

### Hur:
- Systemet håller koll på de senaste 3+ månadernas historik per räkning.
- Om ett nytt belopp avviker mer än **50% från det historiska minimumet** (för lågt) eller **50% från det historiska maximumet** (för högt) triggas ett larm.
- Fältet markeras rött och en dialogruta visas: **"↩️ Ångra"** (återställer till förra värdet) eller **"✅ OK"** (bekräftar att avvikelsen är korrekt).
- Bekräftade avvikelser sparas via `confirmAnomaly()` → `upsert` i `month_confirmed_anomalies` (eller `private_month_anomalies` för privata).
- Bekräftade anomalier räknas inte längre som avvikelser för just det beloppet.
- Fungerar identiskt i gemensam och privat vy.

### Varför:
En etta för mycket på slutet kan förstöra hela månadskalkylen. Systemet agerar som en smart säkerhetsventil utan att störa normalt arbetsflöde.

---

## 15. Analys & EkonomiTB (Statistik)

### Vad:
Historisk data visualiserad med interaktiva grafer och tabeller.

### Hur (`src/components/Statistics.tsx`):
- **Gemensam Statistik:** Gemensamma kostnader per konto, Huskonto-summor, Swish-historik, "Största förändringarna" (movers) mellan månader.
- **Privat Statistik:** Filtrerar på `bill.userId === user.id` och visar *enbart* dina egna privata utgifter.
- **Skulder & Lån:** Sektion med progress-bars (se kapitel 12), i rätt flik beroende på om lånet är privat eller gemensamt.
- **Excel-Export:** Knappen "💾 Ladda ner Excel" (`src/excel.ts`) genererar en `.xlsx`-fil via biblioteket `xlsx` med **tre flikar**:
  1. `Gemensamma Räkningar` – Pivot-tabell per räkning och månad.
  2. `Swish & Överföringar` – Historik för alla Swish-rekommendationer.
  3. `Mina Privata Räkningar` – Enbart inloggad användares privata data.

### Varför:
Att se sin ekonomi som grafer och tabeller ger en känsla av kontroll. Utan historik vet man inte om kostnaderna ökar eller minskar. Excel-exporten är en säkerhetskopia och möjliggör avancerad analys utanför appen.

---

## 16. Hushållsadministration & GDPR

### Vad:
Säker och tydlig hantering av vilka som är med i hushållet, vem som får bjuda in, samt verktyg för att radera all personlig data (GDPR-efterlevnad).

### Hur:
- **Medlemslista & Kick-funktion:** På "Mina Sidor" hämtas hushållets medlemmar asynkront via tabellen `profiles`. Om inloggad användare har rollen `owner`, ges behörighet att klicka på en "Kicka ut"-knapp för vanliga medlemmar. Funktionen skapar ett nytt, tomt hushåll och kastar omedelbart dit den utsparkade medlemmen så att inga krascher uppstår och de förlorar tillgången till er delade data.
- **Dynamiskt Grundarskydd (Founder Protection):** Ett hushålls grundare (den vars profilrad har det allra äldsta `created_at` i hushållet) är numera helt osårbar. Även om en "owner" försöker, försvinner knapparna för degradering och utsparkning automatiskt i UI:t för Grundaren. Denna logik är inte hårdkodad utan 100% dynamisk baserat på uppkomst i databasen.
- **Skyddade Inbjudningar:** Inbjudningskoden och blocket för molnsynk visas exklusivt för ägaren. Vanliga medlemmar får enbart en ren informationsvy över att de är med.
- **Lämna hushåll:** Knappen **"🚪 Lämna och skapa eget hushåll"** kör `handleCreateHousehold()` för användare som frivilligt vill hoppa av. Samma mekanism (nytt UUID via `crypto.randomUUID()`) körs. Den gamla hushållsdatan är orörd för de som är kvar.
- **GDPR Självradering:** En dedikerad och permanent röd knapp, "Radera mitt konto för alltid", finns placerad oavsett hushållsstatus. Raderingen anropar `delete_user`-funktionen i databasen som rensar autentiseringsidentiteten och låter PostgreSQL:s `ON DELETE CASCADE` radera all profilinformation och privata räkningar.
- **Användarvillkor & Integritetspolicy (ToS):** Ett nytt lager av juridisk säkerhet (`TermsModal.tsx`) är infört som interceptar användaren vid första inloggningen efter skapandet av kontot. Användaren måste expliciet godkänna villkoren för att komma in i appen. Detta val lagras i en ny boolean-kolumn `tos_accepted` i `profiles`-tabellen via appens Context-state, vilket gör att rutan endast visas en gång per användare.
- **Glömt Lösenord:** Inloggningsskärmen (`LoginScreen.tsx`) hanterar nu lösenordsåterställning direkt via Supabase inbyggda API (`resetPasswordForEmail`).
- **Säker Minnesrensning (Zustand Wipe):** Vid `signOut` triggas appens globala `cleanup()`-funktion. Förutom att kasta inloggningstoken, tvångsåterställer den omedelbart React-appens hela in-memory state till `DEFAULT_STATE`. Detta hindrar att skärmen dröjer kvar med känslig data om en ny användare direkt registrerar sig i samma webbläsarfönster.

---

## 17. Filstruktur och Ansvar

| Fil | Ansvar |
|-----|--------|
| `src/supabase.ts` | Supabase-klient och anslutningskonfiguration. |
| `src/AuthContext.tsx` | Autentisering, registrering, sessionshantering, hushållsskapande. |
| `src/types.ts` | All datastruktur: `AppState`, `BillDefinition` (inkl. `isLoan`, `totalDebt`, `isAutoTransfer`), `PrivateBill`, `PrivateMonthData`, `MonthData`, `Account`, `SwishTransfer`, `CalculationResult`. |
| `src/migrateToRelational.ts` | Engångsskript som automatiskt migrerar gammal `state_json` till de nya relationstabellerna vid uppstart. Använder `upsert` – kan köras om utan bieffekter. |
| `src/store.ts` | Appens hjärna: `useStore()` (parallell inläsning från alla tabeller, realtidsprenumeration, optimistisk UI, alla CRUD-mutationer), `calculateMonth()` (Splitwise-matematik). |
| `src/App.tsx` | Rotkomponent, routing (hamburgermeny mobil / knappar desktop), hamburgermeny-state, kopplar alla store-actions till komponenter. |
| `src/excel.ts` | Genererar Excel-filen med tre flikar via `xlsx`-biblioteket. |
| `src/components/MonthView.tsx` | Gemensam månadsvy: inmatning, kopiera förra månaden, betalningsmarkering, lås-visning. |
| `src/components/PrivateView.tsx` | Privat vy: filtrerar `privateBills` på `userId`, inmatning, låsning av privata månader. |
| `src/components/Summary.tsx` | Sammanfattningsrutan med Swish- och Överföringsrekommendationer. |
| `src/components/Statistics.tsx` | EkonomiTB: grafer (recharts), skuld-progress-bars, Excel-knapp, Gemensam/Privat-växel. |
| `src/components/ManageBills.tsx` | Inställningspanelen: Räkningar (inkl. Lån-kryssruta och Automatisk överföring-kryssruta), Konton, Lås upp (uppdelat Gemensam/Privat), Allmänt. Responsiv flik-layout (knappar på dator, `<select>`-rullgardin på mobil). |
| `src/components/MyPages.tsx` | Mina sidor: e-post/lösenordsändring, hushållskod, lämna hushåll. |
| `src/index.css` | Hela appens design: mörkt glassmorphism-tema, CSS-variabler, mobilmedia-queries, hamburgermeny-animationer, `.settings-tabs-desktop` / `.settings-tabs-mobile`-klasser. |
| `src/components/InstallPrompt.tsx` | Custom installationsruta (PWA A2HS) som fångar Android-installationer och guidar iOS-användare. |
| `vite.config.ts` | Vite + PWA-konfiguration (Service Worker, manifest, caching-strategi). |
| `SYSTEM_DOKUMENTATION.md` | Denna fil. Fullständig teknisk och funktionell dokumentation av hela systemet. |

---

## 18. Enterprise-uppgradering (Fas 1-3)
### Vad:
Förvandlingen av appen från ett robust hobby-projekt till en fullfjädrad "Enterprise" SaaS-produkt. 

### Hur (De 3 Faserna):
**Fas 1: Tydlig Felhantering & Code Splitting (React Suspense)**
- Alla databasanrop hanteras av en global wrapper (`safeDb`) som fångar fel och visar snygga, icke-blockerande popups (React Hot Toast) om t.ex. nätverket bryts. Inga "tysta fel" existerar längre.
- Tunga vyer som `Statistics.tsx` laddas med `React.lazy()` och `<Suspense>`. Det gör att appen startar omedelbart, och statistikmodulen hämtas enbart när användaren klickar på fliken "EkonomiTB".

**Fas 2: Modern Tillståndshantering (Zustand)**
- Gammal "Prop Drilling" (där variabler skickas genom lager på lager av komponenter) är helt eliminerad. 
- Appens tillstånd hanteras nu av `Zustand` (en state manager). Varje komponent prenumererar direkt på exakt den data den behöver. Detta gör appen blixtsnabb att bygga och skala, och tar bort enorma mängder överflödig kod i `App.tsx`.
- Säkerhetshöjning för versionshantering: Den kritiska `.env`-filen som innehåller Supabase-nycklar har raderats från Git-historiken för att skydda databasen.

**Fas 3: "Bulletproof" Backend-Säkerhet (Zod & SQL Constraints)**
- All inmatning från användaren valideras nu på klientnivå via biblioteket `Zod`. Det kontrollerar form och orimliga värden (exempelvis att ett räkningsnamn inte är tomt och att belopp alltid är $\ge$ 0) *innan* det sparas. 
- Som ett extra lås har vi lagt in `CHECK Constraints` på databasnivå i Supabase. Även om klientkoden ignoreras eller hackas kommer databasen att totalvägra att registrera felaktig data (t.ex. negativa skulder eller obefintliga namn).

**Fas 4: "Enterprise Slutputs" (Oändlig Skalbarhet & Optimistic Rollbacks)**
- **Paginering / Lazy Loading:** Istället för att ladda ner hela hushållets historik på en gång vid uppstart, hämtas initialt enbart transaktioner för det *innevarande året* (plus december förra året för övergångar). Om användaren skrollar tillbaka till ett tidigare år triggas en asynkron bakgrundsladdning (`loadYear`). Appen behåller sin supersnabba uppstartstid ($\sim$ 0.1s) även med 20 års data.
- **Optimistic UI Rollbacks:** Om en nätverkssparning (`safeDb`) misslyckas efter att en användare klickat (t.ex. på grund av brutet internet eller att SQL-reglerna blockerade en felaktig siffra), kör appen automatiskt en rollback. Siffran på skärmen "hoppar tillbaka" till sitt ursprungliga värde, vilket helt eliminerar risken för att användargränssnittet och databasen hamnar i osynk.

**Fas 5: "The Final Polish" (Tester, Behörigheter & GDPR)**
- **Behörighetsnivåer (RBAC):** Istället för att alla användare i ett hushåll är administratörer ("owner") har appen nu ett rollsystem. Den som skapar hushållet blir `owner` och får ensamrätt på att radera gemensamma konton, räkningar och ändra inställningar. Inbjudna medlemmar blir `member` och kan lägga till nya gemensamma utgifter, men får ett avskalat gränssnitt (Låst läge) för existerande inställningar. En `owner` kan dock befordra en `member` till `owner` i "Mina Sidor". Eftersom Supabase RLS blockerar användare från att ändra varandras profil-rader, hanteras denna befordran via en säker `RPC` (Remote Procedure Call)-funktion i databasen (`set_user_role`) som förbigår RLS på ett säkert sätt.
- **Säkerhetskrav vid ändringar:** För att byta lösenord eller e-postadress på "Mina Sidor" måste användaren nu först verifiera sin identitet genom att skriva in sitt nuvarande lösenord (`signInWithPassword`).
- **Knapplås:** När en Swish eller Överföring markeras som utförd i Sammanfattningen (Summary.tsx), låses knappen omedelbart (`disabled`) för att förhindra oavsiktliga dubbelklick och av-markeringar. Upplåsning kan därefter endast ske via Inställningar -> Lås upp.
- **GDPR / Självradering:** Ett SQL-skript (`delete_user`) körs i Supabase som gör att användare, med ett enda klick från "Mina Sidor", kan radera sitt eget inlogg. Tack vare SQL Cascade raderas samtidigt alla kopplingar, profildata och privata räkningar kopplade till detta inlogg från databasen. Inga spår lämnas kvar.
- **Automatiserade Tester (Vitest):** En testrobot verifierar logiken i appens beräkningar (t.ex. Splitwise-matematiken). Testerna körs obligatoriskt vid bygget (`npm run build`). Om framtida kodändringar skulle leda till ett räknefel på ett öre, vägrar systemet att kompilera koden, vilket garanterar att en trasig applikation aldrig kan släppas.

---

## 19. Schemalagda Push-notiser & Påminnelser

### Vad:
Ett system för att skicka ut push-notiser till användarnas telefoner/datorer via webbläsarens Push API. Appen påminner hushållets medlemmar om att betala och markera sina gemensamma räkningar som klara.

### Hur:
- **Databas & Inställningar:** Tabellen `household_settings` har en kolumn `reminder_day` (1-31) där hela hushållet enas om vilket datum notisen ska skickas ut.
- **Service Worker (`push-sw.js`):** En PWA Service Worker ligger i bakgrunden och lyssnar på `push`-event för att väcka enheten och visa notisen (titel, ikon och body) även om appen är helt nedstängd.
- **Prenumerationer (VAPID):** Användaren klickar på "Aktivera Push-notiser" under Mina Sidor. Klienten ber webbläsaren om tillåtelse, skapar en säker VAPID-prenumeration och sparar denna JSON i databastabellen `push_subscriptions` kopplad till `user_id`. (RLS ser till att man bara kan läsa/skriva sina egna notiser). Ett "Testa notis"-verktyg skapades även för direkt verifikation lokalt i Service Workern.
- **Bakgrundskörning (Vercel Cron):** En Serverless Function i Vercel (`api/cron.js`) körs schemalagt varje dag (t.ex. klockan 10:00) enligt `vercel.json`. Koden:
  1. Kontrollerar dagens datum och hämtar alla hushåll som har `reminder_day == idag`.
  2. Kollar om *mål-månaden* är låst/klar (`month_handled_payments` har `is_handled = true`). Mål-månaden räknas ut smart: Om datumet är 20:e eller senare kollar den nästkommande kalendermånad (eftersom lönen används till nästa månads räkningar). Om datumet är tidigt på månaden kollar den innevarande månad.
  3. Om de INTE är klara, hämtas alla prenumerationer för användarna i det hushållet.
  4. Node-paketet `web-push` skickar ut notisen med hjälp av den privata VAPID-nyckeln (som ligger dold i Vercel Environment Variables). Döda prenumerationer (t.ex. om användaren bytt telefon) fångas via 404/410-statuskoder och städas automatiskt bort från databasen.

### Varför:
PWA:er har ofta brustit i förmågan att "väcka" användaren likt native-appar. Genom att integrera Web Push, Service Workers och Vercel Cron får appen samma proaktiva egenskaper som vilken Bank-app som helst, vilket säkerställer att ingen i hushållet "glömmer" att hantera sina räkningar i tid.

---

## 20. SaaS, Stripe & Admin-infrastruktur (v6.2)

Ekonomiappen är från och med version 6.2 en fullvärdig SaaS (Software as a Service) med en inbyggd betalvägg och ett dolt, säkert admin-system.

### 20.1 Det Dolda Kassavalvet (`admin_secrets`)
För att undvika att lagra känsliga nycklar (som Stripe Secret Key) hårdkodade i Vercels kontrollpanel, har appen ett eget "kassavalv" direkt i databasen.
- Tabellen `admin_secrets` är nedlåst med Strict RLS (Row Level Security). Endast användare inloggade med mejlen `apersson508@gmail.com` kan skriva och läsa.
- En RPC-funktion `set_admin_secret` används av frontend (Admin-panelen) för att spara nycklarna säkert.
- Backend (Vercel API) läser dessa nycklar asynkront vid varje betalning med hjälp av `SUPABASE_SERVICE_ROLE_KEY` som helt förbigår RLS.

### 20.2 Vercel Serverless Functions (API)
Stripe kommunicerar med tre dolda serverless-funktioner byggda i Node.js, placerade i root-mappen `/api`:
1. **`/api/create-checkout.js`**: Anropas när kunden klickar "Börja prenumerera". Den hämtar `STRIPE_SECRET_KEY` och `STRIPE_PRICE_ID` från kassavalvet, skapar en Stripe-session och returnerar en länk dit kunden skickas.
2. **`/api/stripe-webhook.js`**: En "lyssnare" som Stripe ropar på i smyg så fort en betalning går igenom eller misslyckas. Webkroken validerar Stripes kryptografiska signatur, hämtar `household_id`, och uppdaterar kolumnen `stripe_status` ('active', 'past_due' eller 'canceled') i Supabase helt automatiskt i bakgrunden.
3. **`/api/create-portal.js`**: Anropas när användaren vill hantera sina kortuppgifter eller avsluta prenumerationen. Den hämtar kundens Stripe Customer ID från databasen och skickar kunden till Stripes egna kundportal.

### 20.3 Master Switch & VIP-hantering
- **`global_settings`**: Innehåller Master Switch för hela appen. Om `paywall_active` är sann, kommer appen avbryta inläsning av normala vyer och istället rendera `<PaywallModal />` för alla användare som har en `stripe_status` som är 'trial', 'past_due' eller 'canceled'.
- **Prenumerationsinfo (`SubscriptionFeaturesModal`)**: På betalväggen finns en integrerad knapp som öppnar en överlagd informationsruta. Där listas alla premiumfunktioner grafiskt för kunden (exempelvis Splitwise-matematik, Push-notiser, PWA, Separat Ekonomi) innan de genomför köpet via Stripe.
- **VIP-system**: För vänner och familj finns en VIP-sökning i Admin-panelen. Via en RPC (`set_household_vip_by_email`) hittas hushållet och statusen sätts permanent till 'vip', vilket innebär att betalväggen helt ignoreras för det hushållet för all framtid, oavsett om Master Switchen är PÅ eller AV.
- **Admin Statistik (`get_admin_stats`)**: Systemadministratören har en unik Dashboard (`AdminDashboard.tsx`) som kringgår det normala RLS-skyddet via en `SECURITY DEFINER`-funktion för att hämta det exakta antalet registrerade medlemmar i systemet och totalt antal aktiva, betalande hushåll.

