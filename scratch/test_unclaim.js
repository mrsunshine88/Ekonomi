import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(Boolean).map(line => line.split('=')));

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkAndApply() {
  const res = await supabase.rpc('unclaim_chat_session', { target_session_id: '00000000-0000-0000-0000-000000000000' });
  console.log('Result of calling unclaim_chat_session:', res);
}

checkAndApply();
