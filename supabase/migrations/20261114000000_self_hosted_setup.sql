-- Self-hosted setup on top of the restored schema (migrations above).

-- 1. New accounts are regular users only. The old trigger made the first
--    account to sign up an admin, which is unsafe on a fresh database.
create or replace function public.handle_new_user()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into public.profiles (id, email, full_name, first_name, last_name, country, country_code, phone, whatsapp_country_code, whatsapp_number)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name',
      nullif(trim(concat_ws(' ', new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name')), '')),
    new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'country', new.raw_user_meta_data->>'country_code',
    new.raw_user_meta_data->>'phone', new.raw_user_meta_data->>'whatsapp_country_code',
    new.raw_user_meta_data->>'whatsapp_number')
  on conflict (id) do nothing;
  -- Staff roles are granted by an admin only.
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end; $function$;

-- 2. English-only site with no demo content: drop the sample auctions,
--    translate the default categories, drop the seeded cron token.
delete from public.auctions;
update public.categories set name = v.name, description = v.descr from (values
  ('electronics','Electronics','Phones, computers and smart devices'),
  ('watches','Watches','Luxury and classic watches'),
  ('cars','Cars','Cars and vehicles'),
  ('jewellery','Jewellery','Gold, diamonds and jewellery')) v(slug, name, descr)
 where categories.slug = v.slug;
delete from public.cron_tokens;

-- Staff check for the /admin sign-in (runs as the signed-in user).
create or replace function public.my_staff_access()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.has_role(auth.uid(), 'admin') then
    jsonb_build_object(
      'is_admin', true,
      'is_super', coalesce(p.is_super, false),
      'staff_role', coalesce(p.staff_role, case when p.is_super then 'super_admin' else 'admin' end),
      'capabilities', to_jsonb(public.my_admin_capabilities_for(auth.uid())))
  else jsonb_build_object('is_admin', false, 'is_super', false, 'staff_role', null, 'capabilities', '[]'::jsonb) end
  from (select 1) one left join public.profiles p on p.id = auth.uid()
$$;
revoke all on function public.my_staff_access() from public, anon;
grant execute on function public.my_staff_access() to authenticated;

-- Auction images: public read, staff write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('auction-images', 'auction-images', true, 10485760, array['image/png','image/jpeg','image/webp','image/gif','image/avif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "auction images public read" on storage.objects;
create policy "auction images public read" on storage.objects
  for select using (bucket_id = 'auction-images');
drop policy if exists "auction images staff insert" on storage.objects;
create policy "auction images staff insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'auction-images' and public.has_role(auth.uid(), 'admin'));
drop policy if exists "auction images staff update" on storage.objects;
create policy "auction images staff update" on storage.objects
  for update to authenticated using (bucket_id = 'auction-images' and public.has_role(auth.uid(), 'admin'));
drop policy if exists "auction images staff delete" on storage.objects;
create policy "auction images staff delete" on storage.objects
  for delete to authenticated using (bucket_id = 'auction-images' and public.has_role(auth.uid(), 'admin'));
