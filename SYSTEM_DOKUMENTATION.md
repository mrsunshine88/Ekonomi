# Ekonomi & Swish - Systemdokumentation

**Version:** 2.0 (Lån, Skulder & Privat Ekonomi)  
**Plattform:** React + TypeScript + Vite (PWA) | Databas: Supabase | Hosting: Vercel  
**Uppdaterad:** 2026-06-09

---

## 1. Vad är Ekonomi & Swish?

Det är en webb-applikation (byggd i React, TypeScript och Vite) som automatiskt räknar ut hur hushållets gemensamma räkningar ska delas. Den eliminerar behovet av miniräknare och kalkylark.

Appen stöder ett obegränsat antal gemensamma konton och personliga konton, och hanterar avancerad Splitwise-matematik i bakgrunden.

**Appens fyra huvudvyer:**
- `📅 Månadsvy` – Gemensamma räkningar, mata in belopp, markera som överförda.
- `📊 EkonomiTB` – Historisk statistik, grafer, skuld-avbetalningskontroll.
- `⚙️ Inställningar` – Hantera räkningar, konton, lås och allmänna inställningar.
- `🔒 Privat` – Personliga utgifter och privata lån, synliga enbart för dig.
- `👤 Mina sidor` – Kontoinformation, hushållskod och lämna-hushåll.

---

## 2. Arkitektur & Molnsynk (Supabase)

**Vad:** Appen är en fullskalig molntjänst. All data lagras i Supabase (PostgreSQL), och är alltid åtkomlig från vilken enhet som helst.

**Hur:** 
- `src/store.ts` → `useStore(householdId)` hanterar all läsning och skrivning.
- Vid start läses `state_json` (en enda JSON-kolumn i tabellen `households`) in från Supabase.
- Alla ändringar sparas debounced (500ms) tillbaka till Supabase via `supabase.from('households').update(...)`.
- Realtidssynk sker via `supabase.channel('household_X').on('postgres_changes', ...)` – om din sambo ändrar något på sin telefon, uppdateras din skärm *direkt* utan att du behöver ladda om.
- Som fallback sparas all data även lokalt i `localStorage` under nyckeln `ekonomiapp_state_v1`, så appen fungerar offline.
- **Viktigt:** Vid inläsning från `localStorage` bevaras *alla* fält i `state_json` (inkl. `privateBills` och `privateMonths`) via `{ ...parsed, accounts: migratedAccounts, ... }`, så att privata data inte raderas vid sidomladdning.

**Varför:** Hushålls-konceptet är inte ett krav för att *få* använda appen, utan fungerar som en teknisk behållare för din data i molnet. Alla användare får automatiskt ett eget moln-hushåll, vilket innebär att man kan köra appen solo och sedan bjuda in sin sambo när som helst.

---

## 3. Mobilapp och PWA (Progressive Web App)

**Vad:** Appen fungerar precis som en äkta app på mobilen. Man kan ladda ner den till hemskärmen och öppnar i fullskärm utan adressfält.

**Hur:** `vite-plugin-pwa` i `vite.config.ts` genererar en Service Worker (`sw.js`) och en `manifest.webmanifest`. Bottenmenyn (`position: fixed; bottom: 0`) visas enbart på skärmar ≤768px via `@media (max-width: 768px)` i `index.css`. Menyn är helt solid och opak (bakgrundsfärg `#0d0d1a`) för att vara läsbar.

**Varför:** En ekonomiapp används mest på språng. PWA-tekniken ger en premiumkänsla och bottenmenyn placerar navigationen nära tummen.

---

## 4. Supabase & Row-Level Security (RLS)

**Vad:** Användare kan bara läsa och skriva data som tillhör deras eget hushåll – säkrat på databasnivå.

**Hur:** 
- Tabellerna `households` och `profiles` i Supabase har RLS aktiverat.
- Hushålls-ID (UUID) genereras via `crypto.randomUUID()` direkt i webbläsaren *innan* de skickas till Supabase (i `AuthContext.tsx`).
- Registrering och hushållsskapande använder `upsert` (Update/Insert) för att vara idempotent – kan köras om utan att skapa dubbletter.
- Privata räkningar skyddas dessutom i klientkoden via `userId`-filtrering: `privateBills.filter(b => b.userId === user.id)`.

**Varför:** Även om klientkoden manipuleras vägrar databasen att släppa ifrån sig data som inte tillhör den inloggade användaren.

---

## 5. Delning & "Mina Sidor"

**Vad:** En hubb för kontoinformation och hushållshantering.

**Hur:** 
- `src/components/MyPages.tsx` pratar med `supabase.auth` för e-post/lösenordsbyte.
- Inbjudningskoden = hushållets UUID. Sambon klistrar in den och deras `profile.household_id` uppdateras via `upsert`.
- Knappen **"🚪 Lämna och skapa eget hushåll"** kör `handleCreateHousehold()` på nytt: genererar ett nytt UUID, skapar ett nytt hushåll och pekar om profilen. Resultatet är en helt tom, ny ekonomiapp.

**Varför:** Ingen komplicerad e-postlänkhantering krävs. En copy-paste-kod är idiotsäkert.

---

## 6. Uträkningar (Splitwise-logik)

**Vad:** Appen räknar automatiskt ut exakt vem som ska betala vem, oavsett hur komplexa konstellationen av räkningar och konton är.

**Hur:** All matematik sker i `calculateMonth(state, monthId)` i `src/store.ts`:
1. Systemet identifierar `sharedAccounts` och `personAccounts`.
2. För varje räkning beräknas "skulder" (`liabilities`) per person baserat på `splitType` (`equal` = lika på alla, specifikt `accountId` = 100% för en person).
3. Balanserna räknas ihop i ett `balances`-objekt.
4. En Splitwise-algoritm (Debt Simplification) minimerar antalet transaktioner och skapar `SwishTransfer[]`.

**Varför:** Kärnan i hela appen. Eliminerar allt behov av excel-ark. Oavsett om sambon tog elräkningen och du tog hyran, fixar appen nettobeloppet på en bråkdel av en sekund.

---

## 7. Månadsvy (Gemensamma räkningar)

**Vad:** Huvudvyn där man varje månad fyller i belopp på sina räkningar och markerar betalningar som genomförda.

**Hur:** `src/components/MonthView.tsx`:
- Navigerar mellan månader via `← Föregående` / `Nästa →` pilar (format: `YYYY-MM`).
- Visar bara räkningar som ska betalas just den månaden (baserat på `interval`).
- Belopp sparas i `state.months[monthId].billAmounts[billId]`.
- Knappen "Hämta siffror från förra månaden" (`copyFromPreviousMonth`) kopierar belopp för alla olåsta räkningar från föregående månads data.
- "✅ Markera som överfört"-knappar triggar `togglePaymentStatus()` i store, vilket sätter `handledPayments[paymentId] = true` och låser kontot.

**Varför:** Varje månad är unik (elräkningar varierar, hyra är fast). Att kunna kopiera förra månaden sparar tid.

---

## 8. Flexibilitet & "Allmänna Inställningar"

**Vad:** Appen är helt dynamisk och oberoende av vilka personer som använder den.

**Hur:** I `⚙️ Inställningar → Allmänt` kan man:
- Kryssa ur "Visa sammanställning" → döljer Swish- och Överföringsrutorna. Appen fungerar då som en renodlad utgiftskoll.
- Dynamiska konton: Inga hårdkodade namn. Man kan radera, lägga till och byta namn på konton fritt. All matematik anpassar sig i realtid.

**Varför:** Appen ska fungera för alla – ensamstående, par, kompisar som delar lägenhet, med eller utan gemensamma konton.

---

## 9. Räkningar & Intervall

**Vad:** Varje räkning kan ha ett eget betalningsintervall – varje månad, varannan månad eller specifika månader per år.

**Hur:** `BillDefinition` och `PrivateBill` har fältet `interval: PaymentInterval` ('all' | 'odd' | 'even' | 'custom'). Vid `custom` lagras en array `customMonths: number[]` (1–12). I vyn filtreras räkningarna via en intervallfunktion som kontrollerar om aktuell månads nummer matchar inställningen.

**Varför:** Verkliga räkningar betalas inte alltid varje månad. El- och vattenräkningar kan komma varannan månad. Hushållsavgifter kan komma bara på sommaren.

---

## 10. Privat Ekonomi (Helt separerad från Swish-logik)

**Vad:** En egen flik (`🔒 Privat`) där varje användare hanterar sina egna, privata utgifter som aldrig påverkar den gemensamma uträkningen.

