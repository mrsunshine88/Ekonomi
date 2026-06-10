CREATE OR REPLACE FUNCTION revoke_household_vip_by_email(target_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Körs med admin-rättigheter för att förbigå RLS på households
AS $$
DECLARE
    target_household_id UUID;
    admin_email TEXT;
BEGIN
    -- 1. Kontrollera att den som anropar är admin (hårdkodad säkerhet)
    SELECT email INTO admin_email FROM auth.users WHERE id = auth.uid();
    IF admin_email != 'apersson508@gmail.com' THEN
        RAISE EXCEPTION 'Endast systemadministratören får ta bort VIP-status';
    END IF;

    -- 2. Hitta household_id för den angivna mejladressen
    SELECT household_id INTO target_household_id 
    FROM public.profiles 
    WHERE email = target_email 
    LIMIT 1;

    IF target_household_id IS NULL THEN
        RAISE EXCEPTION 'Hittade ingen profil kopplad till %', target_email;
    END IF;

    -- 3. Uppdatera hushållets stripe_status till 'trial'
    UPDATE public.households
    SET stripe_status = 'trial'
    WHERE id = target_household_id;

END;
$$;
