import { createClient } from '@supabase/supabase-js';  
const supabase = createClient('https://radulzfekkupfxclruzk.supabase.co', 'sb_publishable_xnJX-j2HRmVrp61_1TIlpA_9DAGqiXP');  
async function test() { const { data, error } = await supabase.rpc('get_admin_stats'); console.log('Stats:', data, error); } test();  
