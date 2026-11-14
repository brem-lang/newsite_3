CREATE OR REPLACE FUNCTION public.my_admin_capabilities_for(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select coalesce(array_agg(c.key order by c.sort_order), '{}')
  from public.admin_capabilities c
  where public.has_admin_capability(_user_id, c.key);
$function$;

REVOKE ALL ON FUNCTION public.my_admin_capabilities_for(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_admin_capabilities_for(uuid) TO service_role;