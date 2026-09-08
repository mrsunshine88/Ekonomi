-- Fix för att kunna ta bort obekräftade användare från admin-panelen
-- Vi byter ut admin_delete_user till en version som rensar data först.

DROP FUNCTION IF EXISTS public.admin_delete_user(UUID);

CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Kontrollera behörighet
    IF NOT is_user_admin() THEN
        RAISE EXCEPTION 'Obehörig. Endast systemadmin kan köra detta.';
    END IF;

    -- 2. Rensa relaterad data som kan blockera raderingen (Foreign Key Constraints)
    
    -- Radera eventuell besökshistorik (om tabellen finns och är kopplad med FK)
    -- Vissa besökare kan loggas med sitt auth-ID.
    -- (Vi stänger in deletes i separata DO blocks / EXCEPTION blocks om man vill
    -- undvika fel om tabellen inte existerar, men här kör vi dem direkt).
    
    DELETE FROM public.chat_sessions WHERE user_id = target_user_id;

    -- Ta bort från profiler
    DELETE FROM public.profiles WHERE id = target_user_id;

    -- 3. Ta bort själva inloggningen i auth.users
    DELETE FROM auth.users WHERE id = target_user_id;
    
END;
$$;

-- Bevilja exekveringsrättighet
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
