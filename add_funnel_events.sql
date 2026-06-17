-- funnel_events: Spårar konverteringsstegen anonymt
-- Inga personuppgifter sparas. session_id är ett anonymt UUID från sessionStorage.

CREATE TABLE IF NOT EXISTS public.funnel_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  TEXT NOT NULL,
    user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event       TEXT NOT NULL CHECK (event IN (
        'page_view',
        'demo_start',
        'register_start',
        'register_complete',
        'bank_upload_start',
        'bank_upload_complete',
        'onboarding_complete',
        'premium_start',
        'premium_complete'
    )),
    metadata    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index för snabba dashboard-frågor
CREATE INDEX IF NOT EXISTS idx_funnel_events_event     ON public.funnel_events(event);
CREATE INDEX IF NOT EXISTS idx_funnel_events_created   ON public.funnel_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_events_session   ON public.funnel_events(session_id);

-- RLS
ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

-- Vem som helst (även ologgad) får INSERT via anon-nyckeln
CREATE POLICY "Anon insert funnel events"
ON public.funnel_events FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Enbart admin får läsa
CREATE POLICY "Admin read funnel events"
ON public.funnel_events FOR SELECT
TO authenticated
USING (public.is_user_admin());

-- SQL-vy för funnel-beräkning (används av AdminDashboard)
CREATE OR REPLACE VIEW public.funnel_summary AS
SELECT
    event,
    COUNT(DISTINCT session_id) AS sessions,
    COUNT(DISTINCT user_id)    AS unique_users,
    DATE_TRUNC('day', created_at) AS day
FROM public.funnel_events
GROUP BY event, DATE_TRUNC('day', created_at)
ORDER BY day DESC, sessions DESC;

-- Säkra vyn så att enbart admin kan läsa den
REVOKE ALL ON public.funnel_summary FROM anon, authenticated;
GRANT SELECT ON public.funnel_summary TO authenticated;
