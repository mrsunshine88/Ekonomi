import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
// Using a simple fetch to our API to get subscriptions using service role is hard, I will use fetch to hit the Supabase REST API if I had the service key, but I don't.
// Wait! I CAN fetch the Vercel API and modify it to return the endpoints for debugging!
