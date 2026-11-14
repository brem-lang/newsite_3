create table if not exists public.auction_messages (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null,
  user_id uuid not null default auth.uid(),
  author_name text,
  body text not null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

grant select, insert on public.auction_messages to authenticated;
grant all on public.auction_messages to service_role;

alter table public.auction_messages enable row level security;

create policy "auction messages read authenticated" on public.auction_messages
  for select to authenticated using (true);
create policy "auction messages insert own" on public.auction_messages
  for insert to authenticated with check (user_id = auth.uid());
create policy "auction messages admin delete" on public.auction_messages
  for delete to authenticated using (has_role(auth.uid(), 'admin'));

create index if not exists auction_messages_auction_idx
  on public.auction_messages (auction_id, created_date);

alter publication supabase_realtime add table public.auction_messages;