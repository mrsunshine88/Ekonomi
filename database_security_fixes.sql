-- ==============================================================================
-- Supabase Security Linter Fixes (v2 - Komplett)
-- Åtgärdar: function_search_path_mutable
-- Åtgärdar: anon_security_definer_function_executable
-- Åtgärdar: authenticated_security_definer_function_executable (admin-funktioner)
-- ==============================================================================

-- 1. FIXA SÖKVÄG (search_path)
-- Säkrar upp funktionerna så de inte kan bli "kapade" av illvilliga scheman
ALTER FUNCTION public.add_system_admin(text) SET search_path = public;
ALTER FUNCTION public.check_email_confirmed(text) SET search_path = public;
ALTER FUNCTION public.delete_admin_secret(character varying) SET search_path = public;
ALTER FUNCTION public.delete_user() SET search_path = public;
ALTER FUNCTION public.get_admin_stats() SET search_path = public;
ALTER FUNCTION public.get_system_admins() SET search_path = public;
ALTER FUNCTION public.get_vip_emails() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.is_user_admin() SET search_path = public;
ALTER FUNCTION public.remove_system_admin(text) SET search_path = public;
ALTER FUNCTION public.revoke_household_vip_by_email(character varying) SET search_path = public;
ALTER FUNCTION public.revoke_household_vip_by_email(text) SET search_path = public;
ALTER FUNCTION public.set_admin_secret(character varying, character varying) SET search_path = public;
ALTER FUNCTION public.set_global_setting(character varying, character varying) SET search_path = public;
ALTER FUNCTION public.set_household_vip_by_email(character varying) SET search_path = public;
ALTER FUNCTION public.toggle_paywall(boolean) SET search_path = public;
ALTER FUNCTION public.toggle_share_private_economy(boolean) SET search_path = public;
ALTER FUNCTION public.user_in_household(uuid) SET search_path = public;
ALTER FUNCTION public.update_chat_session_timestamp() SET search_path = public;
ALTER FUNCTION public.set_user_role(uuid, text) SET search_path = public;



-- 2. ÅTERKALLA EXEKVERING FRÅN ANONYMA (anon)
-- Ingen okänd gäst ska kunna ropa på dessa backend-funktioner
REVOKE EXECUTE ON FUNCTION public.add_system_admin(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_email_confirmed(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_admin_secret(character varying) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_system_admins() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_vip_emails() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_user_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_system_admin(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_household_vip_by_email(character varying) FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_household_vip_by_email(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_admin_secret(character varying, character varying) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_global_setting(character varying, character varying) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_household_vip_by_email(character varying) FROM anon;
REVOKE EXECUTE ON FUNCTION public.toggle_paywall(boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.toggle_share_private_economy(boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_in_household(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_chat_session_timestamp() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, text) FROM anon;


-- 3. ÅTERKALLA EXEKVERING FRÅN INLOGGADE (authenticated) — BARA ADMIN-FUNKTIONER
-- Vanliga inloggade användare ska inte ens kunna skicka ett nätverksanrop mot dessa.
-- OBS: delete_user, toggle_share_private_economy, user_in_household, update_chat_session_timestamp
--      och check_email_confirmed är UNDANTAGNA — de behövs av vanliga inloggade användare.
REVOKE EXECUTE ON FUNCTION public.add_system_admin(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_system_admin(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_system_admins() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_stats() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_admin_secret(character varying, character varying) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_admin_secret(character varying) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_vip_emails() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_household_vip_by_email(character varying) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_household_vip_by_email(character varying) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_household_vip_by_email(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.toggle_paywall(boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_global_setting(character varying, character varying) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_user_admin() FROM authenticated;
