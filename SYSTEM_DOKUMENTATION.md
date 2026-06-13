# SmartEkonomi - Systemdokumentation

**Plattform:** React + TypeScript + Vite (PWA) | Databas: Supabase (PostgreSQL) | Hosting: Vercel  

---

## 1. Vad är SmartEkonomi?

Det är en webb-applikation (byggd i React, TypeScript och Vite) som automatiskt räknar ut hur hushållets gemensamma räkningar ska delas. Den eliminerar behovet av miniräknare och kalkylark.

Appen stöder ett obegränsat antal gemensamma konton och personliga konton, och hanterar avancerad Splitwise-matematik i bakgrunden. Den är byggd som en PWA (Progressive Web App) och fungerar som en riktig app på mobilen � ingen App Store behövs.

**Appens fem huvudvyer (i ordning uppifrån och ner i menyn):**
- `�x& Månadsvy` � Gemensamma räkningar, mata in belopp, markera som överförda.
- `�x Privat` � Personliga utgifter och privata lån, synliga enbart för dig.
- `�x` EkonomiTB` � Historisk statistik, grafer, skuld-avbetalningskontroll.
- `�x� Mina sidor` � Kontoinformation, hushållskod och lämna-hushåll.
- `�a"️ Inställningar` � Hantera räkningar, konton, lås och allmänna inställningar.

---

## 2. Databasarkitektur � Relationsdatabas

### Vad:
All data lagras i en **fullt normaliserad relationsdatabas** i Supabase (PostgreSQL). Varje datatyp har sin egen tabell. Detta är den avgörande skillnaden mot hur den tidigaste arkitekturen sparade allt som ett enda stort JSON-dokument.

### Hur � Databastabeller:

| Tabell | Innehåll |
|--------|----------|
| `households` | Ett hushåll per rad. Används fortfarande som ankarpunkt med `id` (UUID). |
| `profiles` | En profil per användare. Kopplar `user_id �  household_id`. |
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

Den tidigaste arkitekturen sparade **hela appens tillstånd** som ett enda JSON-dokument. Det innebar att om du och Helena ändrade olika räkningar i exakt samma sekund, vann den som sparade *sist* och den andras ändring försvann.

Med relationsdatabasen uppdateras **enbart den exakta raden** som ändrades. Om du ändrar beloppet på "Elen" uppdateras en enda rad i `month_bill_amounts`. Om Helena ändrar "Hyran" uppdateras en annan rad. De är helt oberoende och kan aldrig skriva över varandra. **Ingen data kan gå förlorad.**

---

## 3. Datainläsning & Realtidssynkronisering

### Vad:
All data laddas från Supabase när appen startar, och uppdateras automatiskt i realtid när någon annan i hushållet gör en ändring.

### Hur (`src/store.ts �  useStore(householdId)`):

**Steg 1 � Migrationskontroll:**
Vid allra första inläsningen kontrollerar appen om `accounts`-tabellen är tom för hushållet. Om ja, och det finns data i den gamla `state_json`-kolumnen, körs `runRelationalMigration()` automatiskt en enda gång. Det gamla JSON-dokumentet läses av och all data packas in i de nya tabellerna utan att en enda siffra går förlorad.

**Steg 2 � Initial laddning (`Promise.all`):**
Appen hämtar data från alla 10 tabeller **parallellt** via en enda `Promise.all(...)`. Det gör inläsningen snabb oavsett hur mycket historik som finns.

**Steg 3 � Rekonstruktion av `AppState`:**
De 10 svarspaketen mappas samman till det interna `AppState`-objektet som komponenterna förstår. T.ex. aggregeras alla rader från `month_bill_amounts` till `months[monthId].billAmounts[billId]`.

**Steg 4 � Realtidslyssnare (`supabase.channel`):**
Appen prenumererar på `postgres_changes`-händelser på **alla 10 tabeller** via en och samma Supabase-kanal. Varje ändring i databasen (oavsett vem som gjorde den) triggrar en ny komplett inläsning (`loadCloud()`), debounced till 500ms för att undvika flodvågor av requests om många saker ändras på en gång.

**Steg 5 � Optimistisk UI:**
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
   - `state.accounts` �  `accounts`
   - `state.bills` �  `bills`
   - `state.months[m].billAmounts` �  `month_bill_amounts`
   - `state.months[m].handledPayments` �  `month_handled_payments`
   - `state.privateBills` �  `private_bills`
   - `state.privateMonths[m].billAmounts` �  `private_month_amounts`
   - `state.privateMonths[m].isLocked` �  `private_month_locks`
   - `state.settings` �  `household_settings`
3. Alla inserts använder `upsert` med `onConflict`-hantering � migreringen kan köras om utan att skapa dubbletter.

### Varför:
Befintliga hushåll med månaders historik behöver inte förlora ett enda öre av sin data. Migreringen sker utan nertid, utan manuellt arbete och utan att användaren märker det.

---

## 5. Row-Level Security (RLS) & Säkerhet

### Vad:
Alla databastabeller är låsta med PostgreSQL Row-Level Security. Ingen kan läsa eller skriva data som inte tillhör deras eget hushåll � inte ens om de skulle manipulera klientkoden.

### Hur:
- **RLS är aktiverat** på alla 10+ tabeller.
- En hjälpfunktion i databasen `user_in_household(hid uuid)` kontrollerar om den inloggade användaren (`auth.uid()`) tillhör hushållet via tabellen `profiles`.
- Alla policys är av typen `FOR ALL USING (user_in_household(household_id))` � funkar för SELECT, INSERT, UPDATE och DELETE i ett svep.
- Privata tabeller (`private_bills`, `private_month_amounts` etc.) kräver dessutom att `user_id = auth.uid()` i klientlogiken, som extra skyddslager.
- Hushålls-ID (UUID) genereras via `crypto.randomUUID()` direkt i webbläsaren *innan* det skickas till Supabase (i `AuthContext.tsx`).
- Registrering och hushållsskapande använder `upsert` för att vara idempotent � kan köras om utan att skapa dubbletter om nätverket tappar förbindelsen mitt i.

### Varför:
Ekonomidata är känslig. �ven om någon skulle lyckas dekompilera JavaScript-koden och skicka manuella API-anrop, vägrar databasen att svara med eller acceptera data som inte tillhör dem.

---

## 6. Mobilapp och PWA (Progressive Web App)

### Vad:
Appen fungerar precis som en äkta app på mobilen. Man kan lägga till den på hemskärmen och den öppnas i fullskärm utan adressfält eller webbläsarkontroller.

### Hur � PWA-teknik & Installation:
`vite-plugin-pwa` i `vite.config.ts` genererar automatiskt:
- **Service Worker (`sw.js`):** Cachar appens filer lokalt. Appen laddas snabbt även vid dålig signal och fungerar i offline-läge. Appen uppdaterar sig själv automatiskt i bakgrunden när ny kod laddas upp (`autoUpdate`).
- **Web App Manifest (`manifest.webmanifest`):** Berättar för telefonen att appen är installationsbar.
- **Ikon-optimering:** Ikonerna (192x192 och 512x512) är utskrivna som solida, opaka fyrkanter (lila gradient-bakgrund). Detta görs för att Android (Adaptive Icons) och iOS ska kunna applicera sin egen mask (t.ex. rundade hörn) utan att bakgrunds-UI lyser igenom transparenta kanter.
- **Custom Install Prompt:** Appen innehåller en egen, designad installationsruta (`InstallPrompt.tsx`) som visas för nya användare. På Android lyssnar den på `beforeinstallprompt` och fångar eventet för att installera direkt via ett klick. På iOS detekteras enheten via User Agent och istället visas en steg-för-steg-guide hur man installerar appen via Safaris Dela-meny, eftersom Apple inte stödjer API:et fullt ut.

### Hur � Responsiv Navigering (`src/App.tsx` + `src/index.css`):
- **På datorn (>768px):** Alla fem flikar visas som knappar i en fast header längst upp på sidan.
- **På mobilen (�0�768px):** Desktop-headern döljs (`display: none`). Istället visas en lila **�ܰ Hamburgermeny-knapp** uppe till vänster. Vid klick glider en panel in från vänster och täcker 75% av skärmen med alla fem menyval. Aktiv vy markeras med lila bakgrund. Klickar man utanför panelen (på det mörka skärmsläcket) stängs menyn. Knappen byter ikon till **�S"** när menyn är öppen.

### Hur � Inställningar UX (dropdown på mobil):
- **På datorn:** Flikarna i Inställningar (Räkningar, Konton, Lås upp, Allmänt) visas som fyra knappar i en rad.
- **På mobilen:** Samma knappar ersätts av en native `<select>`-rullgardin. Detta säkerställer att knappen "Allmänt" aldrig hamnar utanför skärmen och att användaren alltid hittar alla underalternativ direkt.
- **CSS-klasser:** `.settings-tabs-desktop { display: flex }` och `.settings-tabs-mobile { display: none }` växlas via `@media (max-width: 768px)`.

### Varför:
En ekonomiapp används oftast på språng � i kassan, på bussen, efter en stor månad. PWA-tekniken ger en exklusiv native-app-känsla, och de mobilanpassade UI-mönstren (hamburgermeny + rullgardin) garanterar att ingen funktion är gömd eller kräver horisontell scrollning.

---

## 7. Uträkningar (Splitwise-logik)

### Vad:
Appen räknar automatiskt ut exakt vem som ska betala vem, oavsett hur komplex konstellationen av räkningar och konton är.

### Hur:
All matematik sker i `calculateMonth(state, monthId)` i `src/store.ts`:

