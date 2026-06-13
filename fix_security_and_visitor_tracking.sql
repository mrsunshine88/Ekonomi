-- 1. Åtgärda SECURITY DEFINER varningar för oinloggade (anon) och publika API:et
-- Detta förhindrar att obehöriga överhuvudtaget kan anropa funktionerna.

REVOKE EXECUTE ON FUNCTION public.add_system_admin(text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.check_email_confirmed(text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.delete_admin_secret(character varying) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.delete_user() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_stats() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.get_system_admins() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.get_vip_emails() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_user_admin() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.remove_system_admin(text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_household_vip_by_email(character varying) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.set_admin_secret(character varying, character varying) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.set_global_setting(character varying, character varying) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.set_household_vip_by_email(character varying) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.toggle_paywall(boolean) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.toggle_share_private_economy(boolean) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.update_chat_session_timestamp() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.user_in_household(uuid) FROM public, anon;

-- Se till att authenticated (inloggade) fortfarande kan anropa dem
-- (Även om de försöker kommer våra interna is_user_admin() checkar stoppa obehöriga inloggade)
GRANT EXECUTE ON FUNCTION public.add_system_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_admin_secret(character varying) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vip_emails() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_system_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_household_vip_by_email(character varying) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_secret(character varying, character varying) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_global_setting(character varying, character varying) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_household_vip_by_email(character varying) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_paywall(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_share_private_economy(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_chat_session_timestamp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_in_household(uuid) TO authenticated;

-- 2. Skapa besökslogg-tabellen
CREATE TABLE IF NOT EXISTS public.page_visits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id text NOT NULL,
    path text NOT NULL,
    visited_at timestamptz DEFAULT now()
);

-- Aktivera RLS
ALTER TABLE public.page_visits ENABLE ROW LEVEL SECURITY;

-- Policy: Alla (inklusive oinloggade) får lägga till besök (INSERT)
CREATE POLICY "Allow anyone to insert page visits" 
ON public.page_visits FOR INSERT 
WITH CHECK (true);

-- Policy: Endast systemadmins får läsa besöken (SELECT)
CREATE POLICY "Allow admins to read page visits" 
ON public.page_visits FOR SELECT 
USING (public.is_user_admin());

-- 3. Uppdatera get_admin_stats för att inkludera besöksstatistik
DROP FUNCTION IF EXISTS public.get_admin_stats();

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS TABLE(
    total_members BIGINT, 
    active_households BIGINT,
    unique_visitors_today BIGINT,
    total_page_views_today BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Säkerhetskontroll: Endast admins får köra denna
  IF NOT is_user_admin() THEN
    RAISE EXCEPTION 'Obehörig. Endast systemadmin kan köra detta.';
  END IF;

  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM profiles) as total_members,
    (SELECT COUNT(*) FROM households WHERE stripe_status = 'vip') as active_households,
    (SELECT COUNT(DISTINCT session_id) FROM page_visits WHERE visited_at >= CURRENT_DATE) as unique_visitors_today,
    (SELECT COUNT(*) FROM page_visits WHERE visited_at >= CURRENT_DATE) as total_page_views_today;
END;
$$;

-- Bevilja rättighet till inloggade
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
