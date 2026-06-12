-- 1. Fix get_vip_emails
DROP FUNCTION IF EXISTS get_vip_emails();

CREATE OR REPLACE FUNCTION get_vip_emails()
RETURNS TABLE(email TEXT)  -- Ändrad från VARCHAR till TEXT för att matcha profiles.email
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_user_admin() THEN
    RAISE EXCEPTION 'Obehörig.';
  END IF;

  RETURN QUERY 
  SELECT p.email FROM profiles p 
  JOIN households h ON p.household_id = h.id 
  WHERE h.stripe_status = 'vip' AND p.role = 'owner';
END;
$$;


-- 2. Fix get_admin_stats
DROP FUNCTION IF EXISTS get_admin_stats();

CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS TABLE(total_members BIGINT, active_households BIGINT) -- Ändrad från INT till BIGINT för att matcha COUNT()
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_user_admin() THEN
    RAISE EXCEPTION 'Obehörig.';
  END IF;

  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM profiles) as total_members,
    (SELECT COUNT(*) FROM households WHERE stripe_status = 'vip') as active_households;
END;
$$;
