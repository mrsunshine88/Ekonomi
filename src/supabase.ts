import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://radulzfekkupfxclruzk.supabase.co';
const supabaseKey = 'sb_publishable_xnJX-j2HRmVrp61_1TIlpA_9DAGqiXP';

export const supabase = createClient(supabaseUrl, supabaseKey);
