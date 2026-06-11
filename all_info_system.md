# Teknisk SystemÃ¶versikt - SmartEkonomi

## 1. Teknisk Stack
*   **Frontend:** React, TypeScript, Vite.
*   **Backend / Databas:** Supabase (PostgreSQL), Supabase Auth.
*   **Serverless / API:** Vercel Serverless Functions (Node.js).
*   **Hosting:** Vercel.
*   **PWA:** `vite-plugin-pwa` med egen `push-sw.js` fÃ¶r Service Worker-hantering.
*   **BetallÃ¶sning:** Stripe Billing.

## 2. Autentisering & BehÃ¶righeter
*   **Inloggning:** E-post och lÃ¶senord via Supabase Auth.
*   **GlÃ¶mt LÃ¶senord:** Inbyggt flÃ¶de med e-postutskick via `supabase.auth.resetPasswordForEmail()`.
*   **AnvÃ¤ndarvillkor & GDPR (ToS):** Vid fÃ¶rsta inloggningen tvingas anvÃ¤ndaren godkÃ¤nna AnvÃ¤ndarvillkor och Integritetspolicy (skrivskyddad modal som blockerar UI:t). GodkÃ¤nnandet sparas permanent som `tos_accepted` i `profiles`-tabellen via kontext (`AuthContext`).
*   **Stale Closure Skydd:** `AuthContext` anvÃ¤nder `useRef` fÃ¶r att fÃ¶rhindra app-lÃ¥sning nÃ¤r PWA vÃ¤cks ur vilolÃ¤ge.
*   **Roller:** `owner` (MedÃ¤gare) och `member` (Medlem - LÃ¥st vy). SÃ¤tts per profil.
*   **Grundarskydd:** Personen med Ã¤ldst `created_at` i ett hushÃ¥ll Ã¤r systemteknisk "Grundare" och kan inte raderas/degraderas av andra owners.
*   **Row Level Security (RLS):** All data filtreras i databasen pÃ¥ inloggad anvÃ¤ndares `household_id`. Profiler skyddas sÃ¥ anvÃ¤ndare endast kan Ã¤ndra egen e-post/lÃ¶senord, samt att `admin_secrets` Ã¤r stÃ¤ngd fÃ¶r alla fÃ¶rutom administratÃ¶ren.
*   **Bypass (RPC):** Databas-funktioner (Remote Procedure Calls) anvÃ¤nds fÃ¶r operationer som mÃ¥ste runda RLS, exempelvis `delete_user`, `set_user_role`, och `toggle_share_private_economy`. Av sÃ¤kerhetsskÃ¤l (fÃ¶r att klara Supabase Linter) har alla RPC-funktioner strypta exekveringsrÃ¤ttigheter (revoked frÃ¥n `PUBLIC` och `anon`) och fastlÃ¥st `search_path`.

## 3. BetalvÃ¤gg & SaaS Infrastruktur
*   **Faktureringsenhet:** Betalning (59 kr/mÃ¥n) hanteras per HushÃ¥ll, inte per anvÃ¤ndare.
*   **Master Switch:** Tabellen `global_settings` styr boolean `paywall_active`. Om aktiverad tvingas obetalande hushÃ¥ll till `<PaywallModal />`.
*   **Prenumerationsinfo:** En detaljerad visuell modal (`SubscriptionFeaturesModal`) nÃ¥s frÃ¥n betalvÃ¤ggen som listar alla premiumfÃ¶rdelar (PWA, Push, EkonomiTB etc.) med ikoner och fÃ¶rklaringar.
*   **VIP-hantering & Admin-Bypass:** SÃ¶kning i Admin-panel sÃ¤tter `stripe_status = 'vip'` i `households` tabellen via RPC. Admin kan hÃ¤mta en komplett lista Ã¶ver alla aktiva VIP-kunder (`get_vip_emails` RPC) och dra in VIP-status per anvÃ¤ndare (`revoke_household_vip_by_email`). AdministratÃ¶rens egen inloggning (`apersson508@gmail.com`) fÃ¶rbigÃ¥r alltid betalvÃ¤ggen internt fÃ¶r att garantera att de inte lÃ¥ser ute sig sjÃ¤lva vid aktivering av Master Switchen.
*   **Admin-statistik:** SystemadministratÃ¶ren ser live hur mÃ¥nga totala medlemmar (profiles) och aktiva betalande hushÃ¥ll/VIPs det finns (via RPC `get_admin_stats`).
*   **Serverless API (Vercel):**
    *   `/api/create-checkout.js`: Skapar en Stripe Checkout Session (hÃ¤mtar Price ID och Secret frÃ¥n Supabase).
    *   `/api/create-portal.js`: Dirigerar aktiv kund till Stripes kundportal fÃ¶r korthantering.
    *   `/api/stripe-webhook.js`: Mottar asynkrona betalningshÃ¤ndelser frÃ¥n Stripe (med signaturvalidering) och uppdaterar `stripe_status` till `active`, `past_due` eller `canceled`.
