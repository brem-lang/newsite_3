ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS bid_fee numeric NOT NULL DEFAULT 0;

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

  if _amount <= 0 or (target > 0 and _amount > target) then
    return jsonb_build_object('ok', false, 'error', 'out_of_range');
  end if;

  steps := _amount / inc;
  if abs(steps - round(steps)) > 0.000001 then
    return jsonb_build_object('ok', false, 'error', 'bad_step');
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
    return jsonb_build_object('ok', true, 'burned', true, 'fee', fee);
  end if;

  insert into public.bids (auction_id, user_id, amount, round)
  values (_auction_id, _user_id, _amount, coalesce(a.round, 1));
  if fee > 0 then
    insert into public.wallet_transactions (user_id, type, amount, description, auction_id, status)
    values (_user_id, 'bid_fee', -abs(fee), 'Bid fee: ' || a.title, a.id, 'confirmed');
  end if;
  return jsonb_build_object('ok', true, 'burned', false, 'fee', fee);
end;
$function$;