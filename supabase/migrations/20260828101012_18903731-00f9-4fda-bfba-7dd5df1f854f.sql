create or replace function public.can_manage_media(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_super from public.profiles where id = _uid), false)
      or public.has_role(_uid, 'admin');
$$;

create policy "media read auth" on storage.objects for select to authenticated
using (bucket_id = 'auction-images');

create policy "media insert admins" on storage.objects for insert to authenticated
with check (bucket_id = 'auction-images' and public.can_manage_media(auth.uid()));

create policy "media update admins" on storage.objects for update to authenticated
using (bucket_id = 'auction-images' and public.can_manage_media(auth.uid()));

create policy "media delete admins" on storage.objects for delete to authenticated
using (bucket_id = 'auction-images' and public.can_manage_media(auth.uid()));