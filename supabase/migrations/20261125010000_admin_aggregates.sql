-- Server-side aggregates for the admin screens (PAGINATION-TODO.md #7–#10).
--
-- These screens used to download thousands of raw rows (up to 5000
-- transactions, 5000 bids) and add them up in the browser, so totals went
-- wrong once a table outgrew the cap. Each function returns only the numbers.
-- All are staff-only: they raise unless the caller has the admin role.

create or replace function public.assert_admin()
returns void language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end; $$;

-- Transactions that count as money: no status yet, or confirmed.
create or replace function public.is_confirmed_txn(_status text)
returns boolean language sql immutable as $$ select _status is null or _status = 'confirmed' $$;

/* --------------------------- Bid Monitor (#7) --------------------------- */
-- Last-window health numbers: totals, error rate, anomalies and p95 latency.
create or replace function public.admin_bid_monitor_stats(_since timestamptz)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare r jsonb;
begin
  perform public.assert_admin();
  select jsonb_build_object(
    'total', count(*),
    'accepted', count(*) filter (where outcome = 'accepted'),
    'errors', count(*) filter (where severity = 'error'),
    'anomalies', count(*) filter (where coalesce(details->>'anomaly', '') <> ''),
    'p95', coalesce(percentile_disc(0.95) within group (order by latency_ms) filter (where latency_ms > 0), 0),
    'rate', case when count(*) = 0 then 0
                 else round(100.0 * count(*) filter (where severity = 'error') / count(*)) end)
  into r
  from public.bid_events where created_date >= _since;
  return r;
end; $$;

/* ------------------------ Payments summary (#9) ------------------------ */
-- Settled = not pending / failed / rejected. Daily buckets use the viewer's time zone.
create or replace function public.admin_payments_summary(_days integer, _tz text default 'UTC')
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_totals jsonb; v_daily jsonb; v_pending jsonb; v_start date;
begin
  perform public.assert_admin();
  v_start := (now() at time zone _tz)::date - (greatest(_days, 1) - 1);

  select jsonb_build_object(
    'deposits', coalesce(sum(abs(amount)) filter (where type = 'topup'), 0),
    'fees', coalesce(sum(abs(amount)) filter (where type = 'subscription'), 0),
    'adjustments', coalesce(sum(amount) filter (where type = 'adjustment'), 0))
  into v_totals
  from public.wallet_transactions
  where coalesce(status, '') not in ('pending', 'failed', 'rejected');

  select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'deposits', d.deposits, 'fees', d.fees) order by d.day), '[]'::jsonb)
  into v_daily
  from (
    select (created_date at time zone _tz)::date as day,
           coalesce(sum(abs(amount)) filter (where type = 'topup'), 0) as deposits,
           coalesce(sum(abs(amount)) filter (where type = 'subscription'), 0) as fees
    from public.wallet_transactions
    where coalesce(status, '') not in ('pending', 'failed', 'rejected')
      and type in ('topup', 'subscription')
      and created_date >= (v_start::timestamp at time zone _tz)
    group by 1
  ) d;

  -- The approvals queue: every pending top-up (bounded by what staff must act on).
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'user_id', x.user_id, 'amount', x.amount, 'reference', x.reference, 'created_date', x.created_date)
           order by x.created_date desc), '[]'::jsonb)
  into v_pending
  from public.wallet_transactions x
  where x.status = 'pending' and x.type = 'topup';

  return v_totals || jsonb_build_object('daily', v_daily, 'pending', v_pending);
end; $$;

/* ------------------------------ Revenue (#9) ------------------------------ */
-- Per-auction income/refund sums from confirmed transactions since _since (null = all time).
create or replace function public.admin_revenue_by_auction(_since timestamptz default null)
returns table (auction_id uuid, entry_fees numeric, bid_fees numeric, extra_bids numeric, winner_payment numeric, refunds numeric)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  perform public.assert_admin();
  return query
  select x.auction_id,
    coalesce(sum(abs(x.amount)) filter (where x.type = 'subscription'), 0),
    coalesce(sum(abs(x.amount)) filter (where x.type = 'bid_fee'), 0),
    coalesce(sum(abs(x.amount)) filter (where x.type = 'bid_credits'), 0),
    coalesce(sum(abs(x.amount)) filter (where x.type = 'winning_bid'), 0),
    coalesce(sum(abs(x.amount)) filter (where x.type = 'refund'), 0)
  from public.wallet_transactions x
  where x.auction_id is not null
    and public.is_confirmed_txn(x.status)
    and (_since is null or x.created_date >= _since)
  group by x.auction_id;
