-- 1. Skapa tabell för Globala inställningar (ex. paywall_active)
CREATE TABLE IF NOT EXISTS global_settings (
  key VARCHAR(255) PRIMARY KEY,
  value VARCHAR(255) NOT NULL
);

-- Lägg till default värde för betalvägg (avstängd)
INSERT INTO global_settings (key, value) VALUES ('paywall_active', 'false') ON CONFLICT (key) DO NOTHING;

-- Gör global_settings publikt läsbar, men endast editerbar av system admin (oss) via RPC
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public kan läsa global_settings" ON global_settings FOR SELECT USING (true);

-- 2. Uppdatera households-tabellen med SaaS kolumner
ALTER TABLE households 
ADD COLUMN IF NOT EXISTS stripe_status VARCHAR(50) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

-- Se till att households kan läsas av dess medlemmar
-- (Detta finns nog redan men säkerställer stripe_status kan läsas)

-- 3. Funktion för att Admin ska kunna slå på/av betalvägg
CREATE OR REPLACE FUNCTION toggle_paywall(is_active BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Kontrollera om användaren är Andreas (hardkodad säkerhet)
  IF (SELECT auth.jwt() ->> 'email') = 'apersson508@gmail.com' THEN
    UPDATE global_settings SET value = is_active::text WHERE key = 'paywall_active';
  ELSE
    RAISE EXCEPTION 'Obehörig. Endast systemadmin kan göra detta.';
  END IF;
END;
$$;

-- 4. Funktion för att sätta ett hushåll till VIP (Gratis för alltid) via email
CREATE OR REPLACE FUNCTION set_household_vip_by_email(target_email VARCHAR)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_hh_id UUID;
BEGIN
  IF (SELECT auth.jwt() ->> 'email') != 'apersson508@gmail.com' THEN
    RAISE EXCEPTION 'Obehörig.';
  END IF;

  SELECT household_id INTO target_hh_id FROM profiles WHERE email = target_email LIMIT 1;

  IF target_hh_id IS NULL THEN
    RAISE EXCEPTION 'Hittade inget konto med den mejladressen.';
  END IF;

  UPDATE households SET stripe_status = 'vip' WHERE id = target_hh_id;
  
  RETURN 'Success';
END;
$$;
