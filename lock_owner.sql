-- Detta säkerställer att ägaren (apersson508@gmail.com) alltid har alla rättigheter
-- (VIP, Admin, Chatt-kö, Mejl-kö) och ingen kan ta bort dem!

DO $$
DECLARE
    owner_id UUID;
    owner_household_id UUID;
BEGIN
    -- 1. Hitta användarens ID via auth.users
    SELECT id INTO owner_id 
    FROM auth.users 
    WHERE email = 'apersson508@gmail.com' 
    LIMIT 1;

    IF owner_id IS NOT NULL THEN
        -- 2. Uppdatera profilen till att vara chattagent + mejlagent
        UPDATE public.profiles
        SET 
            chat_agent = true,
            handles_chat = true,
            handles_email = true
        WHERE id = owner_id;

        -- 3. Säkerställ att ägaren är system admin (egen tabell!)
        INSERT INTO public.system_admins (user_id)
        VALUES (owner_id)
        ON CONFLICT (user_id) DO NOTHING;

        -- 4. Hitta hushålls-ID för ägaren
        SELECT household_id INTO owner_household_id
        FROM public.profiles
        WHERE id = owner_id
        LIMIT 1;

        -- Om inte hittat i profiles, kolla accounts
        IF owner_household_id IS NULL THEN
            SELECT household_id INTO owner_household_id
            FROM public.accounts
            WHERE user_id = owner_id
            LIMIT 1;
        END IF;

        -- 5. Uppdatera hushållet till VIP
        IF owner_household_id IS NOT NULL THEN
            UPDATE public.households
            SET stripe_status = 'vip'
            WHERE id = owner_household_id;
        END IF;
    END IF;
END $$;
