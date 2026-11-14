-- Bids: no longer readable by anonymous visitors (they exposed user ids).
drop policy if exists "bids public read" on public.bids;
create policy "bids read authenticated" on public.bids
  for select to authenticated using (true);
revoke select on public.bids from anon;

-- Notifications: recipients (and admins) only; no blanket chat visibility.
drop policy if exists "notifications read own admin or chat" on public.notifications;
create policy "notifications read own or admin" on public.notifications
  for select to authenticated
  using (user_id = auth.uid() or has_role(auth.uid(), 'admin'));

-- Notifications: you may only create notifications addressed to yourself,
-- unless you are an admin.
drop policy if exists "notifications create authenticated" on public.notifications;
create policy "notifications create own or admin" on public.notifications
  for insert to authenticated
  with check (user_id = auth.uid() or has_role(auth.uid(), 'admin'));

-- Reports must be attributed to the submitting user.
drop policy if exists "reports create authenticated" on public.reports;
create policy "reports create own" on public.reports
  for insert to authenticated
  with check (created_by = auth.uid());