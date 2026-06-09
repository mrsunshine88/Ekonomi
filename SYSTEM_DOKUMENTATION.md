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
Appen är fullt anpassad för mobila enheter (Mobile First) och fungerar som en äkta app.
- **Ladda ner som App:** Appen använder `vite-plugin-pwa`. När man surfar in på sidan via mobilen (iOS/Android) får man valet att "Lägga till på hemskärmen". Den får då en app-ikon och startar i fullskärm (helt utan Safari/Chrome-adressfält).
- **Botten-meny:** På mobila enheter flyttas toppmenyn ner till botten av skärmen för att vara lättare att nå med tummen.
- **Smarta Tillbaka-knappar:** När appen körs i fullskärm på mobilen försvinner webbläsarens egna "bakåt"-knapp. Appen har därför egna "← Tillbaka till Månadsvy"-knappar inbyggda överallt i Inställningar och Mina sidor.

---

## 4. Dynamiska Konton & Räkningar
Du kan skapa hur många konton du vill under Inställningar. De delas in i två typer:
1. **Gemensamt konto (Shared):** T.ex. Huskonto, Matkonto. Hit samlas pengar. Ingen "swishar" hit, man "för över".
2. **Personligt konto (Person):** T.ex. Andreas, Helena. Hit kan man Swisha om en person har lagt ut mer pengar än en annan.

### Smarta Intervaller & Varningar
Räkningar kan ha smarta intervall (Månadsvis, Jämna/Udda, eller Valfria kryssrutor för specifika månader, t.ex. bara Mars och Augusti). 
Om en räkning ska betalas men står på `0 kr`, lyser rutan rött och appen **spärrar överföringsknapparna**.

---

## 5. Säkerhetslås (Kontolås)
Eftersom matten bygger på gemensamma överföringar fryser appen datan när man betalat.
- När man klickar "✅ Markera som överfört", låses relaterade konton med en `🔒`-ikon.
- Det går inte att råka ändra siffrorna i efterhand om man inte manuellt går in i `⚙️ Inställningar -> 🔒 Lås upp` och låser upp den specifika månaden.

---

## 6. AI-driven Felskrivningskontroll
För att skydda mot "Fat fingers" (skriva in fel siffra):
- Systemet tittar på historiken. Om en ny siffra är 50% lägre än det historiska minimumet, eller 50% högre än det historiska maximumet (på räkningar äldre än 3 månader), triggas ett larm.
- Rutan blir röd och man måste antingen trycka `↩️ Ångra` eller bekräfta att avvikelsen är korrekt (`✅ OK`).

---

## 7. Uträkningsmotorn (Splitwise-algoritmen)
Appens hjärna ligger i `src/store.ts` (`calculateMonth`).
1. **Liabilities:** Delar upp räkningens kostnad på de som är kopplade till den.
2. **Krediter:** Den som "lägger ut" pengar från sitt personliga konto får pluspoäng.
3. **Gemensamma Skulder:** Skulder till gemensamma konton sorteras in i olika högar ("Överför till Huskonto", "Överför till Matkonto" etc).
4. **Netto-balans & Swish:** Personernas personliga plus och minus slås ihop, och motorn skapar den mest effektiva Swish-uträkningen mellan parterna.

---

## 8. Analys och Backup
- **EkonomiTB:** Tidslinjer och grafer ritade med `recharts` över hur kostnaderna förändrats. Innehåller detaljerade tabeller över månad-till-månad-förändringar.
- **Excel-Export:** Möjlighet att exportera hela sitt liv till en .xlsx fil, med flikar för räkningar (pivot-vy) och överföringar.

---

## 9. Struktur och Filer
- `src/supabase.ts` & `src/AuthContext.tsx`: Sköter kommunikationen med databasen, registrering, inloggning och sessioner.
- `src/types.ts`: All datastruktur.
- `src/store.ts`: Hjärnan. Sköter den komplicerade matematiken (`calculateMonth`), lagring och molnsynkroniseringen (`useStore`).
- `src/App.tsx`: Huvudfilen som styr navigering (Botten-menyn).
- `src/components/MyPages.tsx`: Hantering av Hushåll, utloggning och inbjudningskoder.
- `src/components/MonthView.tsx`: Huvudvyn där siffrorna knappas in.
- `src/components/Summary.tsx`: Rutan i botten med Swish och överföringar.
- `src/components/ManageBills.tsx`: Inställningspanelen.
- `src/index.css`: Hela appens design, media queries (Mobile First) och mörka glassmorphism-tema.
