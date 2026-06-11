-- Skapa RPC-funktion för att låta admin uppdatera global_settings
CREATE OR REPLACE FUNCTION set_global_setting(setting_key VARCHAR, setting_value VARCHAR)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Kontrollera om användaren är systemadmin (hardkodad till apersson508@gmail.com för tillfället)
  IF (SELECT auth.jwt() ->> 'email') = 'apersson508@gmail.com' THEN
    INSERT INTO global_settings (key, value) 
    VALUES (setting_key, setting_value)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  ELSE
    RAISE EXCEPTION 'Obehörig. Endast systemadmin kan uppdatera inställningar.';
  END IF;
END;
$$;

-- Ge behörighet till authenticated users (RLS blockerar obehöriga inuti funktionen)
GRANT EXECUTE ON FUNCTION set_global_setting(VARCHAR, VARCHAR) TO authenticated;
