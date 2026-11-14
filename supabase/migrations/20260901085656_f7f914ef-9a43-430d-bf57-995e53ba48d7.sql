create or replace function public.place_ascending_bid(_auction_id uuid, _user_id uuid, _amount numeric, _client_request_id text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a public.auctions;
  min_next numeric;
  prev_bidder uuid;
  rate_lim integer;
  rate_win integer;
  rate_used integer;
  win_start timestamptz;
  retry_after integer;
  dup public.bids;
  snipe integer;
  new_end timestamptz;
  extended boolean := false;
  base_quota integer;
  extra integer;
  quota integer;
  used integer;
  fee numeric;
  bal numeric;
begin
  if _client_request_id is not null then
    select * into dup from public.bids
    where auction_id = _auction_id and user_id = _user_id and client_request_id = _client_request_id
    limit 1;
    if found then
      select * into a from public.auctions where id = _auction_id;
      return jsonb_build_object('ok', true, 'duplicate', true,
        'current_price', coalesce(a.current_price, dup.amount), 'prev_bidder', null);
    end if;
  end if;

  select * into a from public.auctions where id = _auction_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if a.status = 'ended' then
    return jsonb_build_object('ok', false, 'error', 'Auction ended');
  end if;
  if a.status <> 'live' or a.end_time is null then
    return jsonb_build_object('ok', false, 'error', 'not_live');
  end if;
  if now() >= a.end_time then
    return jsonb_build_object('ok', false, 'error', 'Auction ended');
  end if;
  if not (_user_id::text = any(a.subscriber_ids)) then
    return jsonb_build_object('ok', false, 'error', 'not_subscribed');
  end if;

  rate_lim := coalesce(a.bid_rate_limit, 0);
  rate_win := greatest(coalesce(a.bid_rate_window_minutes, 10), 1);
  if rate_lim > 0 then
    win_start := public.bid_window_start(rate_win);
    select count(*) into rate_used
    from public.bids
    where auction_id = _auction_id
      and user_id = _user_id
      and archived = false
      and created_date >= win_start;
    if coalesce(rate_used, 0) >= rate_lim then
      retry_after := greatest(ceil(extract(epoch from (win_start + make_interval(mins => rate_win) - now())))::int, 1);
      return jsonb_build_object('ok', false, 'error', 'rate_limited',
        'limit', rate_lim, 'window_minutes', rate_win, 'retry_after', retry_after);
    end if;
  end if;

  -- Free bids per round, then paid extra bids. The bid itself is never held or
  -- charged: the winner pays afterwards through their payment link.
  base_quota := greatest(coalesce(a.bids_per_participant, 0), 0);
  if base_quota > 0 then
    select coalesce(credits, 0) into extra
    from public.bid_credits
    where auction_id = _auction_id and user_id = _user_id and round = coalesce(a.round, 1);
    quota := base_quota + coalesce(extra, 0);

    select count(*) into used
    from public.bids
    where auction_id = _auction_id
      and round = coalesce(a.round, 1)
      and archived = false
      and user_id = _user_id;

    if coalesce(used, 0) >= quota then
      return jsonb_build_object('ok', false, 'error', 'quota_reached', 'quota', quota,
        'used', coalesce(used, 0), 'extra_price', coalesce(a.extra_bid_price, 0));
    end if;
  end if;

  fee := coalesce(a.bid_fee, 0);
  if fee > 0 then
    select public.available_balance(_user_id) into bal;
    if bal < fee then
      return jsonb_build_object('ok', false, 'error', 'insufficient_funds_for_fee', 'balance', bal, 'fee', fee);
    end if;
  end if;

  min_next := coalesce(nullif(a.current_price, 0), a.start_price, 0) + coalesce(a.bid_increment, 0);
  if _amount < min_next then
    return jsonb_build_object('ok', false, 'error', 'tooLow', 'min_next', min_next);
  end if;

  prev_bidder := a.highest_bidder_id;

  insert into public.bids (auction_id, user_id, amount, round, client_request_id)
  values (_auction_id, _user_id, _amount, coalesce(a.round, 1), _client_request_id);

  if fee > 0 then
    insert into public.wallet_transactions (user_id, type, amount, description, auction_id, status)
    values (_user_id, 'bid_fee', -abs(fee), 'Bid fee: ' || a.title, a.id, 'confirmed');
  end if;

  -- Anti-sniping: a bid in the closing seconds pushes the deadline forward.
  snipe := greatest(coalesce(a.anti_snipe_seconds, 0), 0);
  new_end := a.end_time;
  if snipe > 0 and a.end_time - now() < make_interval(secs => snipe) then
    new_end := now() + make_interval(secs => snipe);
    extended := true;
  end if;

  update public.auctions
  set current_price = _amount,
      highest_bidder_id = _user_id,
      end_time = new_end
  where id = _auction_id;

  return jsonb_build_object('ok', true, 'current_price', _amount, 'prev_bidder', prev_bidder,
    'end_time', new_end, 'extended', extended, 'anti_snipe_seconds', snipe,
    'fee', fee, 'held', 0);
end;
$function$;

create or replace function public.buy_bid_credits(_auction_id uuid, _user_id uuid, _count integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a public.auctions;
  price numeric;
  total numeric;
  bal numeric;
  newc integer;
begin
  if _count is null or _count < 1 then
    return jsonb_build_object('ok', false, 'error', 'invalid_count');
  end if;

  select * into a from public.auctions where id = _auction_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if a.status <> 'live' or a.end_time is null or now() >= a.end_time then
    return jsonb_build_object('ok', false, 'error', 'Auction ended');
  end if;
  if not (_user_id::text = any(a.subscriber_ids)) then
    return jsonb_build_object('ok', false, 'error', 'not_subscribed');
  end if;

  price := coalesce(a.extra_bid_price, 0);
  if price <= 0 then
    return jsonb_build_object('ok', false, 'error', 'extra_bids_disabled');
  end if;
  total := round(price * _count, 2);

  perform pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));

  select public.available_balance(_user_id) into bal;

  if bal < total then
    return jsonb_build_object('ok', false, 'error', 'insufficient_funds_for_credits', 'balance', bal, 'total', total);
  end if;

  insert into public.bid_credits (auction_id, user_id, round, credits)
  values (_auction_id, _user_id, coalesce(a.round, 1), _count)
  on conflict (auction_id, user_id, round)
  do update set credits = public.bid_credits.credits + excluded.credits
  returning credits into newc;

  insert into public.wallet_transactions (user_id, type, amount, description, auction_id, status)
  values (_user_id, 'bid_credits', -abs(total), _count || ' extra bids: ' || a.title, a.id, 'confirmed');

  return jsonb_build_object('ok', true, 'credits', newc, 'charged', total, 'price', price, 'balance', round(bal - total, 2));
end;
$function$;