end; $$;

-- Daily income / refunds (auction-linked, confirmed) in the viewer's time zone.
create or replace function public.admin_revenue_daily(_since timestamptz, _tz text default 'UTC')
returns table (day date, income numeric, refunds numeric)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  perform public.assert_admin();
  return query
  select (x.created_date at time zone _tz)::date,
    coalesce(sum(abs(x.amount)) filter (where x.type in ('subscription', 'bid_fee', 'bid_credits', 'winning_bid')), 0),
    coalesce(sum(abs(x.amount)) filter (where x.type = 'refund'), 0)
  from public.wallet_transactions x
  where x.auction_id is not null
    and public.is_confirmed_txn(x.status)
    and x.created_date >= _since
  group by 1;
end; $$;

/* --------------------------- Auction P&L (#10) --------------------------- */
-- One auction's money roll-up and its per-participant breakdown.
create or replace function public.admin_auction_pl(_auction_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare a public.auctions; v_fees jsonb; v_dep jsonb; v_bids jsonb; v_seats jsonb;
begin
  perform public.assert_admin();
  select * into a from public.auctions where id = _auction_id;
  if a.id is null then return null; end if;

  select jsonb_build_object(
    'entryFees', coalesce(sum(abs(amount)) filter (where type = 'subscription'), 0),
    'bidFees', coalesce(sum(abs(amount)) filter (where type = 'bid_fee'), 0),
    'extraBids', coalesce(sum(abs(amount)) filter (where type = 'bid_credits'), 0),
    'winnerPayment', coalesce(sum(abs(amount)) filter (where type = 'winning_bid'), 0),
    'refunds', coalesce(sum(abs(amount)) filter (where type = 'refund'), 0))
  into v_fees
  from public.wallet_transactions
  where auction_id = _auction_id and public.is_confirmed_txn(status);

  select jsonb_build_object(
    'confirmed', coalesce(sum(abs(amount)) filter (where public.is_confirmed_txn(status)), 0),
    'pending', coalesce(sum(abs(amount)) filter (where status = 'pending'), 0))
  into v_dep
  from public.wallet_transactions
  where auction_id = _auction_id and type = 'deposit';

  select jsonb_build_object(
    'live', count(*) filter (where not coalesce(archived, false)),
    'burned', count(*) filter (where not coalesce(archived, false) and coalesce(burned, false)),
    'archived', count(*) filter (where coalesce(archived, false)))
  into v_bids
  from public.bids where auction_id = _auction_id;

  -- Everyone with a seat, a live bid, a fee or a deposit on this auction.
  with people as (
    select unnest(a.subscriber_ids)::uuid as user_id
    union select user_id from public.bids where auction_id = _auction_id and not coalesce(archived, false)
    union select user_id from public.wallet_transactions
      where auction_id = _auction_id and public.is_confirmed_txn(status)
        and type in ('subscription', 'bid_fee', 'bid_credits', 'winning_bid', 'deposit')
  ),
  b as (
    select user_id, count(*) as bids, count(*) filter (where coalesce(burned, false)) as burned, max(created_date) as last
    from public.bids where auction_id = _auction_id and not coalesce(archived, false) group by user_id
  ),
  f as (
    select user_id,
      coalesce(sum(abs(amount)) filter (where type in ('subscription', 'bid_fee', 'bid_credits', 'winning_bid')), 0) as fees,
      coalesce(sum(abs(amount)) filter (where type = 'deposit'), 0) as deposits
    from public.wallet_transactions
    where auction_id = _auction_id and public.is_confirmed_txn(status) group by user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'userId', p.user_id,
      'name', coalesce(pr.full_name, pr.email, p.user_id::text),
      'bids', coalesce(b.bids, 0), 'burned', coalesce(b.burned, 0), 'last', b.last,
      'fees', coalesce(f.fees, 0), 'deposits', coalesce(f.deposits, 0))
      order by coalesce(f.fees, 0) desc, coalesce(b.bids, 0) desc), '[]'::jsonb)
  into v_seats
  from people p
  left join b on b.user_id = p.user_id
  left join f on f.user_id = p.user_id
  left join public.profiles pr on pr.id = p.user_id
  where p.user_id is not null;

  return jsonb_build_object('fees', v_fees, 'deposits', v_dep, 'bids', v_bids, 'seats', v_seats);
