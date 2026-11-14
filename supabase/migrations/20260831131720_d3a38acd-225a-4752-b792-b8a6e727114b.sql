-- 1) Winner payment requests (manual payment links)
CREATE TABLE public.winner_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  round integer NOT NULL DEFAULT 1,
  amount numeric NOT NULL DEFAULT 0,
  token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamp with time zone,
  paid_reference text,
  note text,
  created_date timestamp with time zone NOT NULL DEFAULT now(),
  updated_date timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (token),
  UNIQUE (auction_id, round, user_id)
);

GRANT SELECT ON public.winner_payments TO authenticated;
GRANT ALL ON public.winner_payments TO service_role;

ALTER TABLE public.winner_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "winner_payments_select_own" ON public.winner_payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_winner_payments BEFORE UPDATE ON public.winner_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_date();

CREATE INDEX winner_payments_auction_idx ON public.winner_payments (auction_id, round);
CREATE INDEX winner_payments_user_idx ON public.winner_payments (user_id, status);

-- 2) Restart cap
ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS restart_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_restarts integer NOT NULL DEFAULT 3;

-- 3) Available balance (wallet balance minus committed exposure)
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
    - coalesce((
      SELECT round(sum(a.current_price)::numeric, 2) FROM public.auctions a
      WHERE a.status = 'live' AND coalesce(a.mode, 'highest') <> 'closest'
        AND a.highest_bidder_id = _user_id
    ), 0)
  , 0);
$$;

-- 4) Use available balance everywhere money is committed
CREATE OR REPLACE FUNCTION public.join_auction_atomic(_auction_id uuid, _user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a public.auctions;
  bal numeric;
  new_status text;
  new_start timestamptz;
  new_end timestamptz;
begin
  select * into a from public.auctions where id = _auction_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if a.status = 'ended' then
    return jsonb_build_object('ok', false, 'error', 'Auction ended');
  end if;

  if _user_id::text = any(a.subscriber_ids) then
    return jsonb_build_object('ok', false, 'error', 'already_joined');
  end if;

  select public.available_balance(_user_id) into bal;

  if bal < a.entry_fee then
    return jsonb_build_object('ok', false, 'error', 'insufficient_balance');
  end if;

  insert into public.wallet_transactions (user_id, type, amount, description, auction_id, status)
  values (_user_id, 'subscription', -abs(a.entry_fee), 'Entry fee: ' || a.title, a.id, 'confirmed');

  new_status := a.status;
  new_start := a.start_time;
  new_end := a.end_time;
  if a.status = 'open' and a.start_time is null then
    new_status := 'live';
    new_start := now();
    new_end := now() + make_interval(mins => a.duration_minutes);
  end if;

  update public.auctions
  set subscriber_ids = array_append(subscriber_ids, _user_id::text),
      status = new_status,
      start_time = new_start,
      end_time = new_end
  where id = a.id;

  return jsonb_build_object('ok', true, 'status', new_status);
end;
$function$;

CREATE OR REPLACE FUNCTION public.buy_bid_credits(_auction_id uuid, _user_id uuid, _count integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if a.mode <> 'closest' then
    return jsonb_build_object('ok', false, 'error', 'not_supported');
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
  win_start timestamptz;
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

  -- Available balance: wallet minus money already committed on other auctions
  -- this user is currently leading, so the same funds can't back two wins.
  select public.available_balance(_user_id) into bal;
  if a.highest_bidder_id = _user_id then
    bal := bal + coalesce(a.current_price, 0);
  end if;

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

-- 5) Void an auction and refund everyone exactly once
CREATE OR REPLACE FUNCTION public.void_auction_refund(_auction_id uuid, _reason text DEFAULT 'round_voided')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  a public.auctions;
  r record;
  refunded numeric := 0;
  cnt integer := 0;
begin
  select * into a from public.auctions where id = _auction_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  for r in
    select wt.user_id, round(sum(-wt.amount)::numeric, 2) as spent
    from public.wallet_transactions wt
    where wt.auction_id = _auction_id
      and wt.status not in ('pending', 'failed')
      and wt.type in ('subscription', 'bid_fee', 'bid_credits')
    group by wt.user_id
  loop
    if r.spent is null or r.spent <= 0 then
      continue;
    end if;
    -- Idempotent: skip users already refunded for this auction.
    if exists (
      select 1 from public.wallet_transactions
      where auction_id = _auction_id and user_id = r.user_id and type = 'refund'
    ) then
      continue;
    end if;
    insert into public.wallet_transactions (user_id, type, amount, description, auction_id, status)
    values (r.user_id, 'refund', abs(r.spent), 'Refund (' || _reason || '): ' || a.title, _auction_id, 'confirmed');
    refunded := refunded + r.spent;
    cnt := cnt + 1;
  end loop;

  update public.auctions
  set status = 'voided',
      winner_id = null,
      winner_name = null,
      highest_bidder_id = null,
      paid = false
  where id = _auction_id;

  update public.bids set archived = true
  where auction_id = _auction_id and archived = false;

  return jsonb_build_object('ok', true, 'refunded', refunded, 'users', cnt);
end;
$function$;