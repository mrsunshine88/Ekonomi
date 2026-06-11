# Teknisk Systemöversikt - Ekonomi & Swish

## 1. Teknisk Stack
*   **Frontend:** React, TypeScript, Vite.
*   **Backend / Databas:** Supabase (PostgreSQL), Supabase Auth.
*   **Serverless / API:** Vercel Serverless Functions (Node.js).
*   **Hosting:** Vercel.
*   **PWA:** `vite-plugin-pwa` med egen `push-sw.js` för Service Worker-hantering.
*   **Betallösning:** Stripe Billing.

## 2. Autentisering & Behörigheter
*   **Inloggning:** E-post och lösenord via Supabase Auth.
*   **Glömt Lösenord:** Inbyggt flöde med e-postutskick via `supabase.auth.resetPasswordForEmail()`.
*   **Användarvillkor & GDPR (ToS):** Vid första inloggningen tvingas användaren godkänna Användarvillkor och Integritetspolicy (skrivskyddad modal som blockerar UI:t). Godkännandet sparas permanent som `tos_accepted` i `profiles`-tabellen via kontext (`AuthContext`).
*   **Stale Closure Skydd:** `AuthContext` använder `useRef` för att förhindra app-låsning när PWA väcks ur viloläge.
*   **Roller:** `owner` (Medägare) och `member` (Medlem - Låst vy). Sätts per profil.
*   **Grundarskydd:** Personen med äldst `created_at` i ett hushåll är systemteknisk "Grundare" och kan inte raderas/degraderas av andra owners.
*   **Row Level Security (RLS):** All data filtreras i databasen på inloggad användares `household_id`. Profiler skyddas så användare endast kan ändra egen e-post/lösenord, samt att `admin_secrets` är stängd för alla förutom administratören.
*   **Bypass (RPC):** Databas-funktioner (Remote Procedure Calls) används för operationer som måste runda RLS, exempelvis `delete_user`, `set_user_role`, och `toggle_share_private_economy`.

## 3. Betalvägg & SaaS Infrastruktur
*   **Faktureringsenhet:** Betalning (59 kr/mån) hanteras per Hushåll, inte per användare.
*   **Master Switch:** Tabellen `global_settings` styr boolean `paywall_active`. Om aktiverad tvingas obetalande hushåll till `<PaywallModal />`.
*   **Prenumerationsinfo:** En detaljerad visuell modal (`SubscriptionFeaturesModal`) nås från betalväggen som listar alla premiumfördelar (PWA, Push, EkonomiTB etc.) med ikoner och förklaringar.
*   **VIP-hantering & Admin-Bypass:** Sökning i Admin-panel sätter `stripe_status = 'vip'` i `households` tabellen via RPC. Admin kan hämta en komplett lista över alla aktiva VIP-kunder (`get_vip_emails` RPC) och dra in VIP-status per användare (`revoke_household_vip_by_email`). Administratörens egen inloggning (`apersson508@gmail.com`) förbigår alltid betalväggen internt för att garantera att de inte låser ute sig själva vid aktivering av Master Switchen.
*   **Admin-statistik:** Systemadministratören ser live hur många totala medlemmar (profiles) och aktiva betalande hushåll/VIPs det finns (via RPC `get_admin_stats`).
*   **Serverless API (Vercel):**
    *   `/api/create-checkout.js`: Skapar en Stripe Checkout Session (hämtar Price ID och Secret från Supabase).
    *   `/api/create-portal.js`: Dirigerar aktiv kund till Stripes kundportal för korthantering.
    *   `/api/stripe-webhook.js`: Mottar asynkrona betalningshändelser från Stripe (med signaturvalidering) och uppdaterar `stripe_status` till `active`, `past_due` eller `canceled`.
*   **Dolt Kassavalv:** `admin_secrets` lagrar Stripe-nycklar. Läses via `SUPABASE_SERVICE_ROLE_KEY` i backend för att dölja miljövariabler i Vercel.

