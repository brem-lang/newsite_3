alter table public.auctions
  add column if not exists bids_per_participant integer not null default 5;

create or replace function public.place_closest_bid(_auction_id uuid, _user_id uuid, _amount numeric)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  a public.auctions;
  target numeric;
  inc numeric;
  existing public.bids;
  steps numeric;
  fee numeric;
  bal numeric;
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
  quota := greatest(coalesce(a.bids_per_participant, 5), 1);

  if _amount <= 0 or (target > 0 and _amount > target) then
    return jsonb_build_object('ok', false, 'error', 'out_of_range');
  end if;

  steps := _amount / inc;
  if abs(steps - round(steps)) > 0.000001 then
    return jsonb_build_object('ok', false, 'error', 'bad_step');
  end if;

  -- How many picks this participant already used in the live round.
  select count(*) into used
  from public.bids
  where auction_id = _auction_id
    and round = coalesce(a.round, 1)
    and archived = false
    and user_id = _user_id;

  if used >= quota then
    return jsonb_build_object('ok', false, 'error', 'quota_reached', 'quota', quota, 'used', used);
  end if;

  -- Fairness gate: pick number N (N > 1) only unlocks once every seated
  -- participant has used at least N - 1 picks.
  if used > 0 then
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

revoke all on function public.place_closest_bid(uuid, uuid, numeric) from public;
grant execute on function public.place_closest_bid(uuid, uuid, numeric) to service_role;