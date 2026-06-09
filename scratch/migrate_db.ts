import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  console.log("SQL att köra i Supabase SQL Editor:");
  console.log(`
-- 1. Share private economy toggle
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS share_private_economy BOOLEAN DEFAULT FALSE;

-- 2. Start month for bills (to prevent them showing up in the past)
ALTER TABLE bills ADD COLUMN IF NOT EXISTS start_month TEXT;
ALTER TABLE private_bills ADD COLUMN IF NOT EXISTS start_month TEXT;

-- 3. Update RLS policies for private bills sharing
DROP POLICY IF EXISTS "Household can read private bills if shared" ON private_bills;
CREATE POLICY "Household can read private bills if shared" ON private_bills
FOR SELECT USING (
  household_id = (SELECT household_id FROM profiles WHERE id = auth.uid())
  AND
  (
    user_id = auth.uid() 
    OR 
    (SELECT share_private_economy FROM profiles WHERE id = private_bills.user_id) = true
  )
);

DROP POLICY IF EXISTS "Household can read private month amounts if shared" ON private_month_amounts;
CREATE POLICY "Household can read private month amounts if shared" ON private_month_amounts
FOR SELECT USING (
  household_id = (SELECT household_id FROM profiles WHERE id = auth.uid())
  AND
  (
    user_id = auth.uid() 
    OR 
    (SELECT share_private_economy FROM profiles WHERE id = private_month_amounts.user_id) = true
  )
);

-- Note: We only grant SELECT. Users cannot update other people's private bills.
  `);
}
run();