end; $$;

-- Per-round bid / credit counts for the Finance panel's Rounds tab.
create or replace function public.admin_auction_rounds(_auction_id uuid)
returns table (round integer, bids bigint, archived_bids bigint, burned bigint, bidders bigint, credits numeric)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  perform public.assert_admin();
  return query
  with b as (
    select coalesce(x.round, 1) as round,
      count(*) filter (where not coalesce(x.archived, false)) as bids,
      count(*) filter (where coalesce(x.archived, false)) as archived_bids,
      count(*) filter (where coalesce(x.burned, false)) as burned,
      count(distinct x.user_id) as bidders,
      count(*) as all_bids
    from public.bids x where x.auction_id = _auction_id group by 1
  ),
  c as (
    select coalesce(y.round, 1) as round, coalesce(sum(y.credits), 0)::numeric as credits
    from public.bid_credits y where y.auction_id = _auction_id group by 1
  )
  select coalesce(b.round, c.round)::integer, coalesce(b.bids, 0), coalesce(b.archived_bids, 0),
         coalesce(b.burned, 0), coalesce(b.bidders, 0), coalesce(c.credits, 0)
  from b full join c on c.round = b.round
  order by 1;
end; $$;

/* ------------------------- Ended auctions (#8) ------------------------- */
-- One page of ended/archived auctions with their bid counts, plus revenue
-- totals for every match (not just the page).
-- Search matches the id, title, winner name, or the winner's profile name/email.
create or replace function public.admin_ended_auctions(
  _statuses text[], _search text default '', _from timestamptz default null, _to timestamptz default null,
  _paid boolean default null, _page integer default 1, _page_size integer default 10)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_term text := nullif(trim(coalesce(_search, '')), '');
  v_page integer := greatest(coalesce(_page, 1), 1);
  v_size integer := least(greatest(coalesce(_page_size, 10), 1), 500);
  v_out jsonb;
begin
  perform public.assert_admin();

  with m as (
    select a.id, a.created_date,
      coalesce(array_length(a.subscriber_ids, 1), 0) as seats,
      coalesce(array_length(a.subscriber_ids, 1), 0) * coalesce(a.entry_fee, 0) as entry,
      case when a.mode = 'closest' then coalesce(bc.n, 0) * coalesce(a.bid_fee, 0) else 0 end as bid_rev,
      coalesce(bc.n, 0) as bid_count
    from public.auctions a
    left join lateral (select count(*) as n from public.bids b where b.auction_id = a.id) bc on true
    left join public.profiles w on w.id = coalesce(a.winner_id, a.highest_bidder_id)
    where a.status = any(_statuses)
      and (_paid is null or a.paid = _paid)
      and (_from is null or a.end_time >= _from)
      and (_to is null or a.end_time <= _to)
      and (v_term is null
           or a.id::text ilike '%' || v_term || '%'
           or a.title ilike '%' || v_term || '%'
           or a.winner_name ilike '%' || v_term || '%'
           or w.full_name ilike '%' || v_term || '%'
           or w.email ilike '%' || v_term || '%')
  ),
  agg as (
    select count(*) as total,
      coalesce(sum(seats), 0) as seats, coalesce(sum(entry), 0) as entry,
      coalesce(sum(bid_rev), 0) as bid_rev, coalesce(sum(entry + bid_rev), 0) as rev,
      coalesce(max(entry + bid_rev), 0) as max_rev
    from m
  ),
  pg as (
    select * from m order by created_date desc offset (v_page - 1) * v_size limit v_size
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(to_jsonb(a) || jsonb_build_object('bid_count', pg.bid_count) order by pg.created_date desc)
      from pg join public.auctions a on a.id = pg.id), '[]'::jsonb),
    'total', agg.total,
    'totals', jsonb_build_object('seats', agg.seats, 'entry', agg.entry, 'bidRev', agg.bid_rev,
                                'total', agg.rev, 'maxTotal', agg.max_rev),
    'page', v_page, 'pageSize', v_size,
    'pageCount', greatest(1, ceil(agg.total::numeric / v_size)::integer))
  into v_out
  from agg;
  return v_out;
end; $$;

-- Tab counts and the all-time entry-fee revenue card on the Auctions screen.
create or replace function public.admin_auction_counts()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare r jsonb;
begin
  perform public.assert_admin();
  select jsonb_build_object(
    'ended', count(*) filter (where status = 'ended'),
    'archived', count(*) filter (where status = 'archived'),
    'nonArchived', count(*) filter (where status <> 'archived'),
    'revenue', coalesce(sum(coalesce(array_length(subscriber_ids, 1), 0) * coalesce(entry_fee, 0)), 0))
  into r from public.auctions;
  return r;
end; $$;

/* --------------------------- Winner payments --------------------------- */
-- Stat cards: awaiting / collected amounts and the number of wins, over every win.
create or replace function public.admin_winner_payment_totals()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare r jsonb;
begin
  perform public.assert_admin();
  select jsonb_build_object(
    'pending', coalesce(sum(amount) filter (where status = 'pending'), 0),
    'paid', coalesce(sum(amount) filter (where status = 'paid'), 0),
    'count', count(*))
  into r from public.winner_payments;
  return r;
end; $$;
revoke all on function public.admin_winner_payment_totals() from public, anon;
grant execute on function public.admin_winner_payment_totals() to authenticated;

-- Execute rights: staff call these with their own session; assert_admin() guards each.
revoke all on function public.assert_admin() from public, anon;
revoke all on function public.admin_bid_monitor_stats(timestamptz) from public, anon;
revoke all on function public.admin_payments_summary(integer, text) from public, anon;
revoke all on function public.admin_revenue_by_auction(timestamptz) from public, anon;
revoke all on function public.admin_revenue_daily(timestamptz, text) from public, anon;
revoke all on function public.admin_auction_pl(uuid) from public, anon;
revoke all on function public.admin_auction_rounds(uuid) from public, anon;
revoke all on function public.admin_ended_auctions(text[], text, timestamptz, timestamptz, boolean, integer, integer) from public, anon;
revoke all on function public.admin_auction_counts() from public, anon;
grant execute on function public.assert_admin() to authenticated;
grant execute on function public.admin_bid_monitor_stats(timestamptz) to authenticated;
grant execute on function public.admin_payments_summary(integer, text) to authenticated;
grant execute on function public.admin_revenue_by_auction(timestamptz) to authenticated;
grant execute on function public.admin_revenue_daily(timestamptz, text) to authenticated;
grant execute on function public.admin_auction_pl(uuid) to authenticated;
grant execute on function public.admin_auction_rounds(uuid) to authenticated;
grant execute on function public.admin_ended_auctions(text[], text, timestamptz, timestamptz, boolean, integer, integer) to authenticated;
grant execute on function public.admin_auction_counts() to authenticated;

-- Indexes for the per-auction and per-status lookups above and the paged tables.
create index if not exists wallet_transactions_auction_idx on public.wallet_transactions (auction_id, type);
create index if not exists wallet_transactions_status_type_idx on public.wallet_transactions (status, type, created_date desc);
create index if not exists bids_auction_idx on public.bids (auction_id);
create index if not exists bid_credits_auction_idx on public.bid_credits (auction_id);
create index if not exists auctions_status_created_idx on public.auctions (status, created_date desc);
create index if not exists notifications_channel_created_idx on public.notifications (channel, created_date desc);
create index if not exists refund_requests_status_created_idx on public.refund_requests (status, created_date desc);
create index if not exists fulfilments_status_created_idx on public.fulfilments (status, created_date desc);
create index if not exists winner_payments_status_created_idx on public.winner_payments (status, created_date desc);
create index if not exists support_tickets_status_created_idx on public.support_tickets (status, created_date desc);
