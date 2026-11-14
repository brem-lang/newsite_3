revoke execute on function public.admin_dashboard(timestamptz, timestamptz) from authenticated;
revoke execute on function public.admin_dashboard(timestamptz, timestamptz) from anon;
revoke execute on function public.admin_dashboard(timestamptz, timestamptz) from public;
grant execute on function public.admin_dashboard(timestamptz, timestamptz) to service_role;