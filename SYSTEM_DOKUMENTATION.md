# Ekonomi & Swish - Systemdokumentation

## 1. Vad är Ekonomi & Swish?
Det är en webb-applikation (byggd i React, TypeScript och Vite) som automatiskt räknar ut hur hushållets gemensamma räkningar ska delas. Den eliminerar behovet av miniräknare och kalkylark.
Appen stöder ett obegränsat antal gemensamma konton och personliga konton, och hanterar avancerad Splitwise-matematik i bakgrunden.

---

## 2. Arkitektur & Molnsynk (Supabase)
Från att ha varit en helt lokal app är den nu en **fullskalig molntjänst** uppkopplad mot **Supabase**. All data samlas nu i molnet, oavsett om du kör appen ensam eller delar den med en sambo.

**Hur, Vad och Varför:**
- **Vad:** Så fort du skapar ett konto (t.ex. med e-post och lösenord) skapas automatiskt ett privat "Moln-hushåll" (en unik rad i tabellen `households` på Supabase) dedikerat till din användare. Din `profile` kopplas direkt till detta hushålls-ID.
- **Hur:** Appens `store.ts` läser och skriver automatiskt all data (`state_json`) till detta moln-hushåll via `supabase.channel`. Om du hade sparad lokal data (i `localStorage`) innan du skapade kontot, laddas denna automatiskt upp till ditt nya moln första gången du loggar in.
- **Varför:** Hushålls-konceptet är inte ett krav för att *få* använda appen, utan fungerar som en teknisk behållare för din data i molnet. Genom att alla användare direkt får ett eget moln-hushåll kan man köra appen "solo" med full trygghet i att datan är säkerhetskopierad. Om man senare vill bjuda in en sambo, går man bara in på `👤 Mina sidor` och ger sambon sin Inbjudningskod. När sambon knappar in koden, pekas deras profil om till *ditt* moln-hushåll, och ni är nu synkade!

---

## 3. Mobilapp och PWA (Progressive Web App)

**Hur, Vad och Varför:**
- **Vad:** Appen fungerar precis som en äkta app på mobilen. Man kan ladda ner den till hemskärmen, och den öppnas i fullskärm utan att Chrome/Safari:s adressfält tar plats. Den har också en dynamisk bottenmeny speciellt för mobiler.
- **Hur:** Vi använder `vite-plugin-pwa` i `vite.config.ts` med `devOptions: { enabled: true }` aktiverat för utvecklingsläget. Appen har en `manifest.json` och ikoner i public-mappen. Bottenmenyn styrs via `index.css` med en `@media (max-width: 768px)` regel och `position: fixed`.
- **Varför:** En ekonomiapp används oftast på språng, i mataffären eller hemma i soffan. Att tvingas ha en klumpig webbläsare öppen drar ner upplevelsen. PWA-tekniken ger en premiumkänsla, och bottenmenyn säkerställer att navigationen alltid finns nära tummen.

---

## 4. Supabase & Row-Level Security (RLS)

**Hur, Vad och Varför:**
- **Vad:** Appen använder en avancerad säkerhetsmodell där användare bara kan läsa och skriva data som tillhör deras eget "hushåll".
- **Hur:** Databasen (PostgreSQL) körs på Supabase. Tabellerna `households` och `profiles` skyddas med `Row Level Security` (RLS). Ett problem med `INSERT` löstes genom att generera unika Hushålls-ID:n (UUID) via `crypto.randomUUID()` direkt i webbläsaren *innan* de skickas till Supabase, vilket förhindrar en krock mellan `INSERT` och `SELECT` reglerna i Supabase under registreringen.
- **Varför:** Om man loggar in med sin e-post vill man inte riskera att någon annan användare kan se ens privata utgifter. RLS är en försäkring på databasnivå, vilket betyder att även om någon skulle försöka manipulera koden, vägrar databasen att släppa ifrån sig datan.

---

## 5. Delning & "Mina Sidor"

**Hur, Vad och Varför:**
- **Vad:** En hubb där man hanterar sitt konto: Byta mejl, byta lösenord, och framförallt – bjuda in andra.
- **Hur:** `MyPages.tsx` pratar med `supabase.auth` för kontohantering. Om man vill bjuda in en sambo kopierar man sitt Hushålls-ID. Sambon skapar ett konto och klistrar in koden, varpå deras `profile` uppdateras till att peka på samma Hushålls-ID.
- **Varför:** Vi vill undvika komplicerade inbjudningslänkar via e-post. En copy-paste-kod är idiotsäkert och kräver inget avancerat mejlutskick-system.

---

## 6. Uträkningar (Splitwise-logik)

**Hur, Vad och Varför:**
- **Vad:** Appen räknar automatiskt ut vem som ska betala vem, så att det blir rättvist oavsett hur många konton eller personer som är inblandade.
- **Hur:** All matematik sker i `calculateMonth()` inuti `store.ts`. Systemet identifierar vilka utgifter som är knutna till gemensamma konton och vilka som är knutna till personliga konton. Om differensen är negativ skapas en "Swish-rekommendation".
- **Varför:** Detta är kärnan i hela appen! Det eliminerar allt behov av excel-ark eller manuella miniräknare vid köksbordet. Oavsett om sambon tog elräkningen och du tog hyran, fixar appen nettobeloppet på en bråkdel av en sekund.

---

## 7. Typning & Vercel (Lansering)

**Hur, Vad och Varför:**
- **Vad:** Hela kodbasen är "Strictly Typed" via TypeScript för att kunna byggas felfritt och lanseras publikt via Vercel.
- **Hur:** Vi har rensat bort alla oanvända variabler och imports (`import React`) för att `tsc -b` ska kompilera med 0 varningar. Vi använder globala interface för `AppState`, `BillDefinition`, `Account` i filen `types.ts`.
- **Varför:** Tjänster som Vercel är stenhårda; minsta lilla slarv (en variabel som skapas men inte används) stoppar hela bygget. Genom att ha extremt hög kodkvalitet säkerställer vi att appen är blixtsnabb, buggfri och framtidssäker när den väl är publicerad.

---

## 8. Flexibilitet & "Allmänna Inställningar"
Appen är byggd för att vara helt dynamisk och oberoende av vilka personer som använder den.
- **Valbar Sammanställning:** I `⚙️ Inställningar -> Allmänt` kan man kryssa ur "Visa sammanställning". Då fungerar appen som en renodlad utgiftskoll, utan att räkna ut Swish-krav eller överföringar.
- **Dynamiska konton:** Man kan radera gemensamma konton helt och bara ha personliga (vilket ger renodlade Swish-uträkningar) eller bara ha gemensamma. All matematik i `calculateMonth()` anpassar sig i realtid.

---

## 9. Säkerhetslås (Kontolås)
Eftersom matten bygger på gemensamma överföringar fryser appen datan när man betalat.
- När man klickar "✅ Markera som överfört", låses relaterade konton med en `🔒`-ikon.
- Det går inte att råka ändra siffrorna i efterhand om man inte manuellt går in i `⚙️ Inställningar -> 🔒 Lås upp` och låser upp den specifika månaden.

---

## 10. AI-driven Felskrivningskontroll
För att skydda mot "Fat fingers" (skriva in fel siffra):
- Systemet tittar på historiken. Om en ny siffra är 50% lägre än det historiska minimumet, eller 50% högre än det historiska maximumet (på räkningar äldre än 3 månader), triggas ett larm.
- Rutan blir röd och man måste antingen trycka `↩️ Ångra` eller bekräfta att avvikelsen är korrekt (`✅ OK`).

---

## 11. Analys och Backup
- **EkonomiTB:** Tidslinjer och grafer ritade med `recharts` över hur kostnaderna förändrats. Innehåller detaljerade tabeller över månad-till-månad-förändringar.
- **Excel-Export:** Möjlighet att exportera hela sitt liv till en .xlsx fil, med flikar för räkningar (pivot-vy) och överföringar.

---

## 12. "Lämna hushåll" & Självläkande profiler (Upsert)
- På `Mina sidor` finns knappen **"🚪 Lämna och skapa eget hushåll"**. Denna kör funktionen `handleCreateHousehold()` på nytt, vilket bryter bandet till det gamla Hushålls-ID:t och genererar ett helt nytt, privat UUID för användaren. Resultatet blir en helt ny, blank Ekonomi-app.
- Vid registrering, skapande av nytt hushåll, eller när man går med via Inbjudningskod, används en Supabase `upsert` (Update/Insert) på användarens `profile`. Detta garanterar att profilen och Hushålls-ID:t sparas korrekt även om triggers/RLS i databasen tidigare fallerat.

---

## 13. Struktur och Filer
- `src/supabase.ts` & `src/AuthContext.tsx`: Sköter kommunikationen med databasen, registrering, inloggning och sessioner.
- `src/types.ts`: All datastruktur (inkl. `settings` för UI).
- `src/store.ts`: Hjärnan. Sköter den komplicerade matematiken (`calculateMonth`), lagring, molnsynkroniseringen (`useStore`) och innehåller den helt "blanka" startmallen för nya hushåll.
- `src/App.tsx`: Huvudfilen som styr navigering.
- `src/components/MyPages.tsx`: Hantering av Hushåll, utloggning, inbjudningskoder och "Lämna hushåll".
- `src/components/MonthView.tsx`: Huvudvyn där siffrorna knappas in.
- `src/components/Summary.tsx`: Rutan i botten/toppen med Swish och överföringar.
- `src/components/ManageBills.tsx`: Inställningspanelen (inkl. Allmänt-fliken).
- `src/index.css`: Hela appens design, media queries (Mobile First) och mörka glassmorphism-tema med solida mobilmenyer.
