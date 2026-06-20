require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);
supabase.from('chat_sessions').select('id, status, ticket_type, assigned_to').eq('ticket_type', 'email').then(res => {
  console.log(res.data);
});
