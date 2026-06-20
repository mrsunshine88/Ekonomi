import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Ladda env från root (för lokal testning)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Helst ska detta köras med SERVICE_ROLE_KEY i CI/CD, men vi faller tillbaka på ANON för lokalt
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Saknar Supabase miljövariabler.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runHealthCheck() {
  console.log("🔍 Kör Database Health Check (GDPR Constraint Enforcement)...");

  try {
    const { data, error } = await supabase.rpc('check_gdpr_cascades');

    if (error) {
      console.error("❌ Fel vid anrop till databasen. Har du kört gdpr_audit.sql för att skapa funktionen?");
      console.error(error);
      process.exit(1);
    }

    if (data && data.length > 0) {
      console.error("🚨 KRITISKT FEL: GDPR Schema Violation upptäckt!");
      console.error("Följande tabeller pekar på auth.users eller profiles men saknar ON DELETE CASCADE / SET NULL:");
      console.table(data);
      console.error("\nÅtgärd: Lägg till ON DELETE CASCADE på dessa främmande nycklar innan du deployar.");
      process.exit(1);
    }

    console.log("✅ Hälso-kontroll godkänd. Databasen är 100% GDPR-säkrad med kaskad-radering.");
    process.exit(0);

  } catch (err) {
    console.error("❌ Oväntat fel:", err);
    process.exit(1);
  }
}

runHealthCheck();