1. **Identifiera konton:** Systemet separerar `sharedAccounts` (gemensamma) och `personAccounts` (personliga).
2. **Beräkna skulder (`liabilities`):** För varje räkning, baserat på `splitType`:
   - `'equal'` �  beloppet delas lika på alla personkonton.
   - `specificAccountId` �  100% skuld för den personen.
3. **Automatisk överföring (`isAutoTransfer`):** Om räkningen har inställningen `isAutoTransfer` satt hoppar `calculateMonth()` över att lägga till den i `transfersToShared`. Från version 5.4 kan detta styras på personnivå:
   - `'all'` �  Inget krav på manuell överföring genereras för *någon* person.
   - `accountId` (specifik person) �  Inget krav genereras enbart för *den specifika personen*, övriga personer måste fortfarande föra över sin del manuellt.
   Detta innebär att räkningens belopp fortfarande syns i månadsvyn och räknas med i hushållets totala utgifter, men fjärran överföringssummorna i "Sammanställning"-rutan minskar därmed automatiskt för de personer som har autogiro utan att man behöver räkna manuellt.
4. **Räkna balansen:** Om räkningen är på ett **delat konto** (t.ex. huskontot) �  varje person måste *föra över* sin andel (såvida inte `isAutoTransfer` är satt). Om räkningen är betald av en **person** direkt �  den personen får kredit, de andra debiteras.
5. **Splitwise-algoritm (Debt Simplification):** Balanserna sorteras i fordringsägare och gäldenärer. Algoritmen parar ihop dem och skapar minimalt antal `SwishTransfer[]`-objekt.

### Varför:
Kärnan i hela appen. Oavsett om sambon tog elräkningen och du tog hyran, fixar appen nettobeloppet på en bråkdel av en sekund. Eliminerar all manuell räkning och missförstånd. Med `isAutoTransfer` slipper man dessutom sitta och räkna bort fasta stående order-belopp ur det som ska betalas manuellt varje månad.

---

## 8. Månadsvy (Gemensamma räkningar)

### Vad:
Huvudvyn där man varje månad fyller i belopp på sina räkningar och markerar betalningar som genomförda.

### Hur (`src/components/MonthView.tsx`):
- Navigerar mellan månader via `� � Föregående` / `Nästa � ` pilar (format: `YYYY-MM`).
- Visar bara räkningar som ska betalas just den månaden (filtrerat via `interval`-logik).
- Belopp sparas via `updateBillAmount(monthId, billId, amount)` �  direkt `upsert` i `month_bill_amounts`.
- **"Hämta siffror från förra månaden"** (`copyFromPreviousMonth`): Kopierar belopp för alla olåsta räkningar. Skickar en batch-`upsert` till `month_bill_amounts`.
- **"�S& Markera som överfört"**: Triggar `togglePaymentStatus()` �  `upsert` i `month_handled_payments`. Sätter `is_handled = true`. Kopplade inmatningsfält blir `disabled` och en `�x`-ikon visas.

### Varför:
Varje månad är unik (elräkningar varierar, hyra är fast). Att kunna kopiera förra månaden sparar tid, och låsmekanismen skyddar mot råkändringar efter att pengar redan är överförda.

---

## 9. Flexibilitet & "Allmänna Inställningar"

### Vad:
Appen är helt dynamisk och oberoende av vilka personer som använder den � den passar en ensamstående, ett par eller kompisar som delar lägenhet.

### Hur:
I `�a"️ Inställningar �  Allmänt` kan man:
- **Kryssa ur "Visa sammanställning"** �  döljer Swish- och �verföringsrutorna. Sparas i `household_settings.show_summary` via `updateSettings()` �  `upsert`.
- **Dynamiska konton:** Inga hårdkodade namn. Man kan radera, lägga till och byta namn på konton fritt via `addAccount`, `removeAccount`, `updateAccount` �  direkt till `accounts`-tabellen. All matematik anpassar sig i realtid.

### Varför:
Appen ska inte vara låst till "Andreas och Helena". Alla hushållskonstellationer är välkomna.

---

## 10. Räkningar & Intervall

### Vad:
Varje räkning kan ha ett eget betalningsintervall � varje månad, varannan månad eller specifika månader per år.

### Hur:
`BillDefinition` och `PrivateBill` har fältet `interval: PaymentInterval`:
- `'all'` � Varje månad.
- `'odd'` � Udda månader (januari, mars, maj...).
- `'even'` � Jämna månader (februari, april, juni...).
- `'custom'` � Specifika månader. Lagras som `custom_months: integer[]` (1�12) i `bills`-tabellen.

I vyn filtreras räkningarna via en `shouldShowBill(bill, monthNumber)`-funktion.

### Varför:
Verkliga räkningar betalas inte alltid varje månad. El- och vattenräkningar kan komma varannan månad. Hushållsavgifter kan komma bara på sommaren.

---

## 11. Privat Ekonomi (Helt separerad från Swish-logik)

### Vad:
En egen flik (`�x Privat`) där varje användare hanterar sina egna, privata utgifter som aldrig påverkar den gemensamma uträkningen.

### Hur:
- Privata räkningar lagras i tabellen `private_bills` med `user_id: user.id` (inloggad användares UUID).
- Privata räkningar skapas på *samma* ställe som gemensamma (`�a"️ Inställningar �  Räkningar`), men med växeln **"�x Privat Räkning"** istället för "Gemensam Räkning".
- Varje användare kan ställa in **"Dela hela min privata ekonomi"** i "Mina Sidor". Detta sätter flaggan `share_private_economy = true` på deras profil i databasen.
- `PrivateView.tsx` visar en "dropdown"-lista högst upp där användare kan välja vilkens privata ekonomi de vill titta på (förutsatt att personen har delat sin). Siffrorna för någon annans ekonomi är alltid låsta för redigering (skrivskyddade).
- En grön **"�S& Markera månad som klar"**-knapp kör `togglePrivateLock(monthId)` �  `upsert` i `private_month_locks`. Stänger månaden och förhindrar vidare redigering.
- Belopp per månad sparas i `private_month_amounts` (en rad per räkning och månad).
- Upplåsning sker via `�a"️ Inställningar �  �x Lås upp �  "Mina Privata Lås"`.

### Hur � Arkivering (Papperskorgen):
- Raderade räkningar tas aldrig bort från databasen. Istället sätts flaggan `is_archived = true`.
- För att förhindra att gamla, raderade räkningar smutsar ner framtida månader tillämpas en smart filter-logik i UI:t: Om en räkning är arkiverad visas den **enbart** i månader där den redan har ett sparat belopp som är **större än 0 kr**. Detta gör att all historik och matematik bibehålls för gamla månader, medan räkningen är permanent osynlig i nya månader.

### Hur � Kringgående av RLS vid inställningsändringar (RPC Bypass):
- Tidigare hanterades ändring av `share_private_economy` via standard PostgreSQL `UPDATE`-kommandon. Dock påverkades detta starkt av RLS-policys, vilket skapade en konflikt (och infinite recursion) vid vissa tabelluppslagningar när policyn försökte kolla i sig själv.
- �nnu värre var att klienten kraschade tyst i `loadCloud` på grund av saknade databaskolumner (exempelvis `display_name`).
- Lösningen är nu **"RPC Bypass"**. Appen använder en *Remote Procedure Call* (`toggle_share_private_economy`) som körs med `SECURITY DEFINER` på databasnivån. Detta tillåter appen att ignorera standard-RLS just för detta specifika ändamål, vilket garanterar att datan sparas även i strikt låsta miljöer. Samtidigt använder UI:t e-postadress istället för obefintliga kolumner.

### Hur � Skapandedatum (`start_month`):
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
- I `�a"️ Inställningar �  Räkningar` finns kryssrutan **"�x� Detta är en skuld/ett lån som ska betalas av över tid"**. När den kryssas i visas ett fält för ursprunglig skuldsumma.
- I `EkonomiTB` beräknas `paidSoFar` dynamiskt: för varje låst månad summeras inmatat belopp för den räkningen.
- Formeln: `remaining = max(0, totalDebt - paidSoFar)`, `progress = min(100, paidSoFar / totalDebt * 100)`.
- Progress-baren visas i sektionen **"�x� Skulder & Lån"** i EkonomiTB.
- När `progress >= 100` visas "�x}0 Fullt betald!" med grön färg.

### Varför:
Det är motiverande att visuellt se hur ett lån krymper. Istället för att räkna manuellt vet man alltid exakt hur mycket som är kvar att betala.

---

## 13. Säkerhetslås (Kontolås)

### Vad:
När en betalning är genomförd fryses siffrorna för att förhindra oavsiktliga ändringar.

### Hur:
- **Gemensam Månadsvy:** "�S& Markera som överfört" kör `togglePaymentStatus()` �  `upsert` i `month_handled_payments` med `is_handled = true`. Inmatningsfält kopplade till det kontot blir `disabled`.
- **Privat Vy:** "�S& Markera månad som klar" kör `togglePrivateLock()` �  `upsert` i `private_month_locks` med `is_locked = true`. Alla inmatningsfält låses.
- **Upplåsning:** Via `�a"️ Inställningar �  �x Lås upp`. Uppdelat i två sektioner:
  - **Gemensam Månadsvy** � Lista per månad med konto-namn och "�x Lås upp"-knapp �  sätter `is_handled = false` för berörda payment_ids via `upsert`.
  - **Mina Privata Lås** � Lista per månad och "�x Lås upp"-knapp �  sätter `is_locked = false`.

### Varför:
Pengar är redan överförda � det ska inte gå att råka ändra siffran efteråt och förstöra uträkningen för hela månaden.

---

## 14. AI-driven Felskrivningskontroll (Anomalidetektion)

### Vad:
Skyddar mot "fat-fingers" � att råka skriva in fel belopp (t.ex. 10 000 istället för 1 000).

