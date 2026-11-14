-- 1) Escrow holds for live rounds
CREATE TABLE public.bid_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  round integer NOT NULL DEFAULT 1,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'held',
  reason text,
  retry_until timestamp with time zone,
  released_at timestamp with time zone,
  created_date timestamp with time zone NOT NULL DEFAULT now(),
  updated_date timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (auction_id, round, user_id)
);

GRANT SELECT ON public.bid_holds TO authenticated;
GRANT ALL ON public.bid_holds TO service_role;

ALTER TABLE public.bid_holds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bid_holds_select_own" ON public.bid_holds
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_bid_holds BEFORE UPDATE ON public.bid_holds
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_date();

CREATE INDEX bid_holds_user_active_idx ON public.bid_holds (user_id, status);
CREATE INDEX bid_holds_auction_idx ON public.bid_holds (auction_id, round, status);

-- 2) Auction settings: anti-sniping + winner hold retry window
ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS anti_snipe_seconds integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS hold_retry_minutes integer NOT NULL DEFAULT 1440;

-- 3) Client-side idempotency key on bids
ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS client_request_id text;

CREATE UNIQUE INDEX bids_client_request_idx
  ON public.bids (auction_id, user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

-- 4) Exposure = wallet balance minus active holds
CREATE OR REPLACE FUNCTION public.held_amount(_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((
    SELECT round(sum(h.amount)::numeric, 2)
    FROM public.bid_holds h
    WHERE h.user_id = _user_id
      AND h.status = 'held'
      AND (h.retry_until IS NULL OR h.retry_until > now())
  ), 0);
$$;

REVOKE ALL ON FUNCTION public.held_amount(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.held_amount(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.available_balance(_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT greatest(
    coalesce((
      SELECT round(sum(amount)::numeric, 2) FROM public.wallet_transactions
      WHERE user_id = _user_id AND status NOT IN ('pending', 'failed')
    ), 0)
    - public.held_amount(_user_id)
  , 0);
$$;

-- 5) Release holds when a round closes: everyone but the winner is freed
--    immediately; the winner's hold is kept for the payment retry window.
CREATE OR REPLACE FUNCTION public.release_auction_holds(
  _auction_id uuid,
  _round integer DEFAULT NULL,
  _winner_id uuid DEFAULT NULL,
  _retry_minutes integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  rnd integer;
  mins integer;
  freed integer := 0;
  kept integer := 0;
  a public.auctions;
begin
  select * into a from public.auctions where id = _auction_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  rnd := coalesce(_round, a.round, 1);
  mins := greatest(coalesce(_retry_minutes, a.hold_retry_minutes, 1440), 0);

  update public.bid_holds
  set status = 'released', released_at = now(), reason = coalesce(reason, 'round_closed')
  where auction_id = _auction_id
    and round = rnd
    and status = 'held'
    and (_winner_id is null or user_id <> _winner_id);
  freed := coalesce((select count(*) from public.bid_holds
    where auction_id = _auction_id and round = rnd and status = 'released'), 0);

  if _winner_id is not null then
    update public.bid_holds
    set retry_until = now() + make_interval(mins => mins), reason = 'awaiting_payment'
    where auction_id = _auction_id and round = rnd and user_id = _winner_id and status = 'held';
    kept := 1;
  end if;

  return jsonb_build_object('ok', true, 'released', freed, 'reserved', kept, 'retry_minutes', mins);
end;
$function$;

REVOKE ALL ON FUNCTION public.release_auction_holds(uuid, integer, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_auction_holds(uuid, integer, uuid, integer) TO service_role;

-- 6) Automatic release of holds whose retry window elapsed, or whose round is
--    no longer live and no longer awaiting a payment.
CREATE OR REPLACE FUNCTION public.release_expired_holds()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  expired integer := 0;
  stale integer := 0;
begin
  with upd as (
    update public.bid_holds h
    set status = 'released', released_at = now(), reason = 'retry_window_expired'
    where h.status = 'held' and h.retry_until is not null and h.retry_until <= now()
    returning 1
  ) select count(*) into expired from upd;

  with upd2 as (
    update public.bid_holds h
    set status = 'released', released_at = now(), reason = 'round_not_live'
    where h.status = 'held'
      and h.retry_until is null
      and exists (
        select 1 from public.auctions a
        where a.id = h.auction_id
          and (a.status <> 'live' or coalesce(a.round, 1) <> h.round)
      )
    returning 1
  ) select count(*) into stale from upd2;

  return jsonb_build_object('ok', true, 'expired', expired, 'stale', stale);
end;
$function$;

REVOKE ALL ON FUNCTION public.release_expired_holds() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_expired_holds() TO service_role;

-- 7) Ascending bids: escrow hold, anti-sniping extension, idempotency key
DROP FUNCTION IF EXISTS public.place_ascending_bid(uuid, uuid, numeric);

CREATE OR REPLACE FUNCTION public.place_ascending_bid(
  _auction_id uuid,
  _user_id uuid,
  _amount numeric,
  _client_request_id text DEFAULT NULL
)
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
  win_start timestamptz;
  retry_after integer;
  dup public.bids;
  snipe integer;
  new_end timestamptz;
  extended boolean := false;
begin
  -- Idempotency: a retried or double-tapped submit with the same request id
  -- never records a second bid.
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

  -- Escrow model: money is reserved (held), never debited during the round, so
  -- available balance already excludes this user's own active holds.
  select public.available_balance(_user_id) into bal;
  bal := bal + coalesce((
    select h.amount from public.bid_holds h
    where h.auction_id = _auction_id and h.round = coalesce(a.round, 1)
      and h.user_id = _user_id and h.status = 'held'
  ), 0);

  if bal < _amount then
    return jsonb_build_object('ok', false, 'error', 'insufficient_funds_for_bid', 'balance', bal, 'amount', _amount);
  end if;

  min_next := coalesce(nullif(a.current_price, 0), a.start_price, 0) + coalesce(a.bid_increment, 0);
  if _amount < min_next then
    return jsonb_build_object('ok', false, 'error', 'tooLow', 'min_next', min_next);
  end if;

  prev_bidder := a.highest_bidder_id;

  insert into public.bids (auction_id, user_id, amount, round, client_request_id)
  values (_auction_id, _user_id, _amount, coalesce(a.round, 1), _client_request_id);

  -- Hold the new leader's funds and free the previous leader immediately.
  insert into public.bid_holds (auction_id, user_id, round, amount, status, reason)
  values (_auction_id, _user_id, coalesce(a.round, 1), _amount, 'held', 'leading_bid')
  on conflict (auction_id, round, user_id)
  do update set amount = excluded.amount, status = 'held', reason = 'leading_bid',
                retry_until = null, released_at = null;

  if prev_bidder is not null and prev_bidder <> _user_id then
    update public.bid_holds
    set status = 'released', released_at = now(), reason = 'outbid'
    where auction_id = _auction_id and round = coalesce(a.round, 1)
      and user_id = prev_bidder and status = 'held';
  end if;

  -- Anti-sniping: a bid in the closing seconds pushes the deadline forward so
  -- nobody can win purely on latency.
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
    'held', _amount);
end;
$function$;

-- 8) Sealed bids: same idempotency key support
DROP FUNCTION IF EXISTS public.place_closest_bid(uuid, uuid, numeric);

CREATE OR REPLACE FUNCTION public.place_closest_bid(
  _auction_id uuid,
  _user_id uuid,
  _amount numeric,
  _client_request_id text DEFAULT NULL
)
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
  dup public.bids;
  cents integer;
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
  win_start timestamptz;
  retry_after integer;
  total_numbers bigint;
  used_numbers bigint;
  free_numbers bigint;
  free_ratio numeric;
  floor_numbers bigint;
  remaining_secs numeric;
  new_end timestamptz;
  guard_end timestamptz;
  min_mins integer;
  did_burn boolean := false;
begin
  if _client_request_id is not null then
    select * into dup from public.bids
    where auction_id = _auction_id and user_id = _user_id and client_request_id = _client_request_id
    limit 1;
    if found then
      return jsonb_build_object('ok', true, 'duplicate', true, 'burned', dup.burned);
    end if;
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

  cents := round(_amount * 100);
  if abs(_amount * 100 - cents) > 0.000001 or cents < 1 then
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
    select public.available_balance(_user_id) into bal;
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
    insert into public.bids (auction_id, user_id, amount, round, burned, burned_at, client_request_id)
    values (_auction_id, _user_id, _amount, coalesce(a.round, 1), true, now(), _client_request_id);
    did_burn := true;
  else
    insert into public.bids (auction_id, user_id, amount, round, client_request_id)
    values (_auction_id, _user_id, _amount, coalesce(a.round, 1), _client_request_id);
  end if;

  if fee > 0 then
    insert into public.wallet_transactions (user_id, type, amount, description, auction_id, status)
    values (_user_id, 'bid_fee', -abs(fee), 'Bid fee: ' || a.title, a.id, 'confirmed');
  end if;

  total_numbers := greatest(round(target * 100)::bigint, 1);

  select count(distinct amount) into used_numbers
  from public.bids
  where auction_id = _auction_id
    and round = coalesce(a.round, 1)
    and archived = false;

  free_numbers := greatest(total_numbers - coalesce(used_numbers, 0), 0);
  free_ratio := free_numbers::numeric / total_numbers::numeric;
  floor_numbers := greatest(ceil(total_numbers * 0.05)::bigint, 3);
  new_end := a.end_time;

  if free_numbers <= floor_numbers then
    new_end := now();
  else
    remaining_secs := extract(epoch from (a.end_time - now()));
    if remaining_secs > 0 then
      new_end := now() + make_interval(secs => greatest(remaining_secs * free_ratio, 60));
      if new_end > a.end_time then
        new_end := a.end_time;
      end if;
    end if;
  end if;

  min_mins := greatest(coalesce(a.min_round_minutes, 0), 0);
  if min_mins > 0 and a.start_time is not null then
    guard_end := a.start_time + make_interval(mins => min_mins);
    if guard_end > a.end_time then
      guard_end := a.end_time;
    end if;
    if new_end < guard_end then
      new_end := guard_end;
    end if;
  end if;

  if new_end is distinct from a.end_time then
    update public.auctions set end_time = new_end where id = _auction_id;
  end if;

  return jsonb_build_object(
    'ok', true, 'burned', did_burn, 'fee', fee, 'quota', quota, 'used', used + 1,
    'total_numbers', total_numbers, 'free_numbers', free_numbers, 'end_time', new_end,
    'min_round_minutes', min_mins
  );
end;
$function$;