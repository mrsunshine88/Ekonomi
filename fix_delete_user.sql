-- Uppdatering av delete_user() för att garantera GDPR-kompatibel borttagning
DROP FUNCTION IF EXISTS public.delete_user();

CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Obehörig (Not authenticated)';
    END IF;

    -- Tar bort från publika tabeller först. 
    -- Om det saknas "ON DELETE CASCADE" på en specifik tabell undviker vi fel.
    -- (auth.users radering kommer också trigga inbyggd cascade).
    DELETE FROM public.profiles WHERE id = v_user_id;
    
    -- Radera från auth.users - detta tar bort själva inloggningen permanent
    DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

-- Ge rättighet till inloggade att köra denna funktion
GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;
