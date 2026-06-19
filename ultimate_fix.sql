-- 0. Se till att alla tabeller och kolumner faktiskt finns!
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS handles_chat BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS handles_email BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS public.page_visits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id text NOT NULL,
    path text NOT NULL,
    visited_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.demo_visits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT NOT NULL,
    visited_at TIMESTAMPTZ DEFAULT NOW()
);

-- 0.5. Återställ search_path för is_user_admin och agent-funktioner
ALTER FUNCTION public.is_user_admin() SET search_path = public;
ALTER FUNCTION public.get_system_admins() SET search_path = public;
ALTER FUNCTION public.check_email_confirmed(text) SET search_path = public;
ALTER FUNCTION public.set_global_setting(character varying, character varying) SET search_path = public;
ALTER FUNCTION public.toggle_paywall(boolean) SET search_path = public;
ALTER FUNCTION public.toggle_share_private_economy(boolean) SET search_path = public;
ALTER FUNCTION public.update_chat_session_timestamp() SET search_path = public;
ALTER FUNCTION public.user_in_household(uuid) SET search_path = public;

ALTER FUNCTION public.agent_connect() SET search_path = public;
ALTER FUNCTION public.agent_disconnect() SET search_path = public;
ALTER FUNCTION public.agent_set_status(text) SET search_path = public;
ALTER FUNCTION public.auto_assign_oldest_chat() SET search_path = public;
ALTER FUNCTION public.sync_chat_open_from_agents() SET search_path = public;

-- 1. Fixa admin_get_all_users
DROP FUNCTION IF EXISTS public.admin_get_all_users();
CREATE OR REPLACE FUNCTION public.admin_get_all_users()
RETURNS TABLE (
    id UUID,
    email VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE,
    last_sign_in_at TIMESTAMP WITH TIME ZONE,
    is_blocked BOOLEAN,
    is_vip BOOLEAN,
    is_admin BOOLEAN,
    chat_agent BOOLEAN,
    handles_chat BOOLEAN,
    handles_email BOOLEAN
) AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.system_admins sa WHERE sa.user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    RETURN QUERY
    SELECT 
        u.id, 
        CAST(u.email AS VARCHAR) as email,
        u.created_at, 
        u.last_sign_in_at,
        (u.banned_until IS NOT NULL AND u.banned_until > now()) as is_blocked,
        EXISTS (
           SELECT 1 FROM public.households h 
           JOIN public.profiles p ON p.household_id = h.id 
           WHERE p.id = u.id AND h.stripe_status = 'vip'
        ) as is_vip,
        EXISTS (SELECT 1 FROM public.system_admins sa WHERE sa.user_id = u.id) as is_admin,
        COALESCE((SELECT pr.chat_agent FROM public.profiles pr WHERE pr.id = u.id), false) as chat_agent,
        COALESCE((SELECT pr.handles_chat FROM public.profiles pr WHERE pr.id = u.id), true) as handles_chat,
        COALESCE((SELECT pr.handles_email FROM public.profiles pr WHERE pr.id = u.id), false) as handles_email
    FROM auth.users u
    ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Fixa toggle_chat_agent
DROP FUNCTION IF EXISTS public.toggle_chat_agent(text, boolean);
DROP FUNCTION IF EXISTS public.toggle_chat_agent(text, boolean, boolean, boolean);

CREATE OR REPLACE FUNCTION toggle_chat_agent(target_email TEXT, enable BOOLEAN, p_handles_chat BOOLEAN DEFAULT true, p_handles_email BOOLEAN DEFAULT false)
RETURNS VOID AS $$
DECLARE
  target_user_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.system_admins sa WHERE sa.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  UPDATE public.profiles 
  SET 
      chat_agent = enable,
      handles_chat = p_handles_chat,
      handles_email = p_handles_email
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, chat_agent, handles_chat, handles_email) 
    VALUES (target_user_id, enable, p_handles_chat, p_handles_email);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Fixa get_admin_stats
