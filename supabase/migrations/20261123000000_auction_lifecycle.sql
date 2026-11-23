-- Auction lifecycle (Auction_Lifecycle_Specification, 2026-11-21).
--
-- open -> live -> ended -> (Relaunch) open as the next round | archived
--                       \-> voided -> (Relaunch) open | archived
--
-- * Nothing reopens an ended auction by itself any more (the old
--   reopenLastEndedIfAllEnded is gone from functions/api/handlers.ts).
-- * Status changes go through the api function's actions (startAuction,
--   closeAuction, relaunchAuction, archiveAuction) which audit every one.
--   Browser sessions can no longer write status directly (trigger below).
-- * Each finished round is kept in auction_rounds, so relaunching the same
--   row as the next round never loses the previous winner / price.

-- 1. Columns -----------------------------------------------------------------

alter table public.auctions
  add column if not exists relaunch_count integer not null default 0;

-- Who caused an audit entry: 'admin' (a staff member), 'system' (clock / tick).
alter table public.activity_logs
  add column if not exists source text not null default 'admin';
create index if not exists activity_logs_source_idx
  on public.activity_logs (source, created_date desc);
create index if not exists activity_logs_target_idx
  on public.activity_logs (target_type, target_id, created_date desc);

-- Fulfilments belong to one round: the same user can win round 1 and round 2.
alter table public.fulfilments add column if not exists round integer;
update public.fulfilments f
   set round = coalesce(a.round, 1)
  from public.auctions a
 where a.id = f.auction_id and f.round is null;

-- 2. Round history -------------------------------------------------------------

create table if not exists public.auction_rounds (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  round integer not null,
  outcome text not null check (outcome in ('won', 'no_winner', 'voided')),
  winner_id uuid,
  winner_name text,
  final_price numeric,
  start_time timestamptz,
  end_time timestamptz,
  ended_at timestamptz not null default now(),
  subscriber_count integer not null default 0,
  payment_id uuid,
  -- Ended by the tick well after its end time (server was down): a recovery end.
  recovered boolean not null default false,
  created_date timestamptz not null default now(),
  unique (auction_id, round)
);
alter table public.auction_rounds enable row level security;
drop policy if exists "Admins read auction rounds" on public.auction_rounds;
create policy "Admins read auction rounds" on public.auction_rounds
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
grant select on public.auction_rounds to authenticated;

-- Rounds that already ended before this migration.
insert into public.auction_rounds
  (auction_id, round, outcome, winner_id, winner_name, final_price, start_time, end_time, ended_at, subscriber_count)
select a.id, coalesce(a.round, 1),
       case when a.status = 'voided' then 'voided' when a.winner_id is not null then 'won' else 'no_winner' end,
       a.winner_id, a.winner_name, a.current_price, a.start_time, a.end_time,
       coalesce(a.end_time, a.updated_date), coalesce(array_length(a.subscriber_ids, 1), 0)
  from public.auctions a
 where a.status in ('ended', 'voided')
on conflict (auction_id, round) do nothing;

-- 3. Guard browser writes ------------------------------------------------------
-- Staff edit auctions straight through the REST API, so the rules live here.
-- Only browser sessions (anon / authenticated) are limited: the api function
-- (service_role), pg_cron and migrations are not.

create or replace function public.guard_auction_writes()
returns trigger
language plpgsql
as $$
declare
  claims text := nullif(current_setting('request.jwt.claims', true), '');
  caller text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    case when claims is null then null else claims::jsonb ->> 'role' end
  );
begin
  if caller is null or caller not in ('anon', 'authenticated') then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'open' then
      raise exception 'A new auction starts as Open. Start it from the auctions list.';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status <> 'open' or old.start_time is not null or coalesce(old.round, 1) > 1 then
      raise exception 'An auction that has run cannot be deleted. Archive it instead.';
    end if;
    return old;
  end if;

  -- UPDATE
  if new.status is distinct from old.status then
    raise exception 'Change an auction''s status with Start, End now, Relaunch or Archive.';
  end if;
  if new.round is distinct from old.round
     or new.relaunch_count is distinct from old.relaunch_count
     or new.start_time is distinct from old.start_time
     or new.end_time is distinct from old.end_time
     or new.winner_id is distinct from old.winner_id
     or new.highest_bidder_id is distinct from old.highest_bidder_id
     or new.current_price is distinct from old.current_price
     or new.subscriber_ids is distinct from old.subscriber_ids then
    raise exception 'Round, timer, price, winner and participants are managed by the server.';
  end if;
  if old.status = 'live' and (
       new.start_price is distinct from old.start_price
    or new.bid_increment is distinct from old.bid_increment
    or new.duration_minutes is distinct from old.duration_minutes
    or new.max_subscribers is distinct from old.max_subscribers
    or new.min_participants is distinct from old.min_participants
    or new.entry_fee is distinct from old.entry_fee
    or new.bid_fee is distinct from old.bid_fee
    or new.extra_bid_price is distinct from old.extra_bid_price
    or new.mode is distinct from old.mode
    or new.target_price is distinct from old.target_price
    or new.bids_per_participant is distinct from old.bids_per_participant
  ) then
    raise exception 'Price, duration, seats and fees are locked while the auction is live. Only the title, description and image can change.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_auction_writes on public.auctions;
create trigger guard_auction_writes
  before insert or update or delete on public.auctions
  for each row execute function public.guard_auction_writes();

-- 4. Live admin notifications --------------------------------------------------
-- The admin bell listens for system events (auction ended / started / voided,
-- nothing left live). Realtime applies the table's RLS (staff only).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_logs'
  ) then
    alter publication supabase_realtime add table public.activity_logs;
  end if;
end $$;
