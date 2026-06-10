import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const config = {
  api: {
    bodyParser: false,
  },
};

const buffer = async (readable) => {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Missing Supabase credentials' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Fetch Stripe secrets
    const { data: secrets, error: secretsError } = await supabase
      .from('admin_secrets')
      .select('key, value')
      .in('key', ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']);

    if (secretsError || !secrets || secrets.length < 2) {
      return res.status(500).json({ error: 'Stripe secrets not configured.' });
    }

    const stripeSecret = secrets.find(s => s.key === 'STRIPE_SECRET_KEY')?.value;
    const webhookSecret = secrets.find(s => s.key === 'STRIPE_WEBHOOK_SECRET')?.value;

    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16' });

    // 2. Read Raw Body and Verify Signature
    const reqBuffer = await buffer(req);
    const signature = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(reqBuffer, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // 3. Handle specific events
    const session = event.data.object;

    switch (event.type) {
      case 'checkout.session.completed': {
        const householdId = session.client_reference_id || session.metadata?.household_id;
        const customerId = session.customer;
        
        if (householdId) {
          await supabase.from('households')
            .update({ stripe_status: 'active', stripe_customer_id: customerId })
            .eq('id', householdId);
        }
        break;
      }
      
      case 'customer.subscription.deleted':
      case 'customer.subscription.canceled': {
        const customerId = session.customer;
        if (customerId) {
          await supabase.from('households')
            .update({ stripe_status: 'canceled' })
            .eq('stripe_customer_id', customerId);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const customerId = session.customer;
        if (customerId) {
          await supabase.from('households')
            .update({ stripe_status: 'past_due' })
            .eq('stripe_customer_id', customerId);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const customerId = session.customer;
        // Don't override 'vip' status if they happen to have an active sub
        if (customerId) {
          const { data } = await supabase.from('households').select('stripe_status').eq('stripe_customer_id', customerId).single();
          if (data && data.stripe_status !== 'vip') {
            await supabase.from('households')
              .update({ stripe_status: 'active' })
              .eq('stripe_customer_id', customerId);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
}