### Hur:
- Systemet håller koll på de senaste 3+ månadernas historik per räkning.
- Om ett nytt belopp avviker mer än **50% från det historiska minimumet** (för lågt) eller **50% från det historiska maximumet** (för högt) triggas ett larm.
- Fältet markeras rött och en dialogruta visas: **"� �️ �&ngra"** (återställer till förra värdet) eller **"�S& OK"** (bekräftar att avvikelsen är korrekt).
- Bekräftade avvikelser sparas via `confirmAnomaly()` �  `upsert` i `month_confirmed_anomalies` (eller `private_month_anomalies` för privata).
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
- **Excel-Export:** Knappen "�x� Ladda ner Excel" (`src/excel.ts`) genererar en `.xlsx`-fil via biblioteket `xlsx` med **tre flikar**:
  1. `Gemensamma Räkningar` � Pivot-tabell per räkning och månad.
  2. `Swish & �verföringar` � Historik för alla Swish-rekommendationer.
  3. `Mina Privata Räkningar` � Enbart inloggad användares privata data.

### Varför:
Att se sin ekonomi som grafer och tabeller ger en känsla av kontroll. Utan historik vet man inte om kostnaderna ökar eller minskar. Excel-exporten är en säkerhetskopia och möjliggör avancerad analys utanför appen.

---

## 16. Hushållsadministration & GDPR

### Vad:
Säker och tydlig hantering av vilka som är med i hushållet, vem som får bjuda in, samt verktyg för att radera all personlig data (GDPR-efterlevnad).

### Hur:
- **Medlemslista & Kick-funktion:** På "Mina Sidor" hämtas hushållets medlemmar asynkront via tabellen `profiles`. Om inloggad användare har rollen `owner`, ges behörighet att klicka på en "Kicka ut"-knapp för vanliga medlemmar. Funktionen skapar ett nytt, tomt hushåll och kastar omedelbart dit den utsparkade medlemmen så att inga krascher uppstår och de förlorar tillgången till er delade data.
- **Dynamiskt Grundarskydd (Founder Protection):** Ett hushålls grundare (den vars profilrad har det allra äldsta `created_at` i hushållet) är numera helt osårbar. �ven om en "owner" försöker, försvinner knapparna för degradering och utsparkning automatiskt i UI:t för Grundaren. Denna logik är inte hårdkodad utan 100% dynamisk baserat på uppkomst i databasen.
- **Skyddade Inbjudningar:** Inbjudningskoden och blocket för molnsynk visas exklusivt för ägaren. Vanliga medlemmar får enbart en ren informationsvy över att de är med.
- **Lämna hushåll:** Knappen **"�xa� Lämna och skapa eget hushåll"** kör `handleCreateHousehold()` för användare som frivilligt vill hoppa av. Samma mekanism (nytt UUID via `crypto.randomUUID()`) körs. Den gamla hushållsdatan är orörd för de som är kvar.
- **GDPR Självradering:** En dedikerad och permanent röd knapp, "Radera mitt konto för alltid", finns placerad oavsett hushållsstatus. Raderingen anropar `delete_user`-funktionen i databasen som rensar autentiseringsidentiteten och låter PostgreSQL:s `ON DELETE CASCADE` radera all profilinformation och privata räkningar.
- **Användarvillkor & Integritetspolicy (ToS):** Ett nytt lager av juridisk säkerhet (`TermsModal.tsx`) är infört som interceptar användaren vid första inloggningen efter skapandet av kontot. Användaren måste expliciet godkänna villkoren för att komma in i appen. Detta val lagras i en ny boolean-kolumn `tos_accepted` i `profiles`-tabellen via appens Context-state, vilket gör att rutan endast visas en gång per användare.
- **Gl�mt L�senord & E-post-�terst�llning:** Inloggningssk�rmen (`LoginScreen.tsx`) hanterar l�senords�terst�llning genom att anropa Supabase API (`resetPasswordForEmail`). N�r anv�ndaren klickar p� �terst�llningsl�nken i e-postmeddelandet skickas de tillbaka till appen med en speciell URL-hash (`#access_token=...&type=recovery`). Applikationen (`App.tsx` & `AuthContext.tsx`) interceptar detta tillst�nd och renderar en dedikerad vy (`UpdatePassword.tsx`) ist�llet f�r den vanliga inloggningen. Denna vy till�ter anv�ndaren att skriva in sitt nya l�senord och tvingar d�refter fram en ny inloggning, vilket eliminerar risken f�r korrupta sessioner. Detta hanterar �ven "reset epost" fl�den s�kert.
- **Säker Minnesrensning (Zustand Wipe):** Vid `signOut` triggas appens globala `cleanup()`-funktion. Förutom att kasta inloggningstoken, tvångsåterställer den omedelbart React-appens hela in-memory state till `DEFAULT_STATE`. Detta hindrar att skärmen dröjer kvar med känslig data om en ny användare direkt registrerar sig i samma webbläsarfönster.

---

## 17. Filstruktur och Ansvar

| Fil | Ansvar |
|-----|--------|
| `src/supabase.ts` | Supabase-klient och anslutningskonfiguration. |
| `src/AuthContext.tsx` | Autentisering, registrering, sessionshantering, hushållsskapande. |
| `src/types.ts` | All datastruktur: `AppState`, `BillDefinition` (inkl. `isLoan`, `totalDebt`, `isAutoTransfer`), `PrivateBill`, `PrivateMonthData`, `MonthData`, `Account`, `SwishTransfer`, `CalculationResult`. |
| `src/migrateToRelational.ts` | Engångsskript som automatiskt migrerar gammal `state_json` till de nya relationstabellerna vid uppstart. Använder `upsert` � kan köras om utan bieffekter. |
| `src/store.ts` | Appens hjärna: `useStore()` (parallell inläsning från alla tabeller, realtidsprenumeration, optimistisk UI, alla CRUD-mutationer), `calculateMonth()` (Splitwise-matematik). |
| `src/App.tsx` | Rotkomponent, routing (hamburgermeny mobil / knappar desktop), hamburgermeny-state, kopplar alla store-actions till komponenter. |
| `src/excel.ts` | Genererar Excel-filen med tre flikar via `xlsx`-biblioteket. |
| `src/components/MonthView.tsx` | Gemensam månadsvy: inmatning, kopiera förra månaden, betalningsmarkering, lås-visning. |
| `src/components/PrivateView.tsx` | Privat vy: filtrerar `privateBills` på `userId`, inmatning, låsning av privata månader. |
| `src/components/Summary.tsx` | Sammanfattningsrutan med Swish- och �verföringsrekommendationer. |
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
- Som ett extra lås har vi lagt in `CHECK Constraints` på databasnivå i Supabase. �ven om klientkoden ignoreras eller hackas kommer databasen att totalvägra att registrera felaktig data (t.ex. negativa skulder eller obefintliga namn).

**Fas 4: "Enterprise Slutputs" (Oändlig Skalbarhet & Optimistic Rollbacks)**
- **Paginering / Lazy Loading:** Istället för att ladda ner hela hushållets historik på en gång vid uppstart, hämtas initialt enbart transaktioner för det *innevarande året* (plus december förra året för övergångar). Om användaren skrollar tillbaka till ett tidigare år triggas en asynkron bakgrundsladdning (`loadYear`). Appen behåller sin supersnabba uppstartstid ($\sim$ 0.1s) även med 20 års data.
- **Optimistic UI Rollbacks:** Om en nätverkssparning (`safeDb`) misslyckas efter att en användare klickat (t.ex. på grund av brutet internet eller att SQL-reglerna blockerade en felaktig siffra), kör appen automatiskt en rollback. Siffran på skärmen "hoppar tillbaka" till sitt ursprungliga värde, vilket helt eliminerar risken för att användargränssnittet och databasen hamnar i osynk.

**Fas 5: "The Final Polish" (Tester, Behörigheter & GDPR)**
- **Behörighetsnivåer (RBAC):** Istället för att alla användare i ett hushåll är administratörer ("owner") har appen nu ett rollsystem. Den som skapar hushållet blir `owner` och får ensamrätt på att radera gemensamma konton, räkningar och ändra inställningar. Inbjudna medlemmar blir `member` och kan lägga till nya gemensamma utgifter, men får ett avskalat gränssnitt (Låst läge) för existerande inställningar. En `owner` kan dock befordra en `member` till `owner` i "Mina Sidor". Eftersom Supabase RLS blockerar användare från att ändra varandras profil-rader, hanteras denna befordran via en säker `RPC` (Remote Procedure Call)-funktion i databasen (`set_user_role`) som förbigår RLS på ett säkert sätt.
- **Säkerhetskrav vid ändringar:** För att byta lösenord eller e-postadress på "Mina Sidor" måste användaren nu först verifiera sin identitet genom att skriva in sitt nuvarande lösenord (`signInWithPassword`).
- **Knapplås:** När en Swish eller �verföring markeras som utförd i Sammanfattningen (Summary.tsx), låses knappen omedelbart (`disabled`) för att förhindra oavsiktliga dubbelklick och av-markeringar. Upplåsning kan därefter endast ske via Inställningar -> Lås upp.
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

## 20. SaaS, Stripe & Admin-infrastruktur

SmartEkonomi är idag en fullvärdig SaaS (Software as a Service) med en inbyggd betalvägg och ett dolt, säkert admin-system.

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
- **VIP-system**: För vänner och familj finns en VIP-sökning i Admin-panelen. Via en RPC (`set_household_vip_by_email`) hittas hushållet och statusen sätts permanent till 'vip', vilket innebär att betalväggen helt ignoreras för det hushållet för all framtid, oavsett om Master Switchen är P�& eller AV.
- **Admin Statistik (`get_admin_stats`)**: Systemadministratören har en unik Dashboard (`AdminDashboard.tsx`) som kringgår det normala RLS-skyddet via en `SECURITY DEFINER`-funktion för att hämta det exakta antalet registrerade medlemmar i systemet och totalt antal aktiva, betalande hushåll.

