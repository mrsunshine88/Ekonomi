import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ success: false, error: 'Missing Vercel Envs' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Hitta user_id för apersson508@gmail.com. Vi kan kolla 'profiles'-tabellen
    const { data: profiles, error: profErr } = await supabase.from('profiles').select('id, email').eq('email', 'apersson508@gmail.com').limit(1);
    
    if (profErr || !profiles || profiles.length === 0) {
      return res.status(200).json({ success: false, message: 'Kunde inte hitta användaren i profiles-tabellen', error: profErr });
    }
    
    const userId = profiles[0].id;

    // 2. Sätt in user_id i system_admins
    const { error: insertErr } = await supabase.from('system_admins').insert([{ user_id: userId }]);
    
    if (insertErr) {
      if (insertErr.code === '23505') {
        return res.status(200).json({ success: true, message: 'Du är redan tillagd som admin!' });
      }
      return res.status(200).json({ success: false, message: 'Kunde inte lägga till i system_admins', error: insertErr });
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Gud-läget är helt återställt! Din user_id har lagts till i system_admins.'
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}
