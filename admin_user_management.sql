-- Funktion för att hämta alla medlemmar till admin-vyn
DROP FUNCTION IF EXISTS public.admin_get_all_users();
CREATE OR REPLACE FUNCTION public.admin_get_all_users()
RETURNS TABLE (
    id UUID,
    email VARCHAR,
    last_sign_in_at TIMESTAMPTZ,
    is_banned BOOLEAN,
    is_vip BOOLEAN,
    is_admin BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT is_user_admin() THEN
        RAISE EXCEPTION 'Obehörig. Endast systemadmin kan köra detta.';
    END IF;

    RETURN QUERY
    SELECT 
        u.id, 
        u.email::VARCHAR, 
        u.last_sign_in_at, 
        (u.banned_until IS NOT NULL AND u.banned_until > now()) as is_banned,
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.households h ON p.household_id = h.id
            WHERE p.id = u.id AND h.stripe_status = 'vip'
        ) as is_vip,
        EXISTS (
            SELECT 1 FROM public.system_admins sa
            WHERE sa.user_id = u.id
        ) as is_admin
    FROM auth.users u
    ORDER BY u.created_at DESC;
END;
$$;

-- Funktion för att blockera / låsa upp en användare
DROP FUNCTION IF EXISTS public.admin_ban_user(UUID, BOOLEAN);
CREATE OR REPLACE FUNCTION public.admin_ban_user(target_user_id UUID, ban BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT is_user_admin() THEN
        RAISE EXCEPTION 'Obehörig. Endast systemadmin kan köra detta.';
    END IF;

    IF ban THEN
        UPDATE auth.users SET banned_until = '3000-01-01'::TIMESTAMPTZ WHERE id = target_user_id;
    ELSE
        UPDATE auth.users SET banned_until = NULL WHERE id = target_user_id;
    END IF;
END;
$$;

-- Funktion för att helt radera en användare
DROP FUNCTION IF EXISTS public.admin_delete_user(UUID);
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT is_user_admin() THEN
        RAISE EXCEPTION 'Obehörig. Endast systemadmin kan köra detta.';
    END IF;

    -- Ta först bort från publika tabeller för säkerhets skull
    DELETE FROM public.profiles WHERE id = target_user_id;
    -- Ta bort från auth.users (vilket tar bort personen helt från inloggningssystemet)
    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- Bevilja rättigheter till inloggade så funktionen kan anropas från klienten
GRANT EXECUTE ON FUNCTION public.admin_get_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
