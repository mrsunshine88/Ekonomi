const { createClient } = require('@supabase/supabase-js');  
const supabase = createClient('https://radulzfekkupfxclruzk.supabase.co', 'sb_publishable_xnJX-j2HRmVrp61_1TIlpA_9DAGqiXP');  
async function test() { const {data, error} = await supabase.rpc('revoke_household_vip_by_email', { target_email: 'helehul@hotmail.com' }); console.log(data, error); } test();  
