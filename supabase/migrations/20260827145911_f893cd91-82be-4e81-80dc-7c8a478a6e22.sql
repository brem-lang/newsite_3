alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists country_code text;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare existing_count int;
begin
  insert into public.profiles (id, email, full_name, first_name, last_name, country, country_code)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      nullif(trim(concat_ws(' ', new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name')), '')
    ),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'country_code'
  )
  on conflict (id) do nothing;

  select count(*) into existing_count from public.user_roles;
  if existing_count = 0 then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end; $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;