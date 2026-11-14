REVOKE ALL ON FUNCTION public.has_admin_capability(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_admin_capability(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.my_admin_capabilities() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_admin_capabilities() TO authenticated, service_role;