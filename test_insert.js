import { createClient } from '@supabase/supabase-js';  
const supabase = createClient('https://radulzfekkupfxclruzk.supabase.co', 'sb_publishable_xnJX-j2HRmVrp61_1TIlpA_9DAGqiXP');  
async function test() { const { data, error } = await supabase.from('chat_sessions').insert({ visitor_id: 'test_visitor' }).select('id').single(); console.log('Session result:', data, error); if(data) { const msg = await supabase.from('chat_messages').insert({ session_id: data.id, sender_type: 'user', message: 'test msg' }).select().single(); console.log('Message result:', msg?.data, msg?.error); } } test();  