## 4. Databasmodell (Huvudtabeller)
*   `global_settings`: Systemomfattande flaggor (Master Switch).
*   `admin_secrets`: Krypterade API-nycklar (Strict RLS, endast åtkomst för grundarens mejl).
*   `households`: Unikt ID (uuid), `name`, `stripe_status`, `stripe_customer_id`.
*   `profiles`: `user_id`, `household_id`, `role`, `share_private_economy`.
*   `accounts`: Gemensamma konton ('shared') eller personer ('person').
*   `bill_definitions`: Mallar för återkommande gemensamma räkningar. Innehåller `isAutoTransfer` (text), `customMonths` (array).
*   `payments`: Instanser av gemensamma räkningar kopplade till en specifik månad (`month_id`, ex: "2026-06").
*   `private_bills` & `private_payments`: Separata tabeller för personliga räkningar per `user_id`.
*   `household_settings`: Lagrar `reminder_day` (1-31).
*   `push_subscriptions`: JSON-objekt för webbläsarnas Push API-prenumerationer.

## 5. Kärnlogik & Vyer
*   **App.tsx (Routing & State):** Hanterar `currentView` och rendering av betalvägg/onboarding.
*   **Store (Zustand):** Hanterar lokalt state. Synkroniserar data med Supabase och hanterar offline/online-cache. Löst minnesläcka vid utloggning (`cleanup`).
*   **Onboarding:** Skapar antingen ett helt nytt hushåll och genererar nödvändiga `accounts`, *eller* ansluter till ett befintligt hushåll via inbjudningskod (Hushålls-ID).
*   **Månadsvy:**
    *   Matematisk beräkningsmotor som summerar inmatade räkningar.
    *   Räknar ut skuld ("Swish") genom formeln: `(Total delad kostnad / Antal personer) - Vad en enskild person redan betalat`.
*   **Privat Ekonomi:** Fristående modul. Kan delas globalt till hela hushållet via en toggle i databasen. Har separat tidslinje och rullgardinsmeny för att byta mellan hushållsmedlemmars privata vyer.
*   **Statistik & Export (EkonomiTB):** Aggregerar data historiskt. Använder `exceljs` och `file-saver` för export av formaterade .xlsx-filer. Innehåller anomalidetektion (markerar avvikelser > 20% över 6 månaders snitt).
*   **Låsning av Månader:** Om en månad är markerad som hanterad fryses all data (disabled inputs).
*   **Arkivering:** Arkiverade räkningar (`is_archived`) döljs från aktuella inmatningar, men är synliga i historiken under förutsättning att beloppet för just den månaden var över 0 kr.

## 6. Automatisering & Push-notiser
*   **Web Push (Service Worker):** Appen använder VAPID-nycklar. En service worker (`push-sw.js`) lyssnar tyst i bakgrunden.
*   **Cron Job (Vercel):** `/api/cron.js` triggas schemalagt via `vercel.json`.
*   **Utskickslogik:**
    *   Hittar hushåll där dagens datum = `reminder_day`.
    *   Identifierar mål-månad (aktuell månad om datum är < 20, nästkommande kalendermånad om >= 20).
    *   Kontrollerar om månaden är låst i `month_handled_payments`.
    *   Kastar en push-notis med web-push biblioteket till alla enheter i databasen om månaden *inte* är klar.
    *   Städar databasen från döda prenumerationer (404/410 status).

## 7. UX & App-Specifikt
*   **Install Prompt:** Egendesignad komponent som avlyssnar `beforeinstallprompt` och bygger en "Lägg till på hemskärmen"-knapp.
*   **Mobilmeny:** CSS-backdrop filter dropdown (`mobile-menu-dropdown`). Hamburgermeny aktiverad vid < 768px.
*   **Bekräftelsemodaler:** Glassmorphism-designade `<ConfirmModal />` i React state (ersätter `window.confirm`). Placerade via CSS `position: absolute` för mobilkompatibilitet.
*   **Skydd mot oavsiktliga klick:** Överförings/Swish-knappar disable:as permanent (för den aktuella sessionen) direkt efter klick. Behöver siduppdatering/state-refresh för att låsas upp.
*   **CSS:** Vanilla CSS med CSS-variabler för theming, backdrop-filter blur (glassmorphism), och responsiva CSS grids.
