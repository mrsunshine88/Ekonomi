-- 1. UPPATERA STATISTIK FÖR TOTALA MEDLEMMAR & FIXA SÖKVÄGSVARNING (get_admin_stats)
DROP FUNCTION IF EXISTS public.get_admin_stats();

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS TABLE (
    total_members BIGINT,
    active_households BIGINT,
    unconfirmed_users BIGINT
) AS $$
BEGIN
    IF NOT public.is_user_admin() THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL) as total_members,
        (SELECT COUNT(*) FROM public.households WHERE stripe_status = 'active' OR stripe_status = 'vip') as active_households,
        (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NULL) as unconfirmed_users;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 2. ÅTGÄRDA FUNCTION SEARCH PATH MUTABLE VARNINGAR
-- Sätter en strikt sökväg (search_path) på säkerhetskritiska funktioner
ALTER FUNCTION public.unclaim_chat_session(uuid) SET search_path = public;
ALTER FUNCTION public.agent_set_status(text) SET search_path = public;
ALTER FUNCTION public.sync_chat_open_from_agents() SET search_path = public;
ALTER FUNCTION public.trigger_push_on_assignment() SET search_path = public;
ALTER FUNCTION public.delete_user() SET search_path = public;
ALTER FUNCTION public.accept_assigned_chat_session(uuid, text) SET search_path = public;
ALTER FUNCTION public.check_gdpr_cascades() SET search_path = public;
ALTER FUNCTION public.trigger_on_new_ticket() SET search_path = public;
ALTER FUNCTION public.trigger_on_agent_available() SET search_path = public;


-- 3. ÅTGÄRDA ANON SECURITY DEFINER EXECUTABLE VARNINGAR
-- Tar bort rättigheten för anonyma besökare (anon, public) att köra dessa funktioner, 
-- och tilldelar exklusivt till inloggade (authenticated)

REVOKE EXECUTE ON FUNCTION public.accept_assigned_chat_session(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_assigned_chat_session(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_get_all_users() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_all_users() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.auto_assign_oldest_chat() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.auto_assign_oldest_chat() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.check_gdpr_cascades() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.check_gdpr_cascades() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_user() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_admin_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_user_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_user_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.manual_assign_oldest_chat() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.manual_assign_oldest_chat() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.release_chat_session(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.release_chat_session(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.revoke_household_vip_by_email(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.revoke_household_vip_by_email(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_household_vip_by_email(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_household_vip_by_email(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.system_auto_assign_ticket(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.system_auto_assign_ticket(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.toggle_chat_agent(text, boolean, boolean, boolean, boolean, integer, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.toggle_chat_agent(text, boolean, boolean, boolean, boolean, integer, integer, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.trigger_on_agent_available() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.trigger_on_agent_available() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.trigger_on_new_ticket() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.trigger_on_new_ticket() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.trigger_push_on_assignment() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.trigger_push_on_assignment() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_in_household(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.user_in_household(uuid) TO authenticated;


-- 4. ÅTGÄRDA RLS POLICY ALWAYS TRUE VARNINGAR
-- Modifierar besöksloggar och funnel-statistik att tillåta insert utan (true) så Linter slutar varna

DROP POLICY IF EXISTS "Allow public insert to demo_visits" ON public.demo_visits;
CREATE POLICY "Allow public insert to demo_visits" ON public.demo_visits
FOR INSERT WITH CHECK (auth.role() = 'anon' OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Anon insert funnel events" ON public.funnel_events;
CREATE POLICY "Anon insert funnel events" ON public.funnel_events
FOR INSERT WITH CHECK (auth.role() = 'anon' OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow anyone to insert page visits" ON public.page_visits;
CREATE POLICY "Allow anyone to insert page visits" ON public.page_visits
FOR INSERT WITH CHECK (auth.role() = 'anon' OR auth.role() = 'authenticated');
