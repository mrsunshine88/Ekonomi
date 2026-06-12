-- 1. Create the system_admins table
CREATE TABLE IF NOT EXISTS system_admins (
  email VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS but allow anyone to read (so the frontend can check)
ALTER TABLE system_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public kan läsa system_admins" ON system_admins FOR SELECT USING (true);

-- 2. Create the is_user_admin() helper function
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email VARCHAR;
BEGIN
  user_email := (SELECT auth.jwt() ->> 'email');
  
  IF user_email = 'apersson508@gmail.com' THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (SELECT 1 FROM system_admins WHERE email = user_email) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- 3. Functions to manage the system_admins list
CREATE OR REPLACE FUNCTION add_system_admin(target_email VARCHAR)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_user_admin() THEN
    RAISE EXCEPTION 'Obehörig. Endast administratörer kan lägga till administratörer.';
  END IF;
  
  -- Gud-kollen
  IF target_email = 'apersson508@gmail.com' THEN
    RETURN 'Denna person är redan superadmin.';
  END IF;

  INSERT INTO system_admins (email) VALUES (target_email) ON CONFLICT DO NOTHING;
  RETURN 'Success';
END;
$$;

CREATE OR REPLACE FUNCTION remove_system_admin(target_email VARCHAR)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_user_admin() THEN
    RAISE EXCEPTION 'Obehörig. Endast administratörer kan ta bort administratörer.';
  END IF;

  IF target_email = 'apersson508@gmail.com' THEN
    RAISE EXCEPTION 'Du kan inte ta bort superadmin!';
  END IF;

  DELETE FROM system_admins WHERE email = target_email;
  RETURN 'Success';
END;
$$;

CREATE OR REPLACE FUNCTION get_system_admins()
RETURNS TABLE(email VARCHAR)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_user_admin() THEN
    RAISE EXCEPTION 'Obehörig.';
  END IF;

  RETURN QUERY SELECT s.email FROM system_admins s;
END;
$$;

-- 4. Update all existing RPCs to use the new is_user_admin() helper

DROP FUNCTION IF EXISTS toggle_paywall(BOOLEAN);
CREATE OR REPLACE FUNCTION toggle_paywall(is_active BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF is_user_admin() THEN
    UPDATE global_settings SET value = is_active::text WHERE key = 'paywall_active';
  ELSE
    RAISE EXCEPTION 'Obehörig. Endast systemadmin kan göra detta.';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS set_household_vip_by_email(VARCHAR);
CREATE OR REPLACE FUNCTION set_household_vip_by_email(target_email VARCHAR)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_hh_id UUID;
BEGIN
  IF NOT is_user_admin() THEN
    RAISE EXCEPTION 'Obehörig.';
  END IF;

  SELECT household_id INTO target_hh_id FROM profiles WHERE profiles.email = target_email LIMIT 1;

  IF target_hh_id IS NULL THEN
    RAISE EXCEPTION 'Hittade inget konto med den mejladressen.';
  END IF;

  UPDATE households SET stripe_status = 'vip' WHERE id = target_hh_id;
  RETURN 'Success';
END;
$$;

DROP FUNCTION IF EXISTS revoke_household_vip_by_email(VARCHAR);
CREATE OR REPLACE FUNCTION revoke_household_vip_by_email(target_email VARCHAR)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_hh_id UUID;
BEGIN
  IF NOT is_user_admin() THEN
    RAISE EXCEPTION 'Obehörig.';
  END IF;

  SELECT household_id INTO target_hh_id FROM profiles WHERE profiles.email = target_email LIMIT 1;

  IF target_hh_id IS NULL THEN
    RAISE EXCEPTION 'Hittade inget konto med den mejladressen.';
  END IF;

  UPDATE households SET stripe_status = 'free' WHERE id = target_hh_id;
  RETURN 'Success';
END;
$$;

DROP FUNCTION IF EXISTS get_admin_stats();

CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS TABLE(total_members INT, active_households INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_user_admin() THEN
    RAISE EXCEPTION 'Obehörig.';
  END IF;

  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INT FROM profiles) as total_members,
    (SELECT COUNT(*)::INT FROM households WHERE stripe_status = 'active' OR stripe_status = 'vip') as active_households;
END;
$$;

DROP FUNCTION IF EXISTS get_vip_emails();
CREATE OR REPLACE FUNCTION get_vip_emails()
RETURNS TABLE(email VARCHAR)
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

DROP FUNCTION IF EXISTS set_global_setting(VARCHAR, VARCHAR);
CREATE OR REPLACE FUNCTION set_global_setting(setting_key VARCHAR, setting_value VARCHAR)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_user_admin() THEN
    RAISE EXCEPTION 'Obehörig.';
  END IF;
  
  INSERT INTO global_settings (key, value)
  VALUES (setting_key, setting_value)
  ON CONFLICT (key) DO UPDATE SET value = setting_value;
END;
$$;

DROP FUNCTION IF EXISTS set_admin_secret(VARCHAR, VARCHAR);
CREATE OR REPLACE FUNCTION set_admin_secret(secret_key VARCHAR, secret_value VARCHAR)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_user_admin() THEN
    RAISE EXCEPTION 'Obehörig.';
  END IF;
  
  INSERT INTO admin_secrets (key, value)
  VALUES (secret_key, secret_value)
  ON CONFLICT (key) DO UPDATE SET value = secret_value;
END;
$$;