*   **Dolt Kassavalv:** `admin_secrets` lagrar Stripe-nycklar. LÃ¤ses via `SUPABASE_SERVICE_ROLE_KEY` i backend fÃ¶r att dÃ¶lja miljÃ¶variabler i Vercel.

## 4. Databasmodell (Huvudtabeller)
*   `global_settings`: Systemomfattande flaggor (Master Switch).
*   `admin_secrets`: Krypterade API-nycklar (Strict RLS, endast Ã¥tkomst fÃ¶r grundarens mejl).
*   `households`: Unikt ID (uuid), `name`, `stripe_status`, `stripe_customer_id`.
*   `profiles`: `user_id`, `household_id`, `role`, `share_private_economy`.
*   `accounts`: Gemensamma konton ('shared') eller personer ('person').
*   `bill_definitions`: Mallar fÃ¶r Ã¥terkommande gemensamma rÃ¤kningar. InnehÃ¥ller `isAutoTransfer` (text), `customMonths` (array).
*   `payments`: Instanser av gemensamma rÃ¤kningar kopplade till en specifik mÃ¥nad (`month_id`, ex: "2026-06").
*   `private_bills` & `private_payments`: Separata tabeller fÃ¶r personliga rÃ¤kningar per `user_id`.
*   `household_settings`: Lagrar `reminder_day` (1-31).
*   `push_subscriptions`: JSON-objekt fÃ¶r webblÃ¤sarnas Push API-prenumerationer.

## 5. KÃ¤rnlogik & Vyer
*   **App.tsx (Routing & State):** Hanterar `currentView` och rendering av betalvÃ¤gg/onboarding.
*   **Store (Zustand):** Hanterar lokalt state. Synkroniserar data med Supabase. Alla skrivoperationer Ã¤r skyddade med `navigator.onLine` och `react-hot-toast` fÃ¶r att omedelbart avbryta och varna vid nÃ¤tverksbortfall (Offline-lÃ¤ge). LÃ¶st minneslÃ¤cka vid utloggning (`cleanup`).
*   **Onboarding:** Skapar antingen ett helt nytt hushÃ¥ll och genererar nÃ¶dvÃ¤ndiga `accounts`, *eller* ansluter till ett befintligt hushÃ¥ll via inbjudningskod (HushÃ¥lls-ID).
*   **MÃ¥nadsvy:**
    *   Matematisk berÃ¤kningsmotor som summerar inmatade rÃ¤kningar.
    *   RÃ¤knar ut skuld ("Swish") genom formeln: `(Total delad kostnad / Antal personer) - Vad en enskild person redan betalat`.
*   **Privat Ekonomi:** FristÃ¥ende modul. Kan delas globalt till hela hushÃ¥llet via en toggle i databasen. Har separat tidslinje och rullgardinsmeny fÃ¶r att byta mellan hushÃ¥llsmedlemmars privata vyer.
*   **Statistik & Export (EkonomiTB):** Aggregerar data historiskt. BegrÃ¤nsar initial dataladdning till nuvarande Ã¥r (prestandaoptimering), men inkluderar en "On-Demand"-knapp fÃ¶r att dynamiskt hÃ¤mta in Ã¤ldre Ã¥r. AnvÃ¤nder `exceljs` och `file-saver` fÃ¶r export av formaterade .xlsx-filer. InnehÃ¥ller anomalidetektion (markerar avvikelser > 20% Ã¶ver 6 mÃ¥naders snitt).
*   **LÃ¥sning av MÃ¥nader:** Om en mÃ¥nad Ã¤r markerad som hanterad fryses all data (disabled inputs).
*   **Arkivering:** Arkiverade rÃ¤kningar (`is_archived`) dÃ¶ljs frÃ¥n aktuella inmatningar, men Ã¤r synliga i historiken under fÃ¶rutsÃ¤ttning att beloppet fÃ¶r just den mÃ¥naden var Ã¶ver 0 kr.

