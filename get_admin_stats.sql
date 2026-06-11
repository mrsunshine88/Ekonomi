CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS TABLE (total_members INT, active_households INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Endast systemadmin (Andreas)
  IF (SELECT auth.jwt() ->> 'email') != 'apersson508@gmail.com' THEN
    RAISE EXCEPTION 'Obehörig. Endast systemadmin kan köra detta.';
  END IF;

  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INT FROM profiles),
    (SELECT COUNT(*)::INT FROM households WHERE stripe_status IN ('active', 'vip'));
END;
$$;
