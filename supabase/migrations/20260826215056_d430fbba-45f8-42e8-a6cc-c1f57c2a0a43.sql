revoke execute on function public.handle_new_user() from public;
revoke execute on function public.protect_profile_columns() from public;
revoke execute on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;