import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
  console.log("Testing admin_get_all_users...");
  const { data, error } = await supabase.rpc('admin_get_all_users');
  if (error) {
    console.error("Error admin_get_all_users:", error);
  } else {
    console.log("Success admin_get_all_users:", data?.length);
  }

  console.log("Testing get_admin_stats...");
  const { data: stats, error: statsErr } = await supabase.rpc('get_admin_stats');
  if (statsErr) {
    console.error("Error get_admin_stats:", statsErr);
  } else {
    console.log("Success get_admin_stats:", stats);
  }
}
test();