---

## 21. Senaste UI/UX-uppdateringar & Insikter

Appens statistikdel och hanteringsflöde har kontinuerligt moderniserats för att ge en "Wow"-känsla och absolut tillförlitlighet.

### 21.1 Nya EkonomiTB (Insikter)
Statistik-vyn (`Statistics.tsx`) har byggts om i grunden:
- **"Glassmorphism" Design**: Ersatt äldre gränssnitt och tabeller med mörka, transparenta kort med moderna indikatorer.
- **Pålitlig Data-filtrering**: Koden filtrerar bort alla månader som inte har markerats som "hanterade" (`is_handled = true` eller `isLocked = true` för privata månader). Detta förhindrar att halvt ifyllda, framtida månader stör statistik och genomsnittskostnader.
- **Smarta KPI:er**: Omedelbar överblick av "Snittkostnad/månad", "Senaste månadens trend" (inklusive gröna/röda pilar), "Dyrast/Billigast senaste månaden", samt "Antal låsta räkningar".

### 21.2 Global Låsning (Total Summa)
För användare som aktiverat inställningen för att visa "Total Summa" i månadsvyn (`showTopTotal`) finns nu en smidig "Markera som hanterad"-knapp direkt under totalsumman.
- Klick på denna knapp stämplar månaden med `payment_id = 'top_total_lock'`.
- Detta inaktiverar omedelbart alla inmatningsfält i hela månaden och tystar Push-notisens Cron-jobb.
- Upplåsning sker sömlöst via "Lås upp"-fliken under inställningar.

### 21.3 Korrekt Lagring av Systeminställningar
Appens databas uppdaterades med kolumnen `show_top_total` i tabellen `household_settings`. Detta säkerställer att användarens individuella vy-inställningar (såsom att visa Total Summa) inte bara hanteras lokalt i klienten utan lagras permanent via `store.ts` och synkroniseras i realtid.

### 21.4 Offline-läge (Nätverksdetektion)
Tidigare kunde appen försöka spara data även vid bristande internetanslutning, vilket orsakade tysta fel och förlorad data när sidan laddades om. Nu är samtliga mutationer i `store.ts` skyddade med `navigator.onLine`. Om användaren tappar täckningen, visas omedelbart en röd fel-notis via `react-hot-toast` och sparningen avbryts direkt i klienten.

### 21.5 Historik & Arkivering av Data
Istället för att ladda ner all historisk data vid varje inloggning (vilket skulle bli långsamt efter några års användning) begränsas dataladdningen automatiskt till innevarande år. För att ändå ge tillgång till historik finns nu en "Hämta äldre år"-knapp i *EkonomiTB*. Denna knapp anropar `loadYear(year)` on-demand och minskar initial laddningstid drastiskt, samtidigt som gammal data förblir 100% tillgänglig.

---

## 22. Arkitekturella Designval & Filosofi

Under utvecklingen har vissa traditionella "Enterprise"-mönster (som ofta föreslås av generella AI-verktyg) aktivt valts bort till förmån för hastighet, prestanda och nollkostnads-drift. SmartEkonomi är designad som en snabb PWA.

### 22.1 Uträkningar (`calculateMonth`) sker i Frontend
Ett vanligt råd är att flytta tung logik till en backend-server för att isolera koden. I denna app sker istället alla Splitwise-uträkningar direkt i React (användarens telefon/webbläsare). 
**Varför?** 
- **Blixtsnabbt gränssnitt:** Genom att räkna i klienten sker alla UI-uppdateringar på millisekunder. Ingen nätverksladdning krävs när användaren knappar in ett nytt belopp.
- **Noll serverkostnad:** All beräkningskraft lånas av användarens enhet istället för att belasta Vercel/Supabase.
- **Offline-kapacitet:** Appen kan utföra matematiken även vid svajig uppkoppling.

### 22.2 RLS & Frontend som "Source of Truth"
I stället för att bygga en gigantisk Node.js/Python-backend förlitar sig appen på **Supabase RLS (Row Level Security)** som backend-skydd. 
- Frontend sköter visuell statushantering (Optimistic UI).
- RLS skyddar datan så att ingen kan läsa/skriva fel hushålls data.
- RPC-funktioner används **endast** för säkerhetskritiska uppgifter (som att uppgradera VIP-status eller spara Stripe-nycklar), vilket följer best-practice för Supabase. Detta minskar behovet av "dubbel-logik" i en dedikerad backend.

### 22.3 Full Reload vs Patch-Sync
När en användare laddar eller ändrar data använder appen ofta en full reload av nuvarande årets data (via `store.ts`), istället för avancerad patch-baserad synkronisering (som Redux + GraphQL-patches).
**Varför?** 
- Ett hushålls data för ett helt år är extremt liten i kilobyte. Att ladda om allt går ofta på under 50 millisekunder.
- Det garanterar 100% dataintegritet. Avancerade patch-system introducerar stor risk för state-desync (ex. att en användare swishar baserat på inaktuella siffror). 

Dessa val gör SmartEkonomi exceptionellt snabb, robust och nästintill gratis att drifta, i full kontrast till tunga och tröga Enterprise-arkitekturer.

---

## 23. Databassäkerhet & Linter
Under systemets utveckling genomfördes en rigorös granskning via Supabase Database Linter för att täppa till alla potentiella sårbarheter:
- **Function Search Path Mutable:** Alla inbyggda RPC-funktioner (som `get_admin_stats`, `toggle_paywall` m.m.) har explicit tilldelats `SET search_path = ''` för att förhindra SQL-injection via spoofing av schema.
- **SECURITY DEFINER Access:** Exekveringsrättigheter för administrativa funktioner har återkallats (`REVOKE EXECUTE`) från `PUBLIC` och `anon`-rollerna. Nu tillåts endast inloggade (`authenticated`) användare att *försöka* anropa dessa (funktionerna validerar sedan ifall användaren är Admin).
- **Leaked Password Protection:** Systemet är förberett för att slå på skyddet mot läckta lösenord via Supabase Auth-inställningar.

---

## 24. Testning & Kvalitetssäkring (QA)
SmartEkonomi har genomgått rigorösa automatiska och manuella tester för att klassificeras som produktionsredo ("Live-ready"). Resultaten och metodiken finns detaljerat dokumenterad i en separat testrapport: [TEST_RAPPORT.md](TEST_RAPPORT.md).

### 24.1 Logik- och Enhetstester
Hjärtat i applikationen är matematikmotorn i `store.ts` (`calculateMonth()`). Den testas via Vitest (`store.test.ts`) som säkerställer att:
- "Splitwise"-logiken fungerar 100% balanserat.
- Skulder ("debts") och överföringar ("transfers") fördelas exakt.
- Privata, gemensamma och autogiro-märkta räkningar separeras korrekt och beräknas på rätt individnivå.

### 24.2 Chaos Monkey & Stress Test
För att verifiera UI:ts tålighet användes ett avancerat "Chaos Monkey"-testverktyg. Ett automatiserat robot-skript skapade ett användarkonto och framkallade extremt hög last i webbläsaren:
- Klickande mellan rutter (`/mypages`, `/month`, `/stats`) utan att invänta animationer.
- Avbrytande av API-anrop från Onboarding-flödet.
- Testet lyckades inledningsvis identifiera en ovanlig React-loop (Maximum update depth exceeded) i `MyPages.tsx` som �tg�rdades omedelbart genom att optimera Zustand-selectorns array-allokering.
- Efter r�ttningen k�rdes testet igen, och applikationen var **100% stabil** under intensiv belastning utan en enda varning i konsolen. All state-hantering (via Zustand) och optimering via `Suspense`/`lazy` hanterade kontextbyten felfritt.

### 24.3 End-to-End Test av Betalfl�det (Stripe E2E)
Hela det fullst�ndiga betalfl�det har verifierats i en l�st produktionsliknande milj� via Stripe Sandbox f�r att garantera att betalv�ggen �r ogenomtr�nglig men �nd� fungerar s�ml�st f�r betalande kunder.
- **Admin-inmatning [GODK�NT]:** Stripe-nycklar (Secret, Webhook, Price ID) valideras dynamiskt via Vercel-API:et. Systemet bekr�ftar omedelbart med en gr�n "Aktivt"-indikator om integrationen fungerar.
- **Paywall Modal [GODK�NT]:** Betalv�ggen dyker upp korrekt och blockerar vyerna n�r master switchen �r aktiverad. Administrat�rer (VIP) sl�pps igenom utan blockering, och vanliga anv�ndare kan s�kert anv�nda "Logga ut"-knappen utan att fastna.
- **Skapa Prenumeration [GODK�NT]:** Stripe Checkout-session genereras felfritt via `/api/create-checkout.js` och tvingar fram 14 dagars gratis provperiod. Test-kreditkort g�r igenom framg�ngsrikt.
- **Webhook-synkronisering [GODK�NT]:** Efter kassan anropar Stripe appens `/api/stripe-webhook.js` i bakgrunden. Koden uppdaterar `stripe_status` till `active` i databasen vilket l�ser upp hela appen f�r kunden i realtid.
- **Customer Portal & Upps�gning [GODK�NT]:** Anv�ndaren kan klicka sig in p� Stripes s�kra kundportal via "Mina sidor". Att avbryta prenumerationen (Cancel) hanteras korrekt av webkroken som omedelbart nedgraderar `stripe_status`, vilket l�ser kontot och visar betalv�ggen vid n�sta inloggning.

