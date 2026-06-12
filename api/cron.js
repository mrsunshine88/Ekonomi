import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export default async function handler(req, res) {
  // Verifiera att anropet kommer från Vercel Cron (säkerhet)
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end('Unauthorized');
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

  if (!supabaseUrl || !supabaseServiceKey || !vapidPublicKey || !vapidPrivateKey) {
    return res.status(500).json({ error: "Missing environment variables" });
  }

  webpush.setVapidDetails(
    'mailto:support@ekonomiapp.local',
    vapidPublicKey,
    vapidPrivateKey
  );

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const today = new Date().getDate();

    const { data: households, error: hhErr } = await supabase
      .from('household_settings')
      .select('*')
      .eq('reminder_day', today);

    if (hhErr) throw hhErr;
    if (!households || households.length === 0) {
      return res.status(200).json({ message: "Inga hushåll att påminna idag." });
    }

    const todayObj = new Date();
    const currentDay = todayObj.getDate();
    
    // Om vi är sent i månaden (>= 20) ska vi kontrollera nästa månad.
    let targetDate = new Date(todayObj);
    if (currentDay >= 20) {
      targetDate.setMonth(targetDate.getMonth() + 1);
    }
    const targetMonthId = targetDate.toISOString().slice(0, 7); // Ex: "2026-07"
    
    let sentCount = 0;

    for (const hh of households) {
      if (hh.enable_management_buttons === false) continue;
      
      const { data: handled } = await supabase
        .from('month_handled_payments')
        .select('is_handled')
        .eq('household_id', hh.household_id)
        .eq('month_id', targetMonthId)
        .eq('is_handled', true)
        .limit(1);

      const isDone = handled && handled.length > 0;

      if (!isDone) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('household_id', hh.household_id);

        if (profiles) {
          for (const profile of profiles) {
            const { data: subs } = await supabase
              .from('push_subscriptions')
              .select('id, subscription')
              .eq('user_id', profile.id);

            if (subs) {
              for (const subRow of subs) {
                try {
                  const payload = JSON.stringify({
                    title: 'Dags att fixa ekonomin! 💸',
                    body: 'Ni har obetalda eller ohanterade gemensamma räkningar för denna månad.',
                    url: '/'
                  });
                  await webpush.sendNotification(subRow.subscription, payload);
                  sentCount++;
                } catch (pushErr) {
                  if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                    await supabase.from('push_subscriptions').delete().eq('id', subRow.id);
                  }
                  console.error("Fel vid push:", pushErr);
                }
              }
            }
          }
        }
      }
    }

    return res.status(200).json({ success: true, sent: sentCount });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
