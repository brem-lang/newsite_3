-- Anonymous visitors must not read internal cost data or participant identities.
revoke select on public.auctions from anon;

create or replace view public.auctions_public
with (security_invoker = off) as
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
  coalesce(array_length(a.subscriber_ids, 1), 0) as subscriber_count
from public.auctions a;

grant select on public.auctions_public to anon, authenticated;