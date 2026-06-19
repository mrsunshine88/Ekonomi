-- Lägg till stöd för e-post i kundtjänst (chat_sessions och profiles)

-- 1. Utöka chat_sessions
ALTER TABLE public.chat_sessions 
ADD COLUMN IF NOT EXISTS ticket_type TEXT DEFAULT 'chat',
ADD COLUMN IF NOT EXISTS inbound_address TEXT,
ADD COLUMN IF NOT EXISTS customer_email TEXT,
ADD COLUMN IF NOT EXISTS email_subject TEXT;

-- 2. Utöka profiles för agentbehörigheter
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS handles_chat BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS handles_email BOOLEAN DEFAULT false;

-- 3. Uppdatera admin_get_all_users() så att den returnerar de nya fälten
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
    handles_email BOOLEAN
) AS $$
BEGIN
    -- Säkerhetskontroll (endast system_admins)
    IF NOT EXISTS (SELECT 1 FROM public.system_admins sa WHERE sa.email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    RETURN QUERY
    SELECT 
        u.id, 
        CAST(u.email AS VARCHAR) as email,
        u.created_at, 
        u.last_sign_in_at,
        (u.banned_until IS NOT NULL AND u.banned_until > now()) as is_blocked,
        -- VIP = om de tillhör ett hushåll med is_vip = true ELLER om en override finns
        (
           EXISTS (
               SELECT 1 FROM public.households h 
               JOIN public.accounts a ON a.household_id = h.id 
               WHERE a.id = u.id AND h.is_vip = true
           ) 
           OR 
           EXISTS (
               SELECT 1 FROM public.vip_email_overrides v 
               WHERE v.email = u.email
           )
        ) as is_vip,
        -- Admin = om de finns i system_admins
        EXISTS (SELECT 1 FROM public.system_admins sa WHERE sa.email = u.email) as is_admin,
        -- chat_agent = flagga i profiles
        COALESCE((SELECT pr.chat_agent FROM public.profiles pr WHERE pr.id = u.id), false) as chat_agent,
        COALESCE((SELECT pr.handles_chat FROM public.profiles pr WHERE pr.id = u.id), true) as handles_chat,
        COALESCE((SELECT pr.handles_email FROM public.profiles pr WHERE pr.id = u.id), false) as handles_email
    FROM auth.users u
    ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
ALTER FUNCTION public.admin_get_all_users() SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.admin_get_all_users() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_all_users() TO authenticated;

-- 4. Uppdatera toggle_chat_agent() för att inkludera de nya behörigheterna
DROP FUNCTION IF EXISTS public.toggle_chat_agent(text, boolean);
DROP FUNCTION IF EXISTS public.toggle_chat_agent(text, boolean, boolean, boolean);

CREATE OR REPLACE FUNCTION toggle_chat_agent(target_email TEXT, enable BOOLEAN, p_handles_chat BOOLEAN DEFAULT true, p_handles_email BOOLEAN DEFAULT false)
RETURNS VOID AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- 1. Verify caller is system admin
  IF NOT EXISTS (
    SELECT 1 FROM public.system_admins sa 
    JOIN auth.users u ON u.email = sa.email 
    WHERE u.id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- 2. Find target user
  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- 3. Update or insert into profiles
  UPDATE public.profiles 
  SET 
      chat_agent = enable,
      handles_chat = p_handles_chat,
      handles_email = p_handles_email
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, chat_agent, handles_chat, handles_email) 
    VALUES (target_user_id, enable, p_handles_chat, p_handles_email);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
ALTER FUNCTION public.toggle_chat_agent(text, boolean, boolean, boolean) SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.toggle_chat_agent(text, boolean, boolean, boolean) FROM public, anon;

-- 5. Uppdatera auto_assign_oldest_chat()
DROP FUNCTION IF EXISTS public.auto_assign_oldest_chat();

CREATE OR REPLACE FUNCTION auto_assign_oldest_chat()
RETURNS JSONB AS $$
DECLARE
    v_agent_id UUID;
    v_session_id UUID;
    v_can_chat BOOLEAN;
    v_can_email BOOLEAN;
BEGIN
    v_agent_id := auth.uid();
    
    -- Kolla att agenten finns och vad den får hantera
    SELECT handles_chat, handles_email INTO v_can_chat, v_can_email
    FROM profiles WHERE id = v_agent_id AND chat_agent = true;

    IF v_can_chat IS NULL THEN
        RAISE EXCEPTION 'Not an active chat agent';
    END IF;

    -- Leta upp det äldsta ärendet som är "waiting" OCH matchar agentens behörigheter
    SELECT id INTO v_session_id
    FROM chat_sessions
    WHERE status = 'waiting'
      AND (
          (v_can_chat = true AND ticket_type = 'chat')
          OR 
          (v_can_email = true AND ticket_type = 'email')
      )
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_session_id IS NOT NULL THEN
        UPDATE chat_sessions
        SET status = 'active',
            agent_id = v_agent_id,
            updated_at = NOW()
        WHERE id = v_session_id;

        -- Skicka systemmeddelande om tilldelning
        INSERT INTO chat_messages (session_id, sender_id, sender_role, message)
        VALUES (v_session_id, v_agent_id, 'system', 'En agent har tagit över ärendet.');

        -- Uppdatera agentens status till busy
        UPDATE chat_agents_status SET status = 'busy', last_ping = NOW() WHERE agent_id = v_agent_id;

        RETURN jsonb_build_object('success', true, 'session_id', v_session_id);
    END IF;

    RETURN jsonb_build_object('success', false, 'message', 'No waiting sessions found for your assigned queues');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
ALTER FUNCTION public.auto_assign_oldest_chat() SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.auto_assign_oldest_chat() FROM public, anon;
