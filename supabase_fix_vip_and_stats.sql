-- 1. Fix get_admin_stats to ONLY count active, not VIP
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
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_user_admin() THEN
    RAISE EXCEPTION 'Obehörig. Endast systemadmin kan köra detta.';
  END IF;

  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM profiles) as total_members,
    (SELECT COUNT(*) FROM households WHERE stripe_status = 'active') as active_households,
    
    -- Idag
    (SELECT COUNT(DISTINCT session_id) FROM page_visits WHERE visited_at >= CURRENT_DATE) as unique_visitors_today,
    (SELECT COUNT(*) FROM page_visits WHERE visited_at >= CURRENT_DATE) as total_page_views_today,
    (SELECT COUNT(DISTINCT session_id) FROM demo_visits WHERE visited_at >= CURRENT_DATE) as demo_unique_today,
    (SELECT COUNT(*) FROM demo_visits WHERE visited_at >= CURRENT_DATE) as demo_views_today,
    
    -- Igår
    (SELECT COUNT(DISTINCT session_id) FROM page_visits WHERE visited_at >= (CURRENT_DATE - INTERVAL '1 day') AND visited_at < CURRENT_DATE) as unique_visitors_yesterday,
    (SELECT COUNT(*) FROM page_visits WHERE visited_at >= (CURRENT_DATE - INTERVAL '1 day') AND visited_at < CURRENT_DATE) as total_page_views_yesterday,
    (SELECT COUNT(DISTINCT session_id) FROM demo_visits WHERE visited_at >= (CURRENT_DATE - INTERVAL '1 day') AND visited_at < CURRENT_DATE) as demo_unique_yesterday,
    (SELECT COUNT(*) FROM demo_visits WHERE visited_at >= (CURRENT_DATE - INTERVAL '1 day') AND visited_at < CURRENT_DATE) as demo_views_yesterday,
    
    -- Denna Vecka (från Måndag)
    (SELECT COUNT(DISTINCT session_id) FROM page_visits WHERE visited_at >= date_trunc('week', CURRENT_DATE)) as unique_visitors_this_week,
    (SELECT COUNT(*) FROM page_visits WHERE visited_at >= date_trunc('week', CURRENT_DATE)) as total_page_views_this_week,
    (SELECT COUNT(DISTINCT session_id) FROM demo_visits WHERE visited_at >= date_trunc('week', CURRENT_DATE)) as demo_unique_this_week,
    (SELECT COUNT(*) FROM demo_visits WHERE visited_at >= date_trunc('week', CURRENT_DATE)) as demo_views_this_week,
    
    -- Denna Månad
    (SELECT COUNT(DISTINCT session_id) FROM page_visits WHERE visited_at >= date_trunc('month', CURRENT_DATE)) as unique_visitors_this_month,
    (SELECT COUNT(*) FROM page_visits WHERE visited_at >= date_trunc('month', CURRENT_DATE)) as total_page_views_this_month,
    (SELECT COUNT(DISTINCT session_id) FROM demo_visits WHERE visited_at >= date_trunc('month', CURRENT_DATE)) as demo_unique_this_month,
    (SELECT COUNT(*) FROM demo_visits WHERE visited_at >= date_trunc('month', CURRENT_DATE)) as demo_views_this_month,
    
    -- Obekräftade användare
    (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NULL) as unconfirmed_users;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;


-- 2. Drop all duplicated VIP functions and recreate a unified TEXT version
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
  target_hh_id UUID;
BEGIN
  IF NOT is_user_admin() THEN
    RAISE EXCEPTION 'Obehörig. Endast systemadmin kan göra detta.';
  END IF;

  SELECT household_id INTO target_hh_id FROM profiles WHERE profiles.email = target_email LIMIT 1;

  IF target_hh_id IS NULL THEN
    RAISE EXCEPTION 'Hittade inget konto med den mejladressen.';
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
  target_hh_id UUID;
BEGIN
  IF NOT is_user_admin() THEN
    RAISE EXCEPTION 'Obehörig. Endast systemadmin kan göra detta.';
  END IF;

  SELECT household_id INTO target_hh_id FROM profiles WHERE profiles.email = target_email LIMIT 1;

  IF target_hh_id IS NULL THEN
    RAISE EXCEPTION 'Hittade inget konto med den mejladressen.';
  END IF;

  UPDATE households SET stripe_status = 'free' WHERE id = target_hh_id;
  RETURN 'Success';
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_household_vip_by_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_household_vip_by_email(TEXT) TO authenticated;