Dessa tester garanterar att SmartEkonomi t�la verklighetsanpassad och extrem anv�ndning utan att f�rlora dataintegritet.

---

## 25. Re-branding & Senaste Funktionstill�gg

Den senaste iterationen av applikationen innebar ett officiellt namnbyte fr�n "Ekonomiapp / Ekonomi & Swish" till **SmartEkonomi** �ver hela projektet (inklusive dom�n, PWA-manifest, e-postmallar och pakethanterare). Vidare implementerades flera viktiga f�rb�ttringar kring UX och marknadsf�ring.

### 25.1 Portals f�r Modaler (z-index fix)
Ett problem med CSS-stacking contexts (d�r modaler som `InfoModal` hamnade bakom login-rutan trots h�g `z-index`) �tg�rdades strukturellt. Genom att implementera **React Portals** (`createPortal` direkt till `document.body`) bryter nu modalerna sig fria fr�n alla lokala CSS-begr�nsningar och garanteras rendera �verst i applikationen oavsett var de anropas ifr�n.

### 25.2 Dynamisk Kontaktinformation (Admin-styrd)
Sidfotens "Kontakt"-ruta har nu integrerats helt med `global_settings` och Admin-panelen. Administrat�ren kan inte bara uppdatera f�retagets uppgifter, utan �ven **visa/d�lja** enskilda f�lt (E-post, Telefon, Adress) via interaktiva checkboxes. Detta �r implementerat via en case-insensitive s�kerhetscheck i RPC:n `set_global_setting` (som nu anv�nder `LOWER(auth.jwt()->>'email')` f�r att skydda mot fel i versalisering av admin-eposten).

### 25.3 Tydlig Marknadsf�ring (14 dagars provperiod)
Paywall-infrastrukturen har f�rtydligats f�r att �ka konverteringen av nya anv�ndare:
- Checkout-koden i Vercel (`api/create-checkout.js`) skickar nu explicit med konfigurationen `subscription_data: { trial_period_days: 14 }` till Stripe. Detta tvingar automatiskt fram en 14-dagars gratis provperiod innan den f�rsta riktiga debiteringen genomf�rs, helt oberoende av manuella inst�llningar i Stripe Dashboard.
- En framtr�dande "=� Prenumerera"-knapp ligger numera publikt i sidfoten. Den �ppnar `SubscriptionFeaturesModal` (samma vy som anv�nds under Paywall) men utrustad med tydlig text om "Endast 59 kr/m�nad" och "Prova gratis i 14 dagar". Syftet �r att bes�kare omedelbart ska f�rst� f�rdelarna och priset innan de skapar ett konto. Anv�ndarvillkoren har ocks� uppdaterats f�r att �terspegla dessa betalningsvillkor.

---

## 26. Onboarding & Psykologisk V�rdeleverans

F�r att radikalt s�nka tr�skeln f�r nya anv�ndare, har onboarding-fl�det ("setupen") designats om fr�n grunden. Ist�llet f�r att m�tas av en tom sk�rm f�r anv�ndaren en guidad, interaktiv upplevelse (`OnboardingWizard.tsx`) baserad p� psykologiska UX-principer.

### 26.1 "Quick Win" via One-Click-mallar
I f�rsta steget visas vanliga r�kningar (t.ex. Hyra, El, Bredband) som klickbara "piller". Anv�ndaren beh�ver inte skriva n�got sj�lv, vilket minimerar den kognitiva belastningen. De v�ljer bara de utgifter de har.

### 26.2 F�rv�ntan (Build-up) och The WOW Moment
N�r anv�ndaren angett belopp f�r sina 3 f�rsta r�kningar, bygger appen upp f�rv�ntan:
- **Loader-l�ge:** Sk�rmen visar tillf�lligt *"R�knar ihop hush�llets utgifter..."* med en roterande ikon i 2 sekunder. Denna artificiella f�rdr�jning lurar hj�rnan att f�rv�nta sig en komplex ber�kning (Aha-moment).
- **V�rdeleverans & Konfetti:** Ist�llet f�r att bara skjuta konfetti i ett vakuum, presenteras den summerade kostnaden f�r hush�llet samtidigt som konfettiregnet startar. 
- **Solo Mode:** Om anv�ndaren inte har bjudit in en partner �nnu, visas texten: *"Hush�llets gemensamma utgifter: X kr. Med en partner blir din andel bara X/2 kr!"*. Detta kommunicerar det ekonomiska v�rdet av appen (Splitwise-utr�kningen) omedelbart.

### 26.3 Semi-Optional Partner Commitment
Ist�llet f�r att kr�va att anv�ndaren direkt bjuder in sin partner under "setupen" (vilket skapar friktion), presenteras steget nu som en m�jlighet efter att v�rdet redan bevisats.
- Koden och kopieringsfunktionen presenteras med rubriken *"Vill ni dela detta? (Rekommenderas)"*.
- En stor knapp under koden till�ter anv�ndaren att hoppa �ver steget (*"Hoppa �ver f�r nu - Ta mig till m�nadsvyn"*). 
- Detta skapar en k�nsla av kontroll och g�r inbjudan till ett naturligt och fritt val ist�llet f�r ett p�tvingat formul�r.

### 26.4 Magiskt f�rdig M�nadsvy
F�r att s�kerst�lla att momentum bibeh�lls n�r onboarding-guiden st�ngs, �ndrades standardbeteendet i `MonthView.tsx`.
Sammanfattningsrutan ("Hush�llets gemensamma utgifter" h�gst upp) tvingas nu vara synlig som standard f�r alla anv�ndare (s�vida de inte aktivt g�r in i inst�llningarna och sl�r av den). Anv�ndaren m�ts allts� omedelbart av sin f�rdiga, utr�knade total-summa snarare �n bara en detaljerad lista, vilket f�rst�rker "Wow"-upplevelsen.

---

## 27. Stripe Fels�kning, S�kra Admin-kontroller & PWA-krav

F�r att g�ra systemet mer robust och minska support�renden har vi inf�rt tydligare fels�kning och hanterat strikta webbl�sarkrav.

### 27.1 S�ker Validering av Stripe-kassavalvet (Vercel API)
Tidigare uppstod RLS-problem (Row Level Security) n�r Admin-panelen (frontend) skulle verifiera om Stripe-nycklarna sparats korrekt. 
- L�sningen �r en ny Serverless-funktion `api/check-stripe.js` som k�rs i Vercel. 
- N�r administrat�ren �ppnar Dashboarden anropas detta API, som i sin tur anv�nder `SUPABASE_SERVICE_ROLE_KEY` f�r att bypassa RLS och titta ner i `admin_secrets`-tabellen. 
- API:et returnerar antingen `{ active: true }` eller `{ active: false, reason: "Detaljerat felmeddelande" }`. 
- Admin-gr�nssnittet (`AdminDashboard.tsx`) renderar nu en oerh�rt tydlig och dynamisk statusbox (=� AKTIVT & INKOPPLAT eller =4 INTE AKTIVT med exakt orsak, t.ex. "Missing Vercel Envs" eller saknade nycklar).

### 27.2 Paywall "Escape Hatch" (Logga ut)
Tidigare dolde betalv�ggens backdrop hela menyn. Om en administrat�r loggade ut och en vanlig (obetald) anv�ndare loggade in i samma f�nster, frystes sk�rmen p� betalv�ggen utan m�jlighet att logga ut eller byta konto.
- L�sningen: En "=� Logga ut"-knapp lades till i botten av `PaywallModal.tsx`. 
- Vidare uppdaterades `App.tsx` s� att `currentView` *alltid* tv�ngs�terst�lls till `'month'`-vyn via en `useEffect` n�r en anv�ndare byts, vilket eliminerar risken att obeh�riga renderar ett tomt admin-skal.

### 27.3 PWA-installation & Service Worker Fetch-krav
Ett doldt krav f�r Android/Chrome f�r att betrakta en hemsida som en fullv�rdig PWA (och visa popupen "L�gg till p� hemsk�rmen" / `beforeinstallprompt`) �r att det m�ste finnas en aktiv Service Worker med en giltig `fetch`-lyssnare.
- Tidigare `main.tsx` raderade ("unregister") aktivt alla Service Workers, vilket effektivt st�ngde av PWA-installationsfunktionen.
- Koden har nu skrivits om s� att `navigator.serviceWorker.register('/push-sw.js')` k�rs konsekvent vid sidladdning.
- `public/push-sw.js` har kompletterats med en tom men n�dv�ndig `self.addEventListener('fetch', ...)` f�r att passera Googles PWA-validering. M�let �r att s�kerst�lla att mobilrutan (nedladdningsprompten) *alltid* visas f�r nya anv�ndare p� Android.

## Senaste Uppdateringar

* **Felhantering (Chunk Load Errors):** Lade till en automatisk omladdning i ErrorBoundary vid \Failed to fetch dynamically imported module\-fel, s� att nya releaser automatiskt laddas om ifall klienten har cache-problem.
* **Beh�ll inloggning vid fel:** �ndrade ErrorBoundary-knappen till att endast g�ra en \window.location.reload()\ ist�llet f�r att rensa \localStorage\. Detta f�rhindrar att anv�ndare blir ofrivilligt utloggade (d� Supabase auth token lagras d�r).
* **Playwright E2E-tester:** Lade till \@playwright/test\ f�r end-to-end testning. Ett f�rsta smoke test (\e2e/app.spec.ts\) har implementerats som startar appen och verifierar inloggningsvyn utan konsolfel. Kan k�ras via \
pm run test:e2e\.
* **Excel-export f�rb�ttringar:** P� fliken 'Gemensamma R�kningar' sorteras numera alla utgifter per konto-namn (Hus konto, Andreas konto, Helenas konto etc.) innan de ritas ut. Detta l�ste problemet med att utgifterna l�g osorterade / blandade.

  
* **Dynamiska Administrat�rer:** Byggt ett s�kert gr�nssnitt i admin-panelen f�r att l�gga till och ta bort systemadministrat�rer dynamiskt. Anv�nder tabellen system_admins och is_user_admin() RPC.
* **Live-Chatt Kundtj�nst:** Integrerat en realtids-chatt (Kundservice) byggd med Supabase Realtime f�r direktkommunikation mellan inloggade anv�ndare och admin.
  

