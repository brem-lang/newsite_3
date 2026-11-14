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
  did_burn boolean := false;
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
  -- The number space is ALWAYS cent-granular: each whole currency unit holds
  -- exactly 100 numbers (x.01 .. x.00), independent of a.bid_increment, which
  -- only governs ascending auctions.
  inc := 0.01;
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

  -- Any two-decimal number is valid.
  if round(_amount * 100) <> _amount * 100 then
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
    did_burn := true;
  else
    insert into public.bids (auction_id, user_id, amount, round)
    values (_auction_id, _user_id, _amount, coalesce(a.round, 1));
  end if;

  if fee > 0 then
    insert into public.wallet_transactions (user_id, type, amount, description, auction_id, status)
    values (_user_id, 'bid_fee', -abs(fee), 'Bid fee: ' || a.title, a.id, 'confirmed');
  end if;

  -- ---- Self-limiting clock -------------------------------------------------
  -- 100 numbers per whole currency unit. As free numbers run out, the remaining
  -- time is compressed by the same ratio; the deadline only moves earlier.
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

  if new_end is distinct from a.end_time then
    update public.auctions set end_time = new_end where id = _auction_id;
  end if;

  return jsonb_build_object(
    'ok', true, 'burned', did_burn, 'fee', fee, 'quota', quota, 'used', used + 1,
    'total_numbers', total_numbers, 'free_numbers', free_numbers, 'end_time', new_end
  );
end;
$function$;

revoke all on function public.place_closest_bid(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.place_closest_bid(uuid, uuid, numeric) to service_role;