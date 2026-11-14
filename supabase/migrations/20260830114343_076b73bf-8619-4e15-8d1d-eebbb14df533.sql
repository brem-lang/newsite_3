ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS extra_bid_price numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.bid_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  round integer NOT NULL DEFAULT 1,
  credits integer NOT NULL DEFAULT 0,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auction_id, user_id, round)
);

GRANT SELECT ON public.bid_credits TO authenticated;
GRANT ALL ON public.bid_credits TO service_role;

ALTER TABLE public.bid_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own bid credits" ON public.bid_credits
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_bid_credits BEFORE UPDATE ON public.bid_credits
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_date();

CREATE OR REPLACE FUNCTION public.buy_bid_credits(_auction_id uuid, _user_id uuid, _count integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  select coalesce(round(sum(amount)::numeric, 2), 0) into bal
  from public.wallet_transactions
  where user_id = _user_id and status not in ('pending', 'failed');

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

  return jsonb_build_object('ok', true, 'credits', newc, 'charged', total, 'price', price);
end;
$function$;

REVOKE ALL ON FUNCTION public.buy_bid_credits(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buy_bid_credits(uuid, uuid, integer) TO service_role;

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
