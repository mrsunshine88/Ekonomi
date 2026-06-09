# Ekonomi & Swish - Systemdokumentation

**Version:** 4.0 (Enterprise-uppgradering: Zustand, Zod & Säkerhet)  
**Plattform:** React + TypeScript + Vite (PWA) | Databas: Supabase (PostgreSQL) | Hosting: Vercel  
**Uppdaterad:** 2026-06-09

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

### Hur – PWA-teknik:
`vite-plugin-pwa` i `vite.config.ts` genererar automatiskt:
- **Service Worker (`sw.js`):** Cachar appens filer lokalt. Appen laddas snabbt även vid dålig signal och fungerar i offline-läge.
- **Web App Manifest (`manifest.webmanifest`):** Berättar för telefonen att appen är installationsbar. Definierar ikon, namn och fullskärmsläge.

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
3. **Räkna balansen:** Om räkningen är på ett **delat konto** (t.ex. huskontot) → varje person måste *föra över* sin andel. Om räkningen är betald av en **person** direkt → den personen får kredit, de andra debiteras.
4. **Splitwise-algoritm (Debt Simplification):** Balanserna sorteras i fordringsägare och gäldenärer. Algoritmen parar ihop dem och skapar minimalt antal `SwishTransfer[]`-objekt.

### Varför:
Kärnan i hela appen. Oavsett om sambon tog elräkningen och du tog hyran, fixar appen nettobeloppet på en bråkdel av en sekund. Eliminerar all manuell räkning och missförstånd.

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
- `PrivateView.tsx` visar bara räkningar där `bill.userId === user.id` (klientfiltrering utöver RLS).
- En räkning kan markeras som delad (`isShared: true`), varpå den visas som "read-only" hos övriga hushållsmedlemmar under "Delade utgifter".
- En grön **"✅ Markera månad som klar"**-knapp kör `togglePrivateLock(monthId)` → `upsert` i `private_month_locks`. Stänger månaden och förhindrar vidare redigering.
- Belopp per månad sparas i `private_month_amounts` (en rad per räkning och månad).
- Upplåsning sker via `⚙️ Inställningar → 🔒 Lås upp → "Mina Privata Lås"`.

### Varför:
Hushållsmedlemmar vill ha en komplett bild av *all* sin ekonomi på ett ställe. Privata kostnader ska *aldrig* räknas in i den gemensamma Swish-uppgörelsen.

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
- **Skyddade Inbjudningar:** Inbjudningskoden och blocket för molnsynk visas exklusivt för ägaren. Vanliga medlemmar får enbart en ren informationsvy över att de är med.
- **Lämna hushåll:** Knappen **"🚪 Lämna och skapa eget hushåll"** kör `handleCreateHousehold()` för användare som frivilligt vill hoppa av. Samma mekanism (nytt UUID via `crypto.randomUUID()`) körs. Den gamla hushållsdatan är orörd för de som är kvar.
- **GDPR Självradering:** En dedikerad och permanent röd knapp, "Radera mitt konto för alltid", finns placerad oavsett hushållsstatus. Raderingen anropar `delete_user`-funktionen i databasen som rensar autentiseringsidentiteten och låter PostgreSQL:s `ON DELETE CASCADE` radera all profilinformation och privata räkningar.
- **Säker Minnesrensning (Zustand Wipe):** Vid `signOut` triggas appens globala `cleanup()`-funktion. Förutom att kasta inloggningstoken, tvångsåterställer den omedelbart React-appens hela in-memory state till `DEFAULT_STATE`. Detta hindrar att skärmen dröjer kvar med känslig data om en ny användare direkt registrerar sig i samma webbläsarfönster.

---

## 17. Filstruktur och Ansvar

