CREATE OR REPLACE FUNCTION get_vip_emails()
RETURNS TABLE(email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    admin_email TEXT;
BEGIN
    -- Kontrollera att anroparen är admin
    SELECT auth.users.email INTO admin_email FROM auth.users WHERE id = auth.uid();
    IF admin_email != 'apersson508@gmail.com' THEN
        RAISE EXCEPTION 'Obehörig åtkomst';
    END IF;

    RETURN QUERY
    SELECT p.email::TEXT
    FROM public.profiles p
    JOIN public.households h ON p.household_id = h.id
    WHERE h.stripe_status = 'vip';
END;
$$;
