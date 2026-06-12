import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Use service role key to bypass RLS and check if keys exist
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(200).json({ active: false, reason: 'Missing Vercel Envs' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data, error } = await supabase.from('admin_secrets').select('key');
    
    if (error) {
      return res.status(200).json({ active: false, reason: error.message });
    }
    
    if (data && data.length > 0) {
      return res.status(200).json({ active: true });
    } else {
      return res.status(200).json({ active: false, reason: 'No keys found' });
    }
  } catch (e) {
    return res.status(200).json({ active: false, reason: e.message });
  }
}
