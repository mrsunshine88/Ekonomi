-- 1. Uppdatera get_admin_stats för att inkludera all historisk besöksstatistik
DROP FUNCTION IF EXISTS public.get_admin_stats();

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS TABLE(
    total_members BIGINT, 
    active_households BIGINT,
    unique_visitors_today BIGINT,
    total_page_views_today BIGINT,
    unique_visitors_yesterday BIGINT,
    total_page_views_yesterday BIGINT,
    unique_visitors_this_week BIGINT,
    total_page_views_this_week BIGINT,
    unique_visitors_this_month BIGINT,
    total_page_views_this_month BIGINT
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
    
    -- Idag
    (SELECT COUNT(DISTINCT session_id) FROM page_visits WHERE visited_at >= CURRENT_DATE) as unique_visitors_today,
    (SELECT COUNT(*) FROM page_visits WHERE visited_at >= CURRENT_DATE) as total_page_views_today,
    
    -- Igår
    (SELECT COUNT(DISTINCT session_id) FROM page_visits WHERE visited_at >= (CURRENT_DATE - INTERVAL '1 day') AND visited_at < CURRENT_DATE) as unique_visitors_yesterday,
    (SELECT COUNT(*) FROM page_visits WHERE visited_at >= (CURRENT_DATE - INTERVAL '1 day') AND visited_at < CURRENT_DATE) as total_page_views_yesterday,
    
    -- Denna Vecka (från Måndag)
    (SELECT COUNT(DISTINCT session_id) FROM page_visits WHERE visited_at >= date_trunc('week', CURRENT_DATE)) as unique_visitors_this_week,
    (SELECT COUNT(*) FROM page_visits WHERE visited_at >= date_trunc('week', CURRENT_DATE)) as total_page_views_this_week,
    
    -- Denna Månad
    (SELECT COUNT(DISTINCT session_id) FROM page_visits WHERE visited_at >= date_trunc('month', CURRENT_DATE)) as unique_visitors_this_month,
    (SELECT COUNT(*) FROM page_visits WHERE visited_at >= date_trunc('month', CURRENT_DATE)) as total_page_views_this_month;
END;
$$;

-- Bevilja rättighet till inloggade
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
