insert into public.site_settings (key, site_name, tagline, contact_email, active_currency)
values ('global', 'Mazady', 'Live online auctions', 'support@mazady.app', 'USD');

-- Bootstrap: the very first account created becomes an admin so the
-- admin dashboard is reachable on a fresh install.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare existing_count integer;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;

  select count(*) into existing_count from public.user_roles;
  if existing_count = 0 then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end; $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;