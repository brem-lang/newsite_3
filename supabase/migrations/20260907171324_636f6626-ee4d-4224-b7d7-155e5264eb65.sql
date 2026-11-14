grant select (
  id, title, description, image_url, category_id, brand_id,
  entry_fee, max_subscribers, min_participants,
  start_price, current_price, bid_increment, target_price,
  duration_minutes, status, start_time, scheduled_start_time, end_time,
  featured, featured_order, round, mode,
  bid_fee, bids_per_participant, extra_bid_price,
  bid_rate_limit, bid_rate_window_minutes, min_round_minutes,
  pool_warn_pct, restart_count, max_restarts, anti_snipe_seconds,
  winner_name, paid, created_date, updated_date, subscriber_ids
) on public.auctions to anon;

alter view public.auctions_public set (security_invoker = on);