## 6. Automatisering & Push-notiser
*   **Web Push (Service Worker):** Appen anvÃ¤nder VAPID-nycklar. En service worker (`push-sw.js`) lyssnar tyst i bakgrunden.
*   **Cron Job (Vercel):** `/api/cron.js` triggas schemalagt via `vercel.json`.
*   **Utskickslogik:**
    *   Hittar hushÃ¥ll dÃ¤r dagens datum = `reminder_day`.
    *   Identifierar mÃ¥l-mÃ¥nad (aktuell mÃ¥nad om datum Ã¤r < 20, nÃ¤stkommande kalendermÃ¥nad om >= 20).
    *   Kontrollerar om mÃ¥naden Ã¤r lÃ¥st i `month_handled_payments`.
    *   Kastar en push-notis med web-push biblioteket till alla enheter i databasen om mÃ¥naden *inte* Ã¤r klar.
    *   StÃ¤dar databasen frÃ¥n dÃ¶da prenumerationer (404/410 status).

## 7. UX & App-Specifikt
*   **Install Prompt:** Egendesignad komponent som avlyssnar `beforeinstallprompt` och bygger en "LÃ¤gg till pÃ¥ hemskÃ¤rmen"-knapp.
*   **Mobilmeny:** CSS-backdrop filter dropdown (`mobile-menu-dropdown`). Hamburgermeny aktiverad vid < 768px.
*   **BekrÃ¤ftelsemodaler:** Glassmorphism-designade `<ConfirmModal />` i React state (ersÃ¤tter `window.confirm`). Placerade via CSS `position: absolute` fÃ¶r mobilkompatibilitet.
*   **Skydd mot oavsiktliga klick:** Ã–verfÃ¶rings/Swish-knappar disable:as permanent (fÃ¶r den aktuella sessionen) direkt efter klick. BehÃ¶ver siduppdatering/state-refresh fÃ¶r att lÃ¥sas upp.
*   **Premium StartskÃ¤rm (Login):** Split-screen layout pÃ¥ desktop med "glassmorphism" paneler. FormulÃ¤ret staplas Ã¶verst pÃ¥ mobila skÃ¤rmar fÃ¶r optimalt flÃ¶de.
*   **CSS:** Vanilla CSS med CSS-variabler fÃ¶r theming, backdrop-filter blur (glassmorphism), och responsiva CSS grids.

## 8. Testning & KvalitetssÃ¤kring (QA)
*   **Enhetstester (Vitest):** Matematikmotorn (`calculateMonth`) Ã¤r bevisat 100% exakt fÃ¶r hantering av "Splitwise"-skulder, gemensamma konton, och autogiro (`store.test.ts`).
*   **Databas/RLS:** FullstÃ¤ndigt validerad via Supabase Linter. RPC-funktioner har sÃ¤kerhetsprÃ¶vad `search_path` och strikt `SECURITY DEFINER` access.
*   **Chaos Monkey (Stress-tester):** Applikationen har utsatts fÃ¶r extrema automatiserade tester (100+ ologiska UI-klick per minut under laddningssekvenser). Testet upptÃ¤ckte och eliminerade en dold React/Zustand render-loop (`Maximum update depth exceeded`) i Onboarding-flÃ¶det. UI-arkitekturen Ã¤r nu bekrÃ¤ftat krasch-fri och skottsÃ¤ker.
*   **FullstÃ¤ndig Testrapport:** Finns i [TEST_RAPPORT.md](TEST_RAPPORT.md).
