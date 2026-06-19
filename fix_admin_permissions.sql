-- Återställ rättigheter för inloggade användare att köra funktionerna
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_chat_agent(text, boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_connect() TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_disconnect() TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_set_status(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_assign_oldest_chat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_chat_open_from_agents() TO authenticated;
