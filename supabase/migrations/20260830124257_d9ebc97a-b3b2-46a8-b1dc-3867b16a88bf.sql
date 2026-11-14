ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS bid_rate_limit integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bid_rate_window_minutes integer NOT NULL DEFAULT 10;

CREATE INDEX IF NOT EXISTS bids_rate_lookup_idx
  ON public.bids (auction_id, user_id, created_date DESC);

CREATE OR REPLACE FUNCTION public.bid_rate_status(_auction_id uuid, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  a public.auctions;
  lim integer;
  win integer;
  used integer;
  oldest timestamptz;
begin
  select * into a from public.auctions where id = _auction_id;
  if not found then
    return jsonb_build_object('limit', 0);
  end if;
  lim := coalesce(a.bid_rate_limit, 0);
  win := greatest(coalesce(a.bid_rate_window_minutes, 10), 1);
  if lim <= 0 then
    return jsonb_build_object('limit', 0, 'window_minutes', win);
  end if;
  select count(*), min(created_date) into used, oldest
  from public.bids
  where auction_id = _auction_id
    and user_id = _user_id
    and archived = false
    and created_date > now() - make_interval(mins => win);
  return jsonb_build_object(
    'limit', lim,
    'window_minutes', win,
    'used', coalesce(used, 0),
    'remaining', greatest(lim - coalesce(used, 0), 0),
    'retry_after', case
      when coalesce(used, 0) >= lim and oldest is not null
        then greatest(ceil(extract(epoch from (oldest + make_interval(mins => win) - now())))::int, 1)
      else 0 end
  );
end;
$function$;

GRANT EXECUTE ON FUNCTION public.bid_rate_status(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.place_closest_bid(_auction_id uuid, _user_id uuid, _amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a public.auctions;
  target numeric;
  inc numeric;
  existing public.bids;
  steps numeric;
  fee numeric;
  bal numeric;
  base_quota integer;
  extra integer;
  quota integer;
  used integer;
  min_used integer;
  rate_lim integer;
  rate_win integer;
  rate_used integer;
  rate_oldest timestamptz;
  retry_after integer;
begin
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

  target := coalesce(a.target_price, 0);
  inc := coalesce(nullif(a.bid_increment, 0), 0.01);
  fee := coalesce(a.bid_fee, 0);
  base_quota := greatest(coalesce(a.bids_per_participant, 5), 1);

  select coalesce(credits, 0) into extra
  from public.bid_credits
  where auction_id = _auction_id and user_id = _user_id and round = coalesce(a.round, 1);
  extra := coalesce(extra, 0);
  quota := base_quota + extra;

  if _amount <= 0 or (target > 0 and _amount > target) then
    return jsonb_build_object('ok', false, 'error', 'out_of_range');
  end if;

  steps := _amount / inc;
  if abs(steps - round(steps)) > 0.000001 then
    return jsonb_build_object('ok', false, 'error', 'bad_step');
  end if;

  select count(*) into used
  from public.bids
  where auction_id = _auction_id
    and round = coalesce(a.round, 1)
    and archived = false
    and user_id = _user_id;

  if used >= quota then
    return jsonb_build_object('ok', false, 'error', 'quota_reached', 'quota', quota, 'used', used,
      'extra_price', coalesce(a.extra_bid_price, 0));
  end if;

  -- Pace limit: at most N bids inside a rolling time window (0 = unlimited).
  rate_lim := coalesce(a.bid_rate_limit, 0);
  rate_win := greatest(coalesce(a.bid_rate_window_minutes, 10), 1);
  if rate_lim > 0 then
    select count(*), min(created_date) into rate_used, rate_oldest
    from public.bids
    where auction_id = _auction_id
      and user_id = _user_id
      and archived = false
      and created_date > now() - make_interval(mins => rate_win);
    if coalesce(rate_used, 0) >= rate_lim then
      retry_after := greatest(ceil(extract(epoch from (rate_oldest + make_interval(mins => rate_win) - now())))::int, 1);
      return jsonb_build_object('ok', false, 'error', 'rate_limited',
        'limit', rate_lim, 'window_minutes', rate_win, 'retry_after', retry_after);
    end if;
  end if;

  -- Fairness gate only applies within the base quota; purchased extra bids are exempt.
  if used > 0 and used < base_quota then
    select min(cnt) into min_used
    from (
      select (
        select count(*)
        from public.bids b
        where b.auction_id = _auction_id
          and b.round = coalesce(a.round, 1)
          and b.archived = false
          and b.user_id::text = s
      ) as cnt
      from unnest(a.subscriber_ids) as s
    ) t;

    if coalesce(min_used, 0) < used then
      return jsonb_build_object(
        'ok', false, 'error', 'waiting_for_others',
        'quota', quota, 'used', used, 'min_used', coalesce(min_used, 0)
      );
    end if;
  end if;

  if fee > 0 then
    select coalesce(round(sum(amount)::numeric, 2), 0) into bal
    from public.wallet_transactions
    where user_id = _user_id and status not in ('pending', 'failed');
    if bal < fee then
      return jsonb_build_object('ok', false, 'error', 'insufficient_funds_for_fee', 'balance', bal, 'fee', fee);
    end if;
  end if;

  select * into existing
  from public.bids
  where auction_id = _auction_id
    and round = coalesce(a.round, 1)
    and archived = false
    and amount = _amount
  order by burned desc, created_date asc
  limit 1;

  if found then
    if existing.burned then
      return jsonb_build_object('ok', false, 'error', 'number_burned');
    end if;
    if existing.user_id = _user_id then
      return jsonb_build_object('ok', false, 'error', 'duplicate_own');
    end if;

    update public.bids set burned = true, burned_at = now() where id = existing.id;
    insert into public.bids (auction_id, user_id, amount, round, burned, burned_at)
    values (_auction_id, _user_id, _amount, coalesce(a.round, 1), true, now());
    if fee > 0 then
      insert into public.wallet_transactions (user_id, type, amount, description, auction_id, status)
      values (_user_id, 'bid_fee', -abs(fee), 'Bid fee: ' || a.title, a.id, 'confirmed');
    end if;
    return jsonb_build_object('ok', true, 'burned', true, 'fee', fee, 'quota', quota, 'used', used + 1);
  end if;

  insert into public.bids (auction_id, user_id, amount, round)
  values (_auction_id, _user_id, _amount, coalesce(a.round, 1));
  if fee > 0 then
    insert into public.wallet_transactions (user_id, type, amount, description, auction_id, status)
    values (_user_id, 'bid_fee', -abs(fee), 'Bid fee: ' || a.title, a.id, 'confirmed');
  end if;
  return jsonb_build_object('ok', true, 'burned', false, 'fee', fee, 'quota', quota, 'used', used + 1);
end;
$function$;

CREATE OR REPLACE FUNCTION public.place_ascending_bid(_auction_id uuid, _user_id uuid, _amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a public.auctions;
  bal numeric;
  min_next numeric;
  prev_bidder uuid;
  rate_lim integer;
  rate_win integer;
  rate_used integer;
  rate_oldest timestamptz;
  retry_after integer;
begin
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
    select count(*), min(created_date) into rate_used, rate_oldest
    from public.bids
    where auction_id = _auction_id
      and user_id = _user_id
      and archived = false
      and created_date > now() - make_interval(mins => rate_win);
    if coalesce(rate_used, 0) >= rate_lim then
      retry_after := greatest(ceil(extract(epoch from (rate_oldest + make_interval(mins => rate_win) - now())))::int, 1);
      return jsonb_build_object('ok', false, 'error', 'rate_limited',
        'limit', rate_lim, 'window_minutes', rate_win, 'retry_after', retry_after);
    end if;
  end if;

  select coalesce(round(sum(amount)::numeric, 2), 0) into bal
  from public.wallet_transactions
  where user_id = _user_id and status not in ('pending', 'failed');

  if bal < _amount then
    return jsonb_build_object('ok', false, 'error', 'insufficient_funds_for_bid', 'balance', bal, 'amount', _amount);
  end if;

  min_next := coalesce(nullif(a.current_price, 0), a.start_price, 0) + coalesce(a.bid_increment, 0);
  if _amount < min_next then
    return jsonb_build_object('ok', false, 'error', 'tooLow', 'min_next', min_next);
  end if;

  prev_bidder := a.highest_bidder_id;

  insert into public.bids (auction_id, user_id, amount, round)
  values (_auction_id, _user_id, _amount, coalesce(a.round, 1));

  update public.auctions
  set current_price = _amount,
      highest_bidder_id = _user_id
  where id = _auction_id;

  return jsonb_build_object('ok', true, 'current_price', _amount, 'prev_bidder', prev_bidder);
end;
$function$;