import { supabase } from '../supabase';

// Hämta eller skapa ett anonymt session-ID per flik
function getSessionId(): string {
  const KEY = 'funnel_session_id';
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

export type FunnelEvent =
  | 'page_view'
  | 'demo_start'
  | 'register_start'
  | 'register_complete'
  | 'bank_upload_start'
  | 'bank_upload_complete'
  | 'onboarding_complete'
  | 'premium_start'
  | 'premium_complete';

/**
 * Spårar ett konverteringssteg anonymt.
 * Anropas utan await – vi bryr oss inte om svaret.
 * Misslyckas tyst så att eventuella nätverksfel aldrig syns för användaren.
 *
 * Exempel:
 *   trackFunnelEvent('demo_start', { source: 'hero_button' })
 *   trackFunnelEvent('bank_upload_complete', { bank: 'SEB', rows: 42 })
 */
export function trackFunnelEvent(
  event: FunnelEvent,
  metadata: Record<string, unknown> = {}
): void {
  const session_id = getSessionId();

  // Hämta user_id om inloggad (asynkront, utan att blockera)
  supabase.auth.getSession().then(({ data }) => {
    const user_id = data.session?.user?.id ?? null;

    supabase
      .from('funnel_events')
      .insert({
        session_id,
        user_id,
        event,
        metadata: {
          ...metadata,
          path: window.location.pathname,
          referrer: document.referrer || null,
          ua: navigator.userAgent.substring(0, 100), // Max 100 tecken
        },
      })
      .then(() => {}); // Fire and forget
  });
}