**Hur:** 
- `state_json` innehåller `privateBills: PrivateBill[]` och `privateMonths: Record<string, PrivateMonthData>`.
- Privata räkningar skapas på *samma* ställe som gemensamma (`⚙️ Inställningar → Räkningar`), men med växeln "🔒 Privat Räkning" istället för "Gemensam Räkning".
- Varje privat räkning stämplas med `userId: user.id` (inloggad användares UUID).
- `PrivateView.tsx` visar bara räkningar där `bill.userId === user.id`.
- En räkning kan markeras som delad (`isShared: true`), varpå den visas som "read-only" hos övriga hushållsmedlemmar under "Delade utgifter".
- I den privata vyn finns en grön **"✅ Markera månad som klar"**-knapp som sätter `privateMonths[monthId].isLocked = true`. Denna stänger månaden och förhindrar vidare redigering.
- Upplåsning sker via `⚙️ Inställningar → 🔒 Lås upp → "Mina Privata Lås"`.

**Varför:** Hushållsmedlemmar vill ha en komplett bild av *all* sin ekonomi på ett ställe. Privata kostnader ska *aldrig* räknas in i den gemensamma Swish-uppgörelsen.

---

## 11. Skulder & Lånespårning (Avbetalningskontroll)

**Vad:** Möjlighet att markera en räkning (privat eller gemensam) som ett lån/skuld med en ursprunglig totalsumma. EkonomiTB visar sedan en visuell progress-bar som krymper varje gång en månad låses.

**Hur:**
- `BillDefinition` och `PrivateBill` har de nya (valfria) fälten `isLoan?: boolean` och `totalDebt?: number`.
- I `⚙️ Inställningar → Räkningar` finns kryssrutan **"💳 Detta är en skuld/ett lån som ska betalas av över tid"**. När den kryssas i visas ett fält för ursprunglig skuldsumma.
- I `EkonomiTB` beräknas `paidSoFar` dynamiskt: för varje låst månad (`isLocked = true` för privata, eller `handledPayments` för gemensamma) summeras det inmatade beloppet för den räkningen.
- Formeln: `remaining = max(0, totalDebt - paidSoFar)`, `progress = min(100, paidSoFar / totalDebt * 100)`.
- Progress-baren visas i en ny sektion "💳 Skulder & Lån" högst upp i EkonomiTB (syns i både Gemensam och Privat vy beroende på vilken flik man är på).
- När `progress >= 100` visas "🎉 Fullt betald!" med grön färg.

**Varför:** Det är mycket motiverande att visuellt se hur ett lån krymper. Istället för att räkna manuellt vet man alltid exakt hur mycket som är kvar att betala.

---

## 12. Säkerhetslås (Kontolås)

**Vad:** När en betalning är genomförd fryses siffrorna för att förhindra oavsiktliga ändringar.

**Hur:**
- **Gemensam Månadsvy:** Knappen "✅ Markera som överfört" sätter `handledPayments[paymentId] = true`. Fält kopplade till det kontot blir `disabled`. En `🔒`-ikon visas.
- **Privat Vy:** Knappen "✅ Markera månad som klar" sätter `privateMonths[monthId].isLocked = true`. Alla inmatningsfält i vyn låses och ett informationsmeddelande visas.
- **Upplåsning:** Sker via `⚙️ Inställningar → 🔒 Lås upp`. Fliken är uppdelad i två kolumner:
  - **Gemensam Månadsvy** – Lista per månad med konto-namn och "🔓 Lås upp"-knapp.
  - **Mina Privata Lås** – Lista per månad med "🔓 Lås upp"-knapp.

**Varför:** Pengar är redan överförda – det ska inte gå att råka ändra siffran efteråt och förstöra uträkningen för hela månaden.

---

## 13. AI-driven Felskrivningskontroll (Anomalidetektion)

**Vad:** Skyddar mot "fat-fingers" – att råka skriva in fel belopp.

**Hur:**
- Systemet håller koll på de senaste 3+ månadernas historik per räkning.
- Om ett nytt belopp avviker mer än **50% från det historiska minimumet** (för lågt) eller **50% från det historiska maximumet** (för högt) triggas ett larm.
- Fältet markeras rött och en dialogruta visas: **"↩️ Ångra"** (återställer till förra värdet) eller **"✅ OK"** (bekräftar att avvikelsen är korrekt, sparas i `confirmedAnomalies`).
- Fungerar identiskt i båda vyerna (gemensam och privat) via samma logik.
- Anomalier som bekräftats med "OK" räknas inte längre som avvikelser för just det beloppet.

**Varför:** En etta för mycket på slutet (1000 kr → 10 000 kr) kan förstöra hela månadskalkylen. Systemet agerar som en smart säkerhetsventil.

