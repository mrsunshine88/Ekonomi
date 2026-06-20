-- En hjälpfunktion för att kontinuerligt validera att inga tabeller 
-- bryter mot GDPR-arkitekturen (att de pekar mot en användare utan CASCADE/SET NULL)

CREATE OR REPLACE FUNCTION public.check_gdpr_cascades()
RETURNS TABLE(table_name text, foreign_key_name text, delete_rule text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.conrelid::regclass::text AS table_name,
        c.conname::text AS foreign_key_name,
        CASE c.confdeltype
            WHEN 'a' THEN 'NO ACTION'
            WHEN 'r' THEN 'RESTRICT'
            WHEN 'c' THEN 'CASCADE'
            WHEN 'n' THEN 'SET NULL'
            WHEN 'd' THEN 'SET DEFAULT'
            ELSE c.confdeltype::text
        END AS delete_rule
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE c.confrelid IN (
        (SELECT oid FROM pg_class WHERE relname = 'users' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')),
        (SELECT oid FROM pg_class WHERE relname = 'profiles' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
    )
      AND c.contype = 'f'
      AND c.confdeltype NOT IN ('c', 'n') -- 'c' = CASCADE, 'n' = SET NULL
      AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
END;
$$;

-- Bevilja rättighet till authenticated
GRANT EXECUTE ON FUNCTION public.check_gdpr_cascades() TO authenticated;
