import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { householdId } = req.body;
  if (!householdId) {
    return res.status(400).json({ error: 'Missing householdId' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Missing Supabase credentials' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Fetch household to get Stripe Customer ID
    const { data: hh } = await supabase.from('households').select('stripe_customer_id').eq('id', householdId).single();
    
    if (!hh || !hh.stripe_customer_id) {
      return res.status(400).json({ error: 'No active subscription found for this household.' });
    }

    // 2. Fetch Stripe secret
    const { data: secrets } = await supabase.from('admin_secrets').select('value').eq('key', 'STRIPE_SECRET_KEY').single();
    if (!secrets || !secrets.value) {
      return res.status(500).json({ error: 'Stripe is not configured in Admin Dashboard.' });
    }

    const stripeSecret = secrets.value;
    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16' });

    // Determine the host for return URL
    const host = req.headers.host || 'localhost:5173';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const origin = `${protocol}://${host}`;

    // Create Stripe Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: hh.stripe_customer_id,
      return_url: `${origin}`,
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe Portal Error:', error);
    res.status(500).json({ error: error.message });
  }
}
