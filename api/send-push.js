import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Setup VAPID keys
const publicVapidKey = process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

if (publicVapidKey && privateVapidKey) {
  webpush.setVapidDetails(
    'mailto:support@smartekonomi.se',
    publicVapidKey,
    privateVapidKey
  );
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // This endpoint will be called by Supabase Webhook when a new message is inserted
    const payload = req.body;
    
    // Check if the message is from a user
    if (payload?.record?.sender_type !== 'user') {
      return res.status(200).json({ message: 'Not a user message, ignored.' });
    }

    const messageText = payload.record.message;

    // Fetch all admin subscriptions
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: subscriptions, error } = await supabase
      .from('admin_push_subscriptions')
      .select('*');

    if (error) {
      console.error("Failed to fetch subscriptions:", error);
      return res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ message: 'No active admin subscriptions.' });
    }

    // Send push notification to all admins
    const sendPromises = subscriptions.map(record => {
      let pushSubscription = record.subscription;
      if (typeof pushSubscription === 'string') {
        pushSubscription = JSON.parse(pushSubscription);
      }

      const payload = JSON.stringify({
        title: 'Nytt meddelande',
        body: messageText,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        data: { url: '/admin-dashboard' }
      });

      return webpush.sendNotification(pushSubscription, payload)
        .then(() => ({ endpoint: pushSubscription.endpoint, success: true }))
        .catch(err => ({ endpoint: pushSubscription.endpoint, success: false, error: err.message }));
    });

    const results = await Promise.all(sendPromises);

      return res.status(200).json({ 
        success: true, 
        count: subscriptions.length,
        results: results,
        debug: {
          hasPublicVapid: !!publicVapidKey,
          hasPrivateVapid: !!privateVapidKey,
          publicVapidPrefix: publicVapidKey ? publicVapidKey.substring(0, 5) : null
        }
      });
  } catch (error) {
    console.error('Push error:', error);
    return res.status(500).json({ error: error.message });
  }
}
