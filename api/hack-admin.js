import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ success: false, error: 'Missing Vercel Envs' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Sätt in apersson508@gmail.com igen
    const { error } = await supabase.from('system_admins').insert([{ email: 'apersson508@gmail.com' }]);
    
    if (error) {
      if (error.code === '23505') { // unique violation
        return res.status(200).json({ success: true, message: 'Redan tillagd!' });
      }
      return res.status(500).json({ success: false, error: error.message });
    }
    
    return res.status(200).json({ success: true, message: 'Gud-läget är återställt! Du är nu admin i databasen igen.' });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}
