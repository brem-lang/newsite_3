alter table public.auctions add column if not exists subscriber_count integer not null default 0;

update public.auctions set subscriber_count = coalesce(array_length(subscriber_ids, 1), 0);

create or replace function public.sync_subscriber_count()
returns trigger language plpgsql set search_path = public as $$
begin
  new.subscriber_count := coalesce(array_length(new.subscriber_ids, 1), 0);
  return new;
end; $$;

drop trigger if exists sync_subscriber_count on public.auctions;
create trigger sync_subscriber_count before insert or update on public.auctions
for each row execute function public.sync_subscriber_count();

grant select (subscriber_count) on public.auctions to anon;

create or replace view public.auctions_public
with (security_invoker = on) as
select
  a.id, a.title, a.description, a.image_url, a.category_id, a.brand_id,
  a.entry_fee, a.max_subscribers, a.min_participants,
  a.start_price, a.current_price, a.bid_increment, a.target_price,
  a.duration_minutes, a.status, a.start_time, a.scheduled_start_time, a.end_time,
  a.featured, a.featured_order, a.round, a.mode,
  a.bid_fee, a.bids_per_participant, a.extra_bid_price,
  a.bid_rate_limit, a.bid_rate_window_minutes, a.min_round_minutes,
  a.pool_warn_pct, a.restart_count, a.max_restarts, a.anti_snipe_seconds,
  a.winner_name, a.paid, a.created_date, a.updated_date,
  a.subscriber_count
from public.auctions a;

grant select on public.auctions_public to anon, authenticated;