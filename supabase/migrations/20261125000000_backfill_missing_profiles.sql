-- Server-side paging for the admin Users / Participants tables.
--
-- listUsers used to download up to 1000 auth users on every call just to find
-- signups whose profile row was never created (accounts made before the
-- handle_new_user trigger existed). This does the same backfill in one SQL
-- statement, so listUsers can page straight from public.profiles.
create or replace function public.backfill_missing_profiles()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare inserted integer;
begin
  insert into public.profiles (id, email, full_name, first_name, last_name, country, country_code, phone, whatsapp_country_code, whatsapp_number, created_date)
  select u.id, u.email,
    coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name',
      nullif(trim(concat_ws(' ', u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'last_name')), '')),
    u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'last_name',
    u.raw_user_meta_data->>'country', u.raw_user_meta_data->>'country_code',
    coalesce(u.phone, u.raw_user_meta_data->>'phone'), u.raw_user_meta_data->>'whatsapp_country_code',
    u.raw_user_meta_data->>'whatsapp_number', u.created_at
  from auth.users u
  where not exists (select 1 from public.profiles p where p.id = u.id)
  on conflict (id) do nothing;
  get diagnostics inserted = row_count;

  insert into public.user_roles (user_id, role)
  select u.id, 'user' from auth.users u
  where not exists (select 1 from public.user_roles r where r.user_id = u.id)
  on conflict do nothing;
  return inserted;
end; $$;

revoke all on function public.backfill_missing_profiles() from public, anon, authenticated;
grant execute on function public.backfill_missing_profiles() to service_role;

-- Search and sort columns used by the paged listUsers.
create index if not exists profiles_created_date_idx on public.profiles (created_date desc);
create index if not exists profiles_verification_status_idx on public.profiles (verification_status);
create index if not exists participant_notes_user_id_idx on public.participant_notes (user_id);
