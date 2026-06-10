import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { householdId, customerEmail } = req.body;
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
    // Fetch Stripe secrets from the hidden admin_secrets table
    const { data: secrets, error: secretsError } = await supabase
      .from('admin_secrets')
      .select('key, value')
      .in('key', ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID']);

    if (secretsError || !secrets || secrets.length < 2) {
      return res.status(500).json({ error: 'Stripe is not configured in Admin Dashboard.' });
    }

    const stripeSecret = secrets.find(s => s.key === 'STRIPE_SECRET_KEY')?.value;
    const priceId = secrets.find(s => s.key === 'STRIPE_PRICE_ID')?.value;

    if (!stripeSecret || !priceId) {
      return res.status(500).json({ error: 'Incomplete Stripe configuration.' });
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16' });

    // Determine the host for success/cancel URLs
    const host = req.headers.host || 'localhost:5173';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const origin = `${protocol}://${host}`;

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}`,
      customer_email: customerEmail || undefined,
      client_reference_id: householdId, // Pass household ID so we know who paid in the webhook
      metadata: {
        household_id: householdId
      }
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe Checkout Error:', error);
    res.status(500).json({ error: error.message });
  }
}
