const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function checkAndApply() {
  const rpcQuery = `
  CREATE OR REPLACE FUNCTION unclaim_chat_session(target_session_id UUID)
  RETURNS void AS $$
  BEGIN
    UPDATE chat_sessions
    SET assigned_to = NULL,
        assigned_name = NULL,
        status = 'waiting',
        updated_at = NOW()
    WHERE id = target_session_id AND assigned_to = auth.uid();

    UPDATE agent_sessions
    SET status = 'available', updated_at = NOW()
    WHERE agent_id = auth.uid();
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  
  GRANT EXECUTE ON FUNCTION unclaim_chat_session(UUID) TO authenticated;
  `;

  // Actually, we can just run the RPC via another way or we can check if it exists.
  // The simplest way is to just call it and see if it throws a 404/Not Found.
  const res = await supabase.rpc('unclaim_chat_session', { target_session_id: '00000000-0000-0000-0000-000000000000' });
  console.log('Result of calling unclaim_chat_session:', res);
}

checkAndApply();
