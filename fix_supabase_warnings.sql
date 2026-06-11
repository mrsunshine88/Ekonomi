-- 1. Fix: Function Search Path Mutable
-- Sätter 'search_path = ''' på alla RPC-funktioner för att förhindra SQL-injections via spoofing av schemas.
ALTER FUNCTION public.set_admin_secret(character varying, character varying) SET search_path = '';
ALTER FUNCTION public.toggle_paywall(boolean) SET search_path = '';
ALTER FUNCTION public.set_household_vip_by_email(character varying) SET search_path = '';
ALTER FUNCTION public.set_user_role(uuid, text) SET search_path = '';
ALTER FUNCTION public.toggle_share_private_economy(boolean) SET search_path = '';
ALTER FUNCTION public.revoke_household_vip_by_email(text) SET search_path = '';
ALTER FUNCTION public.get_vip_emails() SET search_path = '';
ALTER FUNCTION public.get_admin_stats() SET search_path = '';
ALTER FUNCTION public.set_global_setting(character varying, character varying) SET search_path = '';
ALTER FUNCTION public.delete_user() SET search_path = '';
ALTER FUNCTION public.user_in_household(uuid) SET search_path = '';

-- 2. Fix: Public Can Execute SECURITY DEFINER Function
-- Revokar standard-åtkomsten från "public" och "anon" (oidentifierade användare) 
-- och tillåter ENDAST att inloggade ("authenticated") användare ens försöker köra dem.
REVOKE EXECUTE ON FUNCTION public.get_admin_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_admin_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_vip_emails() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_vip_emails() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_vip_emails() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.revoke_household_vip_by_email(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revoke_household_vip_by_email(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.revoke_household_vip_by_email(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_admin_secret(character varying, character varying) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_admin_secret(character varying, character varying) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_admin_secret(character varying, character varying) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_global_setting(character varying, character varying) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_global_setting(character varying, character varying) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_global_setting(character varying, character varying) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_household_vip_by_email(character varying) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_household_vip_by_email(character varying) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_household_vip_by_email(character varying) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.toggle_paywall(boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.toggle_paywall(boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.toggle_paywall(boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.toggle_share_private_economy(boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.toggle_share_private_economy(boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.toggle_share_private_economy(boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_user() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_in_household(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_in_household(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_in_household(uuid) TO authenticated;
