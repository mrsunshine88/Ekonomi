-- 1. Skapa den dolda tabellen för Stripe-nycklar
CREATE TABLE IF NOT EXISTS admin_secrets (
  key VARCHAR(255) PRIMARY KEY,
  value VARCHAR(255) NOT NULL
);

-- 2. Aktivera RLS
ALTER TABLE admin_secrets ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Endast Andreas (och Service Role) får läsa och skriva
-- Vercels serverless functions kommer använda service_role_key för att läsa detta i bakgrunden (bypass RLS).
-- Frontend-användare (även du) läser/skriver via en säker RPC-funktion.
CREATE POLICY "Strict Admin Access" ON admin_secrets
  FOR ALL 
  USING (auth.jwt() ->> 'email' = 'apersson508@gmail.com');

-- 4. Funktion för att sätta en hemlighet från frontend
CREATE OR REPLACE FUNCTION set_admin_secret(secret_key VARCHAR, secret_value VARCHAR)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (SELECT auth.jwt() ->> 'email') = 'apersson508@gmail.com' THEN
    INSERT INTO admin_secrets (key, value) 
    VALUES (secret_key, secret_value)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  ELSE
    RAISE EXCEPTION 'Obehörig. Endast systemadmin kan spara nycklar.';
  END IF;
END;
$$;

-- 5. Funktion för att radera en hemlighet
CREATE OR REPLACE FUNCTION delete_admin_secret(secret_key VARCHAR)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (SELECT auth.jwt() ->> 'email') = 'apersson508@gmail.com' THEN
    DELETE FROM admin_secrets WHERE key = secret_key;
  ELSE
    RAISE EXCEPTION 'Obehörig.';
  END IF;
END;
$$;
