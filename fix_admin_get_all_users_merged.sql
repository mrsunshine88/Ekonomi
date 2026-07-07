-- Denna SQL-kod byter ENDAST ut funktionen `admin_get_all_users` så att den innehåller 
-- alla nödvändiga fält från både agent_priority_setup och update_admin_unconfirmed.
-- Inga tabeller eller andra funktioner rörs.

DROP FUNCTION IF EXISTS public.admin_get_all_users();

CREATE OR REPLACE FUNCTION public.admin_get_all_users()
RETURNS TABLE (
    id UUID,
    email VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE,
    last_sign_in_at TIMESTAMP WITH TIME ZONE,
    is_blocked BOOLEAN,
    is_vip BOOLEAN,
    is_admin BOOLEAN,
    chat_agent BOOLEAN,
    handles_chat BOOLEAN,
    handles_email BOOLEAN,
    handles_info BOOLEAN,
    prio_chat INTEGER,
    prio_email INTEGER,
    prio_info INTEGER,
    is_unconfirmed BOOLEAN
) AS $$
BEGIN
    -- Säkerhetskontroll (endast system_admins)
    IF NOT EXISTS (SELECT 1 FROM public.system_admins sa WHERE sa.user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    RETURN QUERY
    SELECT 
        u.id, 
        CAST(u.email AS VARCHAR) as email,
        u.created_at, 
        u.last_sign_in_at,
        (u.banned_until IS NOT NULL AND u.banned_until > now()) as is_blocked,
        -- VIP
        EXISTS (
           SELECT 1 FROM public.households h 
           JOIN public.profiles p ON p.household_id = h.id 
           WHERE p.id = u.id AND h.stripe_status = 'vip'
        ) as is_vip,
        -- Admin
        EXISTS (SELECT 1 FROM public.system_admins sa WHERE sa.user_id = u.id) as is_admin,
        -- Agent status
        COALESCE((SELECT pr.chat_agent FROM public.profiles pr WHERE pr.id = u.id), false) as chat_agent,
        COALESCE((SELECT pr.handles_chat FROM public.profiles pr WHERE pr.id = u.id), true) as handles_chat,
        COALESCE((SELECT pr.handles_email FROM public.profiles pr WHERE pr.id = u.id), false) as handles_email,
        COALESCE((SELECT pr.handles_info FROM public.profiles pr WHERE pr.id = u.id), false) as handles_info,
        COALESCE((SELECT pr.prio_chat FROM public.profiles pr WHERE pr.id = u.id), 1) as prio_chat,
        COALESCE((SELECT pr.prio_email FROM public.profiles pr WHERE pr.id = u.id), 1) as prio_email,
        COALESCE((SELECT pr.prio_info FROM public.profiles pr WHERE pr.id = u.id), 1) as prio_info,
        -- Obekräftad e-post
        (u.email_confirmed_at IS NULL) as is_unconfirmed
    FROM auth.users u
    ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.admin_get_all_users() TO authenticated;