## 28. Dynamisk Administrat�rshantering & Live-Chatt

F�r att g�ra appen mer skalbar och ge administrat�rer b�ttre verktyg, har tv� st�rre funktioner lagts till i backend och frontend: ett dynamiskt system f�r att utse administrat�rer, samt en fullskalig chatt f�r kundservice i realtid.

### 28.1 Dynamiska Administrat�rer
Ist�llet f�r att h�rdkoda specifika e-postadresser f�r admin-beh�righet, styrs detta nu via databasen.
- **`system_admins`:** En ny Supabase-tabell lagrar godk�nda e-postadresser (text, primary key).
- **`is_user_admin()`:** En ny PostgreSQL-funktion (RPC) som verifierar om inloggad anv�ndares (via `auth.jwt()`) e-post finns i tabellen. Denna anv�nds sedan b�de i Row Level Security (RLS) policies f�r att skydda andra tabeller, och av applikationen i start-laddningen.
- **Gr�nssnitt:** I `AdminDashboard.tsx` finns en separat flik d�r en administrat�r kan skriva in en e-postadress f�r att ge n�gon admin-r�ttigheter (l�ggs till i tabellen) eller klicka p� en papperskorg f�r att ta bort r�ttigheterna (tas bort fr�n tabellen). Inloggad admin kan ej ta bort sig sj�lv.

### 28.2 Live-Chatt / Kundservice i Realtid
Ett komplett system f�r kundtj�nst skapades f�r att m�jligg�ra direktkontakt mellan anv�ndare och support.
- **Databasstruktur:** 
  - `chat_sessions`: Hanterar aktiva �renden (`id`, `user_id`, `status: waiting|active|closed`, `updated_at`).
  - `chat_messages`: Hanterar meddelanden i varje �rende (`id`, `session_id`, `sender_type: user|admin`, `message`, `created_at`).
  - `on_new_chat_message`: Databastrigger (Trigger) som automatiskt uppdaterar `updated_at` i sessionen vid varje nytt meddelande.
- **Anv�ndargr�nssnitt (`ChatBubble.tsx`):**
  - En flytande "=�"-bubbla i nedre h�gra h�rnet visas f�r inloggade anv�ndare om chatten �r �ppen globalt.
  - Ogenomskinlig, mobilanpassad chattruta som ligger ovanp� allt annat.
  - Minimeringsfunktion `_` g�r det m�jligt att st�nga ner rutan tillf�lligt.
  - En r�d notis-ikon (Badge) visar antalet ol�sta meddelanden om supporten svarar medan chatten �r minimerad.
- **Admin-vy (`AdminChat.tsx`):**
  - Administrat�rer ser en realtids-k� med �renden uppdelat i "V�ntar" (R�d) och "Aktiv" (Gr�n).
  - V�nster kolumn visar alla sessioner (med uppslag mot `profiles` f�r att visa e-post), och h�ger kolumn �r sj�lva chattrutan.
  - Vyn �r fullt mobilanpassad via flexibla CSS-klasser (`admin-chat-layout`) med smart radbrytning.
  - Knappen "Avsluta �rende" markerar sessionen som `closed`. N�r anv�ndaren f�r denna statusl�s textinmatningen f�r dem med ett meddelande om att starta en ny session.
- **Supabase Realtime:** 
  - Kommunikationen drivs av Supabase Channels (WebSockets). Klienterna prenumererar p� inserts i `chat_messages`, och uppdateringar i `chat_sessions` f�r att omedelbart bygga om chattgr�nssnittet utan att sidladdning kr�vs.
  

### 28.3 Ytterligare Kundservice-funktioner (Senaste till�ggen)
F�r att f�rb�ttra kundupplevelsen och g�ra chattformattet mer professionellt har f�ljande funktioner lagts till:
- **Beh�llen Chatthistorik:** Logiken i `ChatBubble.tsx` har �ndrats s� att anv�ndarens chatt inte l�ngre rensas n�r de minimerar rutan (`isOpen = false`), �ven om �rendet har avslutats (`closed`). Historiken rensas lokalt *endast* om anv�ndaren uttryckligen klickar p� `` (St�ng) efter att admin har st�ngt �rendet. Detta s�kerst�ller att anv�ndaren hinner l�sa kundtj�nstens sista meddelande.
- **K�-system i Realtid:** Om en kund startar en chatt och administrat�ren inte �r tillg�nglig, pollar klienten nu var 15:e sekund f�r att se hur m�nga andra sessioner som st�r f�re i k�n (`created_at` �ldre �n nuvarande session med `status = 'waiting'`). Kunden ser d� texten "Din k�plats: X" i toppen av chatt-bubblan.
- **Notis-Badge f�r Ol�sta Meddelanden:** Om en anv�ndare har chattrutan minimerad och admin skickar ett meddelande, �kar en r�d siffer-badge (`unreadCount`) p� chattikonen. Denna nollst�lls omedelbart n�r anv�ndaren �ppnar rutan igen.
- **Robust felhantering (.maybeSingle):** Databasanropet f�r att h�mta aktiva sessioner �ndrades fr�n `.single()` till `.maybeSingle()` f�r att f�rhindra HTTP 406 (Not Acceptable) n�tverksfel n�r ingen aktiv chatt hittades i databasen.
  

## 29. �kta Web Push-notiser (Bakgrundsnotiser f�r Chatt & P�minnelser)

F�r att l�sa problemet med att mobiltelefoner pausar JavaScript (och d�rmed st�nger WebSocket-uppkopplingen) n�r sk�rmen l�ses eller appen hamnar i bakgrunden, har ett system f�r **Web Push-notiser** implementerats. Detta garanterar att notiser kommer fram och "plingar" �ven om appen �r st�ngd.

### Vad
Tv� huvudsakliga push-funktioner har lagts till:
1. **Kundtj�nst-notiser:** Meddelar omedelbart administrat�rer (i bakgrunden) n�r en kund skriver i live-chatten.
2. **R�knings-p�minnelser:** Schemalagda notiser som skickas automatiskt till anv�ndare n�r det �r dags att l�sa m�naden och betala r�kningar.

### Hur
Infrastrukturen bygger p� branschstandarden f�r PWA-notiser och best�r av f�ljande delar:
- **Kryptering (VAPID):** Systemet anv�nder VAPID-nycklar (`VAPID_PUBLIC_KEY` och `VAPID_PRIVATE_KEY` sparade som milj�variabler i Vercel) f�r att bevisa f�r Apple och Google att notiserna kommer fr�n r�tt avs�ndare.
- **Service Worker (`push-sw.js`):** En Service Worker �r installerad p� anv�ndarens enhet som "sover" i bakgrunden. N�r ett push-event tas emot fr�n Apple/Google vaknar den till, ritar upp notisen och spelar upp telefonens standardljud.
- **Databas & Prenumerationer:** 
  - Administrat�rers unika prenumerationsnycklar (tokens) sparas i tabellen `admin_push_subscriptions`.
  - Vanliga anv�ndares nycklar sparas i `push_subscriptions`.
- **Utskick via Supabase Webhook (Chatt):** N�r en kund skriver ett meddelande (`INSERT` i `chat_messages`) triggas en Supabase Webhook. Webhooken g�r ett anrop till backend-API:et `api/send-push.js` (p� Vercel), som i sin tur kontaktar Apples/Googles servrar och skickar ut notisen.
- **Utskick via Vercel Cron (R�kningar):** Anv�ndare kan i "Mina Sidor" v�lja vilket datum (`reminder_day` i `household_settings`) de vill ha p�minnelser. Ett schemalagt "Cron-jobb" via `vercel.json` anropar `api/cron.js` automatiskt klockan 10:00 (UTC) varje dag. API:et kollar vilka hush�ll som ska p�minnas just idag och skickar ut notiserna.
- **Gr�nssnitt:** "Notiser P�/AV"-knappar som fr�gar webbl�saren om till�telse via `PushManager` API:t finns implementerade i b�de `AdminChat.tsx` (f�r kundtj�nst) och i `MyPages.tsx` (f�r r�knings-p�minnelser, med en dropdown f�r datum).

### Varf�r
Eftersom operativsystem som iOS har strikta batterisparfunktioner, d�r "realtids-kopplingen" n�r sk�rmen sl�cks. �kta Web Push-notiser �r det enda tillf�rlitliga s�ttet att skicka tids- och h�ndelsekritiska uppdateringar till anv�ndare som inte aktivt tittar p� appen. Detta g�r plattformen mycket mer robust, likv�rdig med inbyggda native-appar fr�n App Store.


---

## Push-notiser och Realtids-chatt (Avancerad Arkitektur)

### �versikt
Systemet f�r push-notiser �r byggt f�r att kringg� aggressiva batteri-optimeringar och notis-blockeringar (s�rskilt p� Samsung/Android). Det anv�nder en kombination av Vercel Serverless Functions, Supabase Database, och en anpassad PWA Service Worker.

### 1. PWA & Android WebAPK (Manifestet)
F�r att Android ska acceptera webbappen som en "�kta" app (vilket kr�vs f�r att f� en egen notiskanal i inst�llningarna och inte klumpas ihop med Chrome), anv�nds "Maskable Icons" i PWA-manifestet (`vite.config.ts`).
Genom att ange `purpose: 'maskable'` tvingas Chrome att generera en WebAPK vid installation p� hemsk�rmen, vilket ger appen fulla r�ttigheter till operativsystemets push-tj�nster och kringg�r Samsungs standard-blockeringar av webbl�sar-notiser.

