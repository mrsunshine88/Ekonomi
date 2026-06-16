const { createClient } = require('@supabase/supabase-js');  
require('dotenv').config();  
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);  
async function test() { const { data, error } = await supabase.from('chat_sessions').insert({ visitor_id: 'test' }).select('id').single(); console.log('Session:', data, error); if(data) { const msg = await supabase.from('chat_messages').insert({ session_id: data.id, sender_type: 'user', message: 'test' }).select().single(); console.log('Message:', msg.data, msg.error); } } test();  
