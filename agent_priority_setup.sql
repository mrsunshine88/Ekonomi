-- 1. Lägg till prio-kolumner
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS prio_chat INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS prio_email INTEGER DEFAULT 1;

-- 2. Uppdatera admin_get_all_users
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
    prio_chat INTEGER,
    prio_email INTEGER
) AS $$
BEGIN
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
        EXISTS (
           SELECT 1 FROM public.households h 
           JOIN public.profiles p ON p.household_id = h.id 
           WHERE p.id = u.id AND h.stripe_status = 'vip'
        ) as is_vip,
        EXISTS (SELECT 1 FROM public.system_admins sa WHERE sa.user_id = u.id) as is_admin,
        COALESCE((SELECT pr.chat_agent FROM public.profiles pr WHERE pr.id = u.id), false) as chat_agent,
        COALESCE((SELECT pr.handles_chat FROM public.profiles pr WHERE pr.id = u.id), true) as handles_chat,
        COALESCE((SELECT pr.handles_email FROM public.profiles pr WHERE pr.id = u.id), false) as handles_email,
        COALESCE((SELECT pr.prio_chat FROM public.profiles pr WHERE pr.id = u.id), 1) as prio_chat,
        COALESCE((SELECT pr.prio_email FROM public.profiles pr WHERE pr.id = u.id), 1) as prio_email
    FROM auth.users u
    ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Uppdatera toggle_chat_agent
DROP FUNCTION IF EXISTS public.toggle_chat_agent(text, boolean, boolean, boolean);
DROP FUNCTION IF EXISTS public.toggle_chat_agent(text, boolean, boolean, boolean, integer, integer);

CREATE OR REPLACE FUNCTION toggle_chat_agent(target_email TEXT, enable BOOLEAN, p_handles_chat BOOLEAN DEFAULT true, p_handles_email BOOLEAN DEFAULT false, p_prio_chat INTEGER DEFAULT 1, p_prio_email INTEGER DEFAULT 1)
RETURNS VOID AS $$
DECLARE
  target_user_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.system_admins sa WHERE sa.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  UPDATE public.profiles 
  SET 
      chat_agent = enable,
      handles_chat = p_handles_chat,
      handles_email = p_handles_email,
      prio_chat = p_prio_chat,
      prio_email = p_prio_email
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, chat_agent, handles_chat, handles_email, prio_chat, prio_email) 
    VALUES (target_user_id, enable, p_handles_chat, p_handles_email, p_prio_chat, p_prio_email);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Uppdatera auto_assign_oldest_chat med prio
DROP FUNCTION IF EXISTS public.auto_assign_oldest_chat();

CREATE OR REPLACE FUNCTION auto_assign_oldest_chat()
RETURNS chat_sessions AS $$
DECLARE
  v_session chat_sessions;
  v_my_status TEXT;
  v_can_chat BOOLEAN;
  v_can_email BOOLEAN;
  v_prio_chat INTEGER;
  v_prio_email INTEGER;
BEGIN
  -- Ensure caller is available
  SELECT status INTO v_my_status FROM agent_sessions WHERE agent_id = auth.uid();
  IF v_my_status != 'available' THEN
    RETURN NULL;
  END IF;

  -- Kolla att agenten finns, vad den får hantera och dess prioriteringar
  SELECT handles_chat, handles_email, COALESCE(prio_chat, 1), COALESCE(prio_email, 1) 
  INTO v_can_chat, v_can_email, v_prio_chat, v_prio_email
  FROM profiles WHERE id = auth.uid() AND chat_agent = true;

  IF v_can_chat IS NULL THEN
    RETURN NULL;
  END IF;

  -- Hitta det äldsta ärendet baserat på högsta prioritet först
  UPDATE chat_sessions
  SET status = 'assigned', assigned_to = auth.uid(), assigned_name = (SELECT email FROM profiles WHERE id = auth.uid()), updated_at = NOW()
  WHERE id = (
    SELECT id FROM chat_sessions 
    WHERE status = 'waiting' 
      AND (
          (v_can_chat = true AND (ticket_type = 'chat' OR ticket_type IS NULL))
          OR 
          (v_can_email = true AND ticket_type = 'email')
      )
    ORDER BY 
      CASE 
        WHEN ticket_type = 'email' THEN v_prio_email
        ELSE v_prio_chat
      END DESC,
      created_at ASC 
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO v_session;

  -- Ensure agent gets busy state
  IF FOUND THEN
    UPDATE agent_sessions SET status = 'busy', updated_at = NOW() WHERE agent_id = auth.uid();
  END IF;

  RETURN v_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sätt rättigheter
ALTER FUNCTION public.auto_assign_oldest_chat() SET search_path = public;
GRANT EXECUTE ON FUNCTION public.auto_assign_oldest_chat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_chat_agent(text, boolean, boolean, boolean, integer, integer) TO authenticated;
