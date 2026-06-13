import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ success: false, error: 'Missing Vercel Envs' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Försök anropa RPC:n först med service_role
    const rpcRes = await supabase.rpc('add_system_admin', { target_email: 'apersson508@gmail.com' });
    
    // Om det misslyckas, hämta schemat för system_admins
    const { data: rows, error: selectErr } = await supabase.from('system_admins').select('*').limit(1);
    
    return res.status(200).json({ 
      success: true, 
      rpc_result: rpcRes,
      table_sample: rows,
      table_error: selectErr
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}