---

## 14. Analys & EkonomiTB (Statistik)

**Vad:** Historisk data visualiserad med interaktiva grafer och tabeller.

**Hur:** `src/components/Statistics.tsx`:
- **Gemensam Statistik:** Visar gemensamma kostnader per konto, Huskonto-summor, Swish-historik, och "Största förändringarna" (movers) mellan månader.
- **Privat Statistik:** Filtrerar på `bill.userId === user.id` och visar *enbart* dina egna privata utgifter i alla grafer och tabeller.
- **Skulder & Lån:** Ny sektion (se kapitel 11) med progress-bars, visas i rätt flik beroende på om lånet är privat eller gemensamt.
- **Excel-Export:** Knappen "💾 Ladda ner Excel" genererar en `.xlsx`-fil (via biblioteket `xlsx`) med **tre flikar**:
  1. `Gemensamma Räkningar` – Pivot-tabell per räkning och månad.
  2. `Swish & Överföringar` – Historik för alla Swish-rekommendationer.
  3. `Mina Privata Räkningar` – Enbart inloggad användares privata data.

**Varför:** Att se sin ekonomi som grafer och tabeller ger en känsla av kontroll. Utan historik vet man inte om kostnaderna ökar eller minskar. Excel-exporten är en säkerhetskopia och möjliggör avancerad analys utanför appen.

---

## 15. "Lämna hushåll" & Självläkande profiler (Upsert)

**Vad:** En säkerhetsventil om man råkat hamna i fel hushåll, eller vill börja om.

**Hur:**
- Knappen **"🚪 Lämna och skapa eget hushåll"** på `Mina sidor` kör `handleCreateHousehold()` på nytt.
- Skapar ett nytt UUID, ett nytt hushåll i Supabase, och uppdaterar `profile.household_id` via `upsert`.
- All data i det *gamla* hushållet är orörd (andra hushållsmedlemmar påverkas inte).
- Vid alla hushållsoperationer används `upsert` istället för `insert` – idempotent, förhindrar dubbletter.

**Varför:** Det ska alltid gå att ångra. Om man råkat gå med i fel hushåll via en felaktig kod ska man enkelt kunna lämna och starta om.

---

## 16. Struktur och Filer

| Fil | Ansvar |
|-----|--------|
| `src/supabase.ts` | Supabase-klient och anslutningskonfiguration. |
| `src/AuthContext.tsx` | Autentisering, registrering, sessionshantering, hushållsskapande. |
| `src/types.ts` | All datastruktur: `AppState`, `BillDefinition` (inkl. `isLoan`, `totalDebt`), `PrivateBill`, `PrivateMonthData`, `MonthData`, `Account`, `SwishTransfer`, `CalculationResult`. |
| `src/store.ts` | Appens hjärna: `useStore()` (state + synk), `calculateMonth()` (Splitwise-matematik), alla CRUD-operationer för gemensamma och privata räkningar, låslogik. |
| `src/App.tsx` | Rotkomponent, routing mellan vyer (bottenmeny + desktop-tabs), kopplar alla store-actions till UI. |
| `src/excel.ts` | Genererar Excel-filen med tre flikar via `xlsx`-biblioteket. |
| `src/components/MonthView.tsx` | Gemensam månadsvy: inmatning, kopiera förra månaden, betalningsmarkering. |
| `src/components/PrivateView.tsx` | Privat vy: filtrerar `privateBills` på `userId`, inmatning, låsning av privata månader. |
| `src/components/Summary.tsx` | Sammanfattningsrutan med Swish- och Överföringsrekommendationer. |
| `src/components/Statistics.tsx` | EkonomiTB: grafer (recharts), skuld-progress-bars, Excel-knapp, Gemensam/Privat-växel. |
| `src/components/ManageBills.tsx` | Inställningspanelen: Räkningar (inkl. Lån-kryssruta), Konton, Lås upp (uppdelat Gemensam/Privat), Allmänt. |
| `src/components/MyPages.tsx` | Mina sidor: e-post/lösenordsändring, hushållskod, lämna hushåll. |
| `src/index.css` | Hela appens design: mörkt glassmorphism-tema, CSS-variabler, mobilmedia-queries, solid bottenmeny. |
| `vite.config.ts` | Vite + PWA-konfiguration (Service Worker, manifest). |
| `SYSTEM_DOKUMENTATION.md` | Denna fil. Fullständig teknisk och funktionell dokumentation av hela systemet. |