### 2. Bypass av Supabase Webhooks
Vi f�rlitar oss **inte** p� Supabase Webhooks (`pg_net`) f�r att skicka notiser, eftersom detta ofta �r instabilt och leder till f�rdr�jningar. Ist�llet skickar frontend-koden (`ChatBubble.tsx`) en direkt `POST`-request till Vercel-API:et (`/api/send-push`) i samma millisekund som meddelandet sparas i databasen. Detta garanterar omedelbar leverans utan mellanh�nder.

### 3. VAPID-nycklar & Vercel
F�r att autentisera mot Googles (FCM) och Apples push-servrar anv�nds VAPID-nycklar. 
- **Frontend** bygger in den offentliga nyckeln via `import.meta.env.VITE_VAPID_PUBLIC_KEY` och ber anv�ndarens webbl�sare om till�telse (`pushManager.subscribe`). Adressen sparas sedan i tabellen `admin_push_subscriptions`.
- **Backend (Vercel)** anv�nder `VITE_VAPID_PUBLIC_KEY` och `VAPID_PRIVATE_KEY` inifr�n Vercel Environment Variables f�r att signera signalen. Om dessa saknas v�gras �tkomst med felet "Received unexpected response code".

### 4. Anti-Spam & St�r-Ej (Service Worker)
I `push-sw.js` finns avancerad logik f�r att f�rhindra dubbletter och o�nskade notiser:
- **`isAppActive` (St�r Ej):** Innan notisen visas kollar Service Workern om appen redan �r �ppen och fokuserad p� sk�rmen (`visibilityState === 'visible'`). Om den �r det, avbryts push-notisen tyst, eftersom anv�ndaren �nd� ser chatten uppdateras i realtid via WebSockets.
- **Tag-gruppering:** Vercel-servern skickar notisen med `tag: 'chat-message'`. Om flera notiser skickas samtidigt (t.ex. vid n�tverkslagg), skriver operativsystemet �ver den f�reg�ende notisen s� att anv�ndaren endast f�r ett enda "pling" ist�llet f�r fyra stycken p� rad.
- **Borttagen Lokal Notis:** Den inbyggda `showNotification()` inuti WebSocket-lyssnaren i `AdminChat.tsx` har tagits bort helt. Detta f�rhindrar att WebSocket-trafiken och Web Push-trafiken krockar och skapar dubbletter n�r appen k�rs i bakgrunden.

Denna arkitektur �r industri-standard och s�kerst�ller maximal drifts�kerhet p� b�de iOS, Android och Desktop-milj�er.

## 30. Anpassningsbara Vyer & Inst�llningar (Ny Uppdatering)

### Vad
Den senaste uppdateringen fokuserar p� att ge anv�ndarna full kontroll �ver vilka element som visas i applikationens vyer, samt hur push-notiser beter sig utifr�n dessa val. Vyer har ocks� bytt namn ("M�nadsvy" heter nu "Gemensam") f�r att tydligare reflektera funktionaliteten.

### Varf�r
Tidigare var vissa rutor (som totalbelopp) h�rdkodade och ibland duplicerade (i den privata vyn fanns b�de en fast ruta och en inst�llningsbar ruta). Dessutom ville anv�ndare kunna anv�nda appen som en "klassisk utgiftskoll" utan att beh�va l�sa/markera r�kningar som hanterade. Det fanns �ven en dubblett av datuminst�llningen f�r push-notiser som skapade f�rvirring. Detta l�stes f�r att skapa ett renare, mer flexibelt gr�nssnitt som anpassar sig till anv�ndarens behov.

### Hur
- **Gemensam vy (tidigare M�nadsvy):** Namnbytet genomf�rdes i hela navigeringsstrukturen (`App.tsx`). L�sknappen f�r totalbeloppet fick ocks� en visuell uppdatering f�r att matcha �vriga "L�st"-knappar (solid gr�n bakgrund, `var(--success-color)`).
- **Separata Totalsummor:** Inst�llningen f�r totalbelopp delades upp i tv� separata toggles i `ManageBills.tsx`: en f�r "Gemensam vy" (`showTopTotal`) och en f�r "Privat vy" (`showPrivateTopTotal`). Den h�rdkodade totalrutan i `PrivateView.tsx` togs bort.
- **Hanteringsknappar (L�s & Hanterat):** En ny inst�llning `enableManagementButtons` lades till. N�r denna �r urkryssad d�ljs alla knappar f�r att markera �verf�ringar och totalbelopp som klara i `Summary.tsx` och `MonthView.tsx`.
- **Intelligenta Push-notiser:** Cron-jobbet (`api/cron.js`) som skickar ut p�minnelser l�ser nu av `enable_management_buttons` direkt fr�n databasen (`household_settings`). Om hush�llet st�ngt av hanteringsknapparna hoppas hush�llet �ver helt i utskicket (eftersom det inte finns n�got s�tt f�r dem att markera r�kningarna som klara �nd�).
- **St�dning av UI:** Inst�llningen f�r "P�minnelsedatum" togs bort fr�n 'Allm�nt' eftersom den var duplicerad och redan fanns under 'Mina Sidor' (d�r anv�ndaren �ven aktiverar sina push-prenumerationer). Varningstexten om historik flyttades fr�n App-skalets rotniv� in direkt i `MonthView.tsx` s� att den ligger naturligt under totalbelopps-rutan.
- **Databas (Schema):** F�r att bibeh�lla "Frontend som Source of Truth" f�r tillf�lligt state, men �nd� kunna styra Cron-jobbet, kompletterades `household_settings` med nya kolumner: `show_swish_summary`, `show_transfer_summary`, `enable_management_buttons`, och `show_private_top_total`.


## 31. F�rb�ttrad Anv�ndarupplevelse (UX/UI Uppdateringar)

### Vad
En omfattande upputsning av anv�ndargr�nssnittet i inst�llningarna och onboarding-fl�det har genomf�rts. Fokus har legat p� att g�ra det l�ttare att f�rst� funktioner utan att l�sa l�nga manualer, samt att minska visuell "clutter" (r�righet).

### Varf�r
Tidigare k�ndes formul�r och inst�llningar stela och otydliga (t.ex. dropdown-listor med l�nga beskrivande namn). Genom att anv�nda moderna UI-m�nster (steg-f�r-steg-guider, dolda f�lt tills de beh�vs, och visuella kort ist�llet f�r select-boxar) s�nks tr�skeln f�r nya anv�ndare avsev�rt.

### Hur
- **Visuell "Wow"-effekt vid Onboarding:** I slutet av onboarding-guiden visas nu en interaktiv sammanst�llning av hush�llets valda standardr�kningar. Totalbeloppet animeras fr�n noll upp till slutsumman med hj�lp av ett skr�ddarsytt `CountUp`-script (react-effekt) som h�jer premium-k�nslan i applikationen.
- **Onboarding UUID Fix:** En bugg �tg�rdades d�r Onboarding-guiden f�rs�kte spara kategorinamn (t.ex. "boende") i relations-databasen ist�llet f�r det faktiska UUID:t f�r det Gemensamma Kontot. Koden `useStore` implementerades f�r att matcha r�tt konto och skicka r�tt `accountId`.
- **Smarta Formul�r (R�kningar):** N�r man l�gger till en ny r�kning (i Hantera R�kningar) har f�lten organiserats om:
  - En **rullgardin med "Vanliga r�kningar..."** lades till bredvid inmatningsf�ltet f�r namn. Anv�ndaren kan snabbt v�lja t.ex. "El" s� fylls textrutan i automatiskt.
  - Intervalls-knapparna ("Betalas varje m�nad" / "V�lj m�nader") �r nu **dolda** och visas enbart om anv�ndaren kryssar i rutan *"Varna med r�d f�rg om jag gl�mmer fylla i denna"*.
  - Rutan f�r ursprunglig skuld/l�n flyttades s� den visas **direkt under** l�ne-kryssrutan, snarare �n att ligga separerad i slutet av formul�ret.
- **Skapa Konto UI-Overhaul:** Inst�llningarna f�r att l�gga till nya konton/personer (under fliken Konton) byggdes om fr�n rullgardiner till en 3-stegs guide ("1. Typ av konto", "2. Namn", "3. Hur tar kontot emot pengar?"). Layouten anv�nder grid-baserade kort som klickas i, med mjuk och beskrivande text ("En person" vs "Ett gemensamt m�l") ist�llet f�r versaler och tekniska beskrivningar.
- **Rensning av L�s-vyn:** I inst�llningarna f�r "L�s upp m�nader/konton" togs de duplicerade knapparna f�r delade konton bort. Vyn visar nu ist�llet en enda �vergripande `Total kostnad (Hela m�naden) =`-knapp som l�ser upp hela m�naden p� ett klick, vilket speglar funktionaliteten i MonthView.
- **F�renklad Text:** Uttryck som *"Mottar pengar via Swish"* har bytts ut till det mer standardiserade *"Betalningsmetod: Swish"* f�r ett renare utseende.

## 32. Demo-l�ge f�r nya anv�ndare

### Vad
Ett l�tsas-l�ge (mock-state) f�r helt nya anv�ndare (utan r�kningar) d�r appen fylls med realistisk testdata, historik och l�sta m�nader.

### Varf�r
F�r att minska tr�skeln f�r nya anv�ndare att f�rst� appens v�rde. Genom att utforska f�rdig data i Gemensam vy och EkonomiTB kan anv�ndaren se slutm�let innan de b�rjar bygga sin egen ekonomi.

