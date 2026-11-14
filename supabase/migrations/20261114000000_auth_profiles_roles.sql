-- Authentication only: user profiles and staff roles.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  full_name text,
  country text,
  verification_status text not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  create type public.app_role as enum ('admin', 'super_admin');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

-- Users read and update only their own profile.
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Users can see their own roles; nobody can write roles from the client.
drop policy if exists "user_roles: read own" on public.user_roles;
create policy "user_roles: read own" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

-- Clients may only change these profile columns (not email, status, ids).
revoke update on public.profiles from authenticated, anon;
grant select on public.profiles to authenticated;
grant update (first_name, last_name, full_name, country) on public.profiles to authenticated;
revoke all on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;

-- Create a profile for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  fn text := new.raw_user_meta_data ->> 'first_name';
  ln text := new.raw_user_meta_data ->> 'last_name';
begin
  insert into public.profiles (id, email, first_name, last_name, full_name, country)
  values (
    new.id, new.email, fn, ln,
    coalesce(nullif(trim(concat_ws(' ', fn, ln)), ''), new.raw_user_meta_data ->> 'full_name'),
    new.raw_user_meta_data ->> 'country'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Keep profile email in sync and stamp updates.
create or replace function public.touch_profile()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_profile();

-- Staff check used by the admin sign-in.
create or replace function public.my_staff_role()
returns text language sql stable security definer set search_path = public as $$
  select role::text from public.user_roles
  where user_id = auth.uid()
  order by case role when 'super_admin' then 0 else 1 end
  limit 1
$$;
revoke all on function public.my_staff_role() from public, anon;
grant execute on function public.my_staff_role() to authenticated;