DROP FUNCTION IF EXISTS public.get_admin_stats();
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS TABLE(
    total_members BIGINT, 
    active_households BIGINT,
    unique_visitors_today BIGINT,
    total_page_views_today BIGINT,
    demo_unique_today BIGINT,
    demo_views_today BIGINT,
    unique_visitors_yesterday BIGINT,
    total_page_views_yesterday BIGINT,
    demo_unique_yesterday BIGINT,
    demo_views_yesterday BIGINT,
    unique_visitors_this_week BIGINT,
    total_page_views_this_week BIGINT,
    demo_unique_this_week BIGINT,
    demo_views_this_week BIGINT,
    unique_visitors_this_month BIGINT,
    total_page_views_this_month BIGINT,
    demo_unique_this_month BIGINT,
    demo_views_this_month BIGINT,
    unconfirmed_users BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_user_admin() THEN
    RAISE EXCEPTION 'Obehörig. Endast systemadmin kan köra detta.';
  END IF;

  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM public.profiles) as total_members,
    (SELECT COUNT(*) FROM public.households WHERE stripe_status = 'vip') as active_households,
    (SELECT COUNT(DISTINCT session_id) FROM public.page_visits WHERE visited_at >= CURRENT_DATE) as unique_visitors_today,
    (SELECT COUNT(*) FROM public.page_visits WHERE visited_at >= CURRENT_DATE) as total_page_views_today,
    (SELECT COUNT(DISTINCT session_id) FROM public.demo_visits WHERE visited_at >= CURRENT_DATE) as demo_unique_today,
    (SELECT COUNT(*) FROM public.demo_visits WHERE visited_at >= CURRENT_DATE) as demo_views_today,
    (SELECT COUNT(DISTINCT session_id) FROM public.page_visits WHERE visited_at >= (CURRENT_DATE - INTERVAL '1 day') AND visited_at < CURRENT_DATE) as unique_visitors_yesterday,
    (SELECT COUNT(*) FROM public.page_visits WHERE visited_at >= (CURRENT_DATE - INTERVAL '1 day') AND visited_at < CURRENT_DATE) as total_page_views_yesterday,
    (SELECT COUNT(DISTINCT session_id) FROM public.demo_visits WHERE visited_at >= (CURRENT_DATE - INTERVAL '1 day') AND visited_at < CURRENT_DATE) as demo_unique_yesterday,
    (SELECT COUNT(*) FROM public.demo_visits WHERE visited_at >= (CURRENT_DATE - INTERVAL '1 day') AND visited_at < CURRENT_DATE) as demo_views_yesterday,
    (SELECT COUNT(DISTINCT session_id) FROM public.page_visits WHERE visited_at >= date_trunc('week', CURRENT_DATE)) as unique_visitors_this_week,
    (SELECT COUNT(*) FROM public.page_visits WHERE visited_at >= date_trunc('week', CURRENT_DATE)) as total_page_views_this_week,
    (SELECT COUNT(DISTINCT session_id) FROM public.demo_visits WHERE visited_at >= date_trunc('week', CURRENT_DATE)) as demo_unique_this_week,
    (SELECT COUNT(*) FROM public.demo_visits WHERE visited_at >= date_trunc('week', CURRENT_DATE)) as demo_views_this_week,
    (SELECT COUNT(DISTINCT session_id) FROM public.page_visits WHERE visited_at >= date_trunc('month', CURRENT_DATE)) as unique_visitors_this_month,
    (SELECT COUNT(*) FROM public.page_visits WHERE visited_at >= date_trunc('month', CURRENT_DATE)) as total_page_views_this_month,
    (SELECT COUNT(DISTINCT session_id) FROM public.demo_visits WHERE visited_at >= date_trunc('month', CURRENT_DATE)) as demo_unique_this_month,
    (SELECT COUNT(*) FROM public.demo_visits WHERE visited_at >= date_trunc('month', CURRENT_DATE)) as demo_views_this_month,
    (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NULL) as unconfirmed_users;
END;
$$;

-- 4. Fixa VIP-knappen (den letade efter hushåll i 'accounts' istället för 'profiles')
DROP FUNCTION IF EXISTS public.set_household_vip_by_email(VARCHAR);
DROP FUNCTION IF EXISTS public.set_household_vip_by_email(TEXT);
DROP FUNCTION IF EXISTS public.revoke_household_vip_by_email(VARCHAR);
DROP FUNCTION IF EXISTS public.revoke_household_vip_by_email(TEXT);

CREATE OR REPLACE FUNCTION public.set_household_vip_by_email(target_email TEXT)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
  target_hh_id UUID;
BEGIN
  IF NOT is_user_admin() THEN
    RAISE EXCEPTION 'Obehörig.';
  END IF;

  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email LIMIT 1;
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Hittade inget konto med den mejladressen.';
  END IF;

  SELECT household_id INTO target_hh_id FROM public.profiles WHERE id = target_user_id LIMIT 1;
  IF target_hh_id IS NULL THEN
    RAISE EXCEPTION 'Kunde inte hitta hushållet.';
  END IF;

  UPDATE households SET stripe_status = 'vip' WHERE id = target_hh_id;
  RETURN 'Success';
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_household_vip_by_email(target_email TEXT)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
  target_hh_id UUID;
BEGIN
  IF NOT is_user_admin() THEN
    RAISE EXCEPTION 'Obehörig.';
  END IF;

  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email LIMIT 1;
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Hittade inget konto med den mejladressen.';
  END IF;

  SELECT household_id INTO target_hh_id FROM public.profiles WHERE id = target_user_id LIMIT 1;
  IF target_hh_id IS NULL THEN
    RAISE EXCEPTION 'Kunde inte hitta hushållet.';
  END IF;

  UPDATE households SET stripe_status = 'free' WHERE id = target_hh_id;
  RETURN 'Success';
END;
$$;

-- 5. Återställ rättigheter
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_chat_agent(text, boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_connect() TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_disconnect() TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_set_status(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_assign_oldest_chat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_chat_open_from_agents() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_household_vip_by_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_household_vip_by_email(TEXT) TO authenticated;