### Hur
- Ett tillf�lligt UI-state (isDemoMode, ealState) inf�rdes i src/store.ts via Zustand.
- Funktionen startDemo() sparar undan den riktiga, tomma datan i minnet och ers�tter statet med mock-konton ('Johan', 'Maria') och mock-r�kningar.
- Sp�rrar lades in i samtliga state-mutationer (t.ex. updateBillAmount) s� att if (get().isDemoMode) return; blockerar databasanrop (Supabase) n�r demo-l�get �r aktivt. Testdata kan allts� aldrig r�ka sparas f�r alltid.
- En stopDemo() funktion laddar tillbaka originaldatan fr�n minnet.
- UI f�r 'Starta Demo' renderas endast i MonthView.tsx n�r listan p� r�kningar �r helt tom (state.bills.length === 0).

## 31. F�rb�ttrad Anv�ndarupplevelse (UX/UI Uppdateringar)

### Vad
En omfattande upputsning av anv�ndargr�nssnittet i inst�llningarna och onboarding-fl�det har genomf�rts. Fokus har legat p� att g�ra det l�ttare att f�rst� funktioner utan att l�sa l�nga manualer, samt att minska visuell "clutter" (r�righet).

### Varf�r
Tidigare k�ndes formul�r och inst�llningar stela och otydliga (t.ex. dropdown-listor med l�nga beskrivande namn). Genom att anv�nda moderna UI-m�nster (steg-f�r-steg-guider, dolda f�lt tills de beh�vs, och visuella kort ist�llet f�r select-boxar) s�nks tr�skeln f�r nya anv�ndare avsev�rt.

### Hur
- **Visuell "Wow"-effekt vid Onboarding:** I slutet av onboarding-guiden visas nu en interaktiv sammanst�llning av hush�llets valda standardr�kningar. Totalbeloppet animeras fr�n noll upp till slutsumman med hj�lp av ett skr�ddarsytt `CountUp`-script (react-effekt) som h�jer premium-k�nslan i applikationen.
- **Onboarding UUID Fix:** En bugg �tg�rdades d�r Onboarding-guiden f�rs�kte spara kategorinamn (t.ex. "boende") i relations-databasen ist�llet f�r det faktiska UUID:t f�r det Gemensamma Kontot. Koden `useStore` implementerades f�r att matcha r�tt konto och skicka r�tt `accountId`.
- **Smarta Formul�r (R�kningar):** N�r man l�gger till en ny r�kning (i Hantera R�kningar) har f�lten organiserats om:
  - En **rullgardin med "Vanliga r�kningar..."** lades till bredvid inmatningsf�ltet f�r namn. Anv�ndaren kan snabbt v�lja t.ex. "El" s� fylls textrutan i automatiskt.
  - Intervalls-knapparna ("Betalas varje m�nad" / "V�lj m�nader") �r nu **dolda** och visas enbart om anv�ndaren kryssar i rutan *"Varna med r�d f�rg om jag gl�mmer fylla i denna"*.
  - Rutan f�r ursprunglig skuld/l�n flyttades s� den visas **direkt under** l�ne-kryssrutan, snarare �n att ligga separerad i slutet av formul�ret.
- **Skapa Konto UI-Overhaul:** Inst�llningarna f�r att l�gga till nya konton/personer (under fliken Konton) byggdes om fr�n rullgardiner till en 3-stegs guide ("1. Typ av konto", "2. Namn", "3. Hur tar kontot emot pengar?"). Layouten anv�nder grid-baserade kort som klickas i, med mjuk och beskrivande text ("En person" vs "Ett gemensamt m�l") ist�llet f�r versaler och tekniska beskrivningar.
- **Rensning av L�s-vyn:** I inst�llningarna f�r "L�s upp m�nader/konton" togs de duplicerade knapparna f�r delade konton bort. Vyn visar nu ist�llet en enda �vergripande `Total kostnad (Hela m�naden) =`-knapp som l�ser upp hela m�naden p� ett klick, vilket speglar funktionaliteten i MonthView.
- **F�renklad Text:** Uttryck som *"Mottar pengar via Swish"* har bytts ut till det mer standardiserade *"Betalningsmetod: Swish"* f�r ett renare utseende.


## 2026-06-13 Enterprise S�kerhet & Onboarding

- **Enterprise Admin-struktur:** Tabellen `system_admins` �r nu ombyggd f�r h�gsta s�kerhetsklassificering. Den anv�nder `user_id` (UUID) som Primary Key med en Foreign Key-koppling direkt mot `auth.users(id)` och `ON DELETE CASCADE`. Detta inneb�r att om en admin raderar sitt konto utpl�nas deras admin-r�ttigheter omedelbart och permanent. Det f�rhindrar konto�vertagande ifall n�gon f�rs�ker registrera samma mejladress igen.

- **Strikt E-postbekr�ftelse:** E-postbekr�ftelse �r tvingande. Nyskapade konton hamnar i `auth.users` med `email_confirmed_at = null` och kan inte logga in. F�r att f�rhindra missbruk har vi �ven inf�rt en databasfunktion `check_email_confirmed()` som blockerar �terst�llning av l�senord f�r konton som inte har bekr�ftat sin e-postadress. Detta eliminerar alla bakd�rrar.

- **Sj�lvst�ndig Onboarding:** Fl�det f�r nya konton har st�dats upp. Tidigare dolda auto-skapanden av hush�ll i `LoginScreen.tsx` har raderats. Nu hanterar `Onboarding.tsx` hela skapandet av hush�llet p� ett s�kert s�tt.

- **R�tt Standardinst�llningar:** Vid nyskapade konton (via Onboarding) initieras `household_settings` nu med strikta standardv�rden: endast `show_top_total` och `enable_management_buttons` �r aktiverade, medan Swish- och �verf�ringssammanst�llningar �r dolda fr�n start. Som kontrast f�rblir alla funktioner p�slagna n�r man klickar "Prova Demo" f�r att maximera upplevelsen f�r bes�kare.

## 33. Onboarding & RLS Felkorrigeringar (Bug Fixes)

### Vad
En serie kritiska buggar som gjorde att nya anv�ndare fastnade i loopar vid godk�nnande av anv�ndarvillkor, eller blev insl�ppta i appen utan konto, har identifierats och �tg�rdats. Dessutom har 'Demol�ge' och 'Live-chatt' lagts till i funktionerna f�r prenumeranter.

### Varf�r
N�r e-postbekr�ftelse slogs p� (och Supabase PKCE-fl�de b�rjade anv�ndas) uppstod en kedjereaktion:
1. **Misslyckad Profilskapelse:** Vid registrering skapades ingen session (pga krav p� e-postbekr�ftelse). RLS-regeln f�r \profiles\ kr�vde dock en aktiv session (\uth.uid() = id\) f�r att f� g�ra en \INSERT\. Detta ledde till att nya konton aldrig fick n�gon profilrad i databasen.
2. **Loop i Policyn (Terms of Service):** N�r anv�ndaren sedan loggade in och godk�nde policyn, f�rs�kte koden uppdatera \	os_accepted = true\ p� en profil som inte fanns. Felet f�ngades inte av Supabase utan ignorerades (0 rader uppdaterades). Vid sidladdning trodde appen d�rf�r att policyn fortfarande var ogodk�nd.
3. **Onboarding Bypass:** Koden f�r att visa 'Skapa Hush�ll'-rutan utv�rderade \state.accounts.length === 0\. Men vid fr�nkoppling/felaktig profil laddade Zustand \DEFAULT_STATE\ (som inneh�ll dummy-konton med \length === 3\). D�rmed trodde appen felaktigt att anv�ndaren redan hade konton och sl�ppte in dem i applikationen direkt, utan r�ttigheter.

### Hur
- **Supabase Auth Trigger:** Skapade SQL-funktionen \handle_new_user\ och en databastrigger (\AFTER INSERT ON auth.users\) som automatiskt skapar profilraden p� server-sidan med admin-beh�righet (Security Definer), vilket f�rbig�r RLS och garanterar att profilen existerar redan innan bekr�ftelsemailet klickas.
- **RLS f�r Uppdateringar:** Implementerade \FOR UPDATE\ RLS policy p� \profiles\-tabellen f�r att uttryckligen till�ta anv�ndare att uppdatera sina egna rader (t.ex. \	os_accepted\ och \ole\).
- **F�rb�ttrad Gate-logik:** Onboarding-rutan (\
eedsOnboarding\) i \App.tsx\ triggas numera s�kert av \!householdId\ (kontrollerar ifall hush�ll ID saknas helt) ist�llet f�r att lita p� \ccounts.length\. Detta f�rhindrar helt att dummy-data sl�pper in obeh�riga.
- **F�rb�ttrad PKCE URL-detektion:** \AuthContext.tsx\ kollar nu efter \code=\ och \ccess_token=\ i URL-hashen (samt negerar \	ype=recovery\) f�r att s�kert fastst�lla om det �r en lyckad e-postbekr�ftelse (och d�refter visa 'Grattis din mejl �r bekr�ftad'-rutan).
- **�tg�rdat Databas-schema:** Lade till den saknade \
ame\-kolumnen (VARCHAR) i \households\-tabellen, vilket eliminerade schema error n�r anv�ndare fyllde i namnet p� sitt hush�ll.
- **�tkomst f�r alla:** Tog bort \ole === 'owner'\ sp�rren p� knapparna till inst�llningsflikarna (\Allm�nt\ och \Konton\) i \ManageBills.tsx\.
- **UI-Uppdatering f�r SaaS:** Live-chatt och Demol�ge lades till som punkter i \SubscriptionFeaturesModal.tsx\ och \LoginScreen.tsx\ f�r att f�rtydliga appens v�rdeerbjudande.
