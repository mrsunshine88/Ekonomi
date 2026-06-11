import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!

webpush.setVapidDetails(
  'mailto:support@smartekonomi.nu',
  vapidPublicKey,
  vapidPrivateKey
)

const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  try {
    const today = new Date().getDate();

    // 1. Hitta alla hushåll som har påminnelse satt till dagens datum
    const { data: households, error: hhErr } = await supabase
      .from('household_settings')
      .select('household_id, reminder_day')
      .eq('reminder_day', today);

    if (hhErr) throw hhErr;
    if (!households || households.length === 0) {
      return new Response(JSON.stringify({ message: "Inga hushåll att påminna idag." }), { headers: { "Content-Type": "application/json" } });
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
      // 2. Kolla om månaden är låst (har de fört över pengar?)
      // Vi kollar om det finns några is_handled = true i month_handled_payments
      const { data: handled } = await supabase
        .from('month_handled_payments')
        .select('is_handled')
        .eq('household_id', hh.household_id)
        .eq('month_id', targetMonthId)
        .eq('is_handled', true)
        .limit(1);

      const isDone = handled && handled.length > 0;

      // Om de INTE är klara, skicka notis
      if (!isDone) {
        // Hämta alla användare i hushållet
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('household_id', hh.household_id);

        if (profiles) {
          for (const profile of profiles) {
            // Hämta prenumerationer för användaren
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
                } catch (pushErr: any) {
                  // Om prenumerationen är död (t.ex. användaren rensat data), radera den
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

    return new Response(JSON.stringify({ success: true, sent: sentCount }), { headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
})
