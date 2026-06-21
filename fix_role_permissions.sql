-- Fixar behörigheten så att inloggade hushållsägare faktiskt får ändra roller.
-- Detta revokades av misstag i det tidigare säkerhetsskriptet.

GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO authenticated;
