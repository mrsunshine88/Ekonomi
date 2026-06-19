ALTER FUNCTION public.sync_chat_open_from_agents() SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.sync_chat_open_from_agents() FROM public, anon;
