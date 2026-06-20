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

serve(async () => {
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
    const targetDate = new Date(todayObj);
    if (currentDay >= 20) {
      targetDate.setMonth(targetDate.getMonth() + 1);
    }
    const targetMonthId = targetDate.toISOString().slice(0, 7); // Ex: "2026-07"
    
    let sentCount = 0;
    const CHUNK_SIZE = 500;

    // Helper för chunking av arrayer
    const chunkArray = <T>(arr: T[], size: number): T[][] => {
      const result = [];
      for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
      }
      return result;
    };

    const householdChunks = chunkArray(households, CHUNK_SIZE);

    for (const chunk of householdChunks) {
      const hhIds = chunk.map(hh => hh.household_id);

      // 2. Batch-kolla om månaden är låst
      const { data: handled } = await supabase
        .from('month_handled_payments')
        .select('household_id')
        .in('household_id', hhIds)
        .eq('month_id', targetMonthId)
        .eq('is_handled', true);

      const handledSet = new Set((handled || []).map(h => h.household_id));
      const unhandledHhIds = hhIds.filter(id => !handledSet.has(id));

      if (unhandledHhIds.length === 0) continue;

      // 3. Batch-hämta profiler
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .in('household_id', unhandledHhIds);

      if (!profiles || profiles.length === 0) continue;
      const userIds = profiles.map(p => p.id);

      // 4. Batch-hämta push-prenumerationer
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('id, subscription')
        .in('user_id', userIds);

      if (!subs || subs.length === 0) continue;

      const payload = JSON.stringify({
        title: 'Dags att fixa ekonomin! 💸',
        body: 'Ni har obetalda eller ohanterade gemensamma räkningar för denna månad.',
        url: '/'
      });

      // 5. Parallella Push-notiser (Concurrent Chunking)
      const pushPromises = subs.map(async (subRow) => {
        try {
          await webpush.sendNotification(subRow.subscription, payload);
          return { success: true, id: subRow.id };
        } catch (pushErr: any) {
          // Permanenta fel markeras som Dead Letter
          if (pushErr && (pushErr.statusCode === 410 || pushErr.statusCode === 404)) {
            return { success: false, deadLetter: true, id: subRow.id };
          }
          console.error("Fel vid push:", pushErr);
          return { success: false, deadLetter: false, id: subRow.id };
        }
      });

      const results = await Promise.allSettled(pushPromises);
      
      const deadLetterIds: string[] = [];
      for (const res of results) {
        if (res.status === 'fulfilled') {
          if (res.value.success) sentCount++;
          if (res.value.deadLetter) deadLetterIds.push(res.value.id);
        }
      }

      // 6. Dead Letter Cleanup i batch
      if (deadLetterIds.length > 0) {
        await supabase.from('push_subscriptions').delete().in('id', deadLetterIds);
      }
    }

    return new Response(JSON.stringify({ success: true, sent: sentCount }), { headers: { "Content-Type": "application/json" } });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
})