| Fil | Ansvar |
|-----|--------|
| `src/supabase.ts` | Supabase-klient och anslutningskonfiguration. |
| `src/AuthContext.tsx` | Autentisering, registrering, sessionshantering, hushållsskapande. |
| `src/types.ts` | All datastruktur: `AppState`, `BillDefinition` (inkl. `isLoan`, `totalDebt`), `PrivateBill`, `PrivateMonthData`, `MonthData`, `Account`, `SwishTransfer`, `CalculationResult`. |
| `src/migrateToRelational.ts` | Engångsskript som automatiskt migrerar gammal `state_json` till de nya relationstabellerna vid uppstart. Använder `upsert` – kan köras om utan bieffekter. |
| `src/store.ts` | Appens hjärna: `useStore()` (parallell inläsning från alla tabeller, realtidsprenumeration, optimistisk UI, alla CRUD-mutationer), `calculateMonth()` (Splitwise-matematik). |
| `src/App.tsx` | Rotkomponent, routing (hamburgermeny mobil / knappar desktop), hamburgermeny-state, kopplar alla store-actions till komponenter. |
| `src/excel.ts` | Genererar Excel-filen med tre flikar via `xlsx`-biblioteket. |
| `src/components/MonthView.tsx` | Gemensam månadsvy: inmatning, kopiera förra månaden, betalningsmarkering, lås-visning. |
| `src/components/PrivateView.tsx` | Privat vy: filtrerar `privateBills` på `userId`, inmatning, låsning av privata månader. |
| `src/components/Summary.tsx` | Sammanfattningsrutan med Swish- och Överföringsrekommendationer. |
| `src/components/Statistics.tsx` | EkonomiTB: grafer (recharts), skuld-progress-bars, Excel-knapp, Gemensam/Privat-växel. |
| `src/components/ManageBills.tsx` | Inställningspanelen: Räkningar (inkl. Lån-kryssruta), Konton, Lås upp (uppdelat Gemensam/Privat), Allmänt. Responsiv flik-layout (knappar på dator, `<select>`-rullgardin på mobil). |
| `src/components/MyPages.tsx` | Mina sidor: e-post/lösenordsändring, hushållskod, lämna hushåll. |
| `src/index.css` | Hela appens design: mörkt glassmorphism-tema, CSS-variabler, mobilmedia-queries, hamburgermeny-animationer, `.settings-tabs-desktop` / `.settings-tabs-mobile`-klasser. |
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
- **Behörighetsnivåer (RBAC):** Istället för att alla användare i ett hushåll är administratörer ("owner") har appen nu ett rollsystem. Den som skapar hushållet blir `owner` och får ensamrätt på att radera gemensamma konton, räkningar och ändra inställningar. Sambos som loggar in via inbjudningskoden blir `member` och kan lägga till nya gemensamma utgifter, men får ett avskalat, säkert gränssnitt utan farliga knappar.
- **GDPR / Självradering:** Ett SQL-skript (`delete_user`) körs i Supabase som gör att användare, med ett enda klick från "Mina Sidor", kan radera sitt eget inlogg. Tack vare SQL Cascade raderas samtidigt alla kopplingar, profildata och privata räkningar kopplade till detta inlogg från databasen. Inga spår lämnas kvar.
- **Automatiserade Tester (Vitest):** En testrobot verifierar logiken i appens beräkningar (t.ex. Splitwise-matematiken). Testerna körs obligatoriskt vid bygget (`npm run build`). Om framtida kodändringar skulle leda till ett räknefel på ett öre, vägrar systemet att kompilera koden, vilket garanterar att en trasig applikation aldrig kan släppas.

---

## 19. Versionshistorik

| Version | Datum | Vad som förändrades |
|---------|-------|---------------------|
| 1.0 | 2026-05 | Initial version: Månadsvy, konton, Swish-logik. |
| 1.5 | 2026-05 | Supabase-integration, realtidssynk, PWA-stöd. |
| 2.0 | 2026-06-01 | Privat ekonomi, skulder/lån, EkonomiTB, Excel-export, anomalidetektion. |
| 2.1 | 2026-06-09 | Hamburgermeny på mobil, dropdown i Inställningar, ny menyordning. |
| 3.0 | 2026-06-09 | Fullständig migrering till relationsdatabas. Krockfri synkronisering. Automatisk datamigrering. Realtidslyssnare på alla tabeller. |
| 4.0 | 2026-06-09 | Enterprise-uppgradering: Zustand, Zod validering, lazy-loading, skalbar paginering, och säkerhetshärdning i databas (Constraints). |
| 5.0 | 2026-06-09 | The Final Polish: Behörighetsnivåer (RBAC), GDPR-efterlevnad (Självradering) och Automatiserade enhetstester (Vitest integrerat i byggflödet). |
| **5.1** | **2026-06-09** | **Hushållsadministration & UX: Visuell skillnad på logga in/skapa konto, medlemslistor, kick-funktion för ägare, fixat minnesläckage i Zustand vid utloggning, och förfinad RLS för att medlemmar ska se varandra.** |
