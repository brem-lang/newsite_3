-- Test-mode data is tagged, kept apart from real data, and removable.
--
-- The tag lives on two roots: auctions.is_test (made by Admin → Test mode) and
-- profiles.is_test (the testseat…@seat.bidkita.test accounts). Everything else
-- is recognised through its auction or its user; wallet_transactions also
-- carries its own copy (set on insert) because the reports sum that table
-- directly and test funding rows have no auction.
--
-- A wallet row is test only when its ACCOUNT is a test account: a real
-- member's money is never hidden from the reports or deleted as test.
--
-- Only the api function (service_role) can set the tag. Test accounts and real
-- members can never share an auction. The public view, the home page and the
-- money reports leave test data out, and delete_test_data() removes it.
-- Front end: AdminTestMode (Stop test / Delete test data), TEST badges,
-- customer auction lists. Edge function: supabase/functions/api/testmode.ts.

/* 1. Columns ------------------------------------------------------------------ */
alter table public.auctions add column if not exists is_test boolean not null default false;
alter table public.profiles add column if not exists is_test boolean not null default false;
alter table public.wallet_transactions add column if not exists is_test boolean not null default false;

create index if not exists auctions_is_test_idx on public.auctions (is_test) where is_test;
create index if not exists profiles_is_test_idx on public.profiles (is_test) where is_test;
create index if not exists wallet_transactions_is_test_idx on public.wallet_transactions (is_test) where is_test;

-- Signed-out visitors read auctions through auctions_public (security invoker),
-- which now filters on is_test, so anon needs that one column.
grant select (is_test) on public.auctions to anon;

/* 2. Who is calling --------------------------------------------------------------- */
-- Same rule as guard_auction_writes: only browser sessions are limited.
create or replace function public.is_browser_caller()
returns boolean language plpgsql stable as $$
declare
  claims text := nullif(current_setting('request.jwt.claims', true), '');
  caller text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    case when claims is null then null else claims::jsonb ->> 'role' end
  );
begin
  return caller in ('anon', 'authenticated');
end; $$;

/* 3. Only the server sets the tag ---------------------------------------------------- */
-- From the browser (staff included) a new row is never test, and an existing
-- row keeps its tag: a real auction can't be hidden as test, a test one can't
-- be promoted into the real numbers.
create or replace function public.protect_is_test()
returns trigger language plpgsql as $$
begin
  if public.is_browser_caller() then
    if tg_op = 'INSERT' then
      new.is_test := false;
    else
      new.is_test := old.is_test;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists protect_is_test on public.auctions;
create trigger protect_is_test before insert or update on public.auctions
  for each row execute function public.protect_is_test();
drop trigger if exists protect_is_test on public.profiles;
create trigger protect_is_test before insert or update on public.profiles
  for each row execute function public.protect_is_test();

-- Wallet rows follow their account (never their auction), whoever writes
-- them; the tag never changes afterwards.
create or replace function public.tag_test_wallet_txn()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.is_test := old.is_test;
    return new;
  end if;
  new.is_test := exists (select 1 from public.profiles p where p.id = new.user_id and p.is_test);
  return new;
end; $$;

drop trigger if exists tag_test_wallet_txn on public.wallet_transactions;
create trigger tag_test_wallet_txn before insert or update on public.wallet_transactions
  for each row execute function public.tag_test_wallet_txn();

/* 4. Test and real never mix ----------------------------------------------------------- */
-- Checked on the rows themselves, so every join / bid path (RPCs, the api
-- function, staff tools) is covered without changing those functions.
create or replace function public.assert_same_test_world(_user_id uuid, _auction_is_test boolean)
returns void language plpgsql stable security definer set search_path = public as $$
declare v_user_test boolean;
begin
  if _user_id is null then return; end if;
  select coalesce(p.is_test, false) into v_user_test from public.profiles p where p.id = _user_id;
  if coalesce(v_user_test, false) <> coalesce(_auction_is_test, false) then
    if coalesce(_auction_is_test, false) then
      raise exception 'This is a test auction. Only test accounts can take part.' using errcode = 'P0001';
    else
      raise exception 'Test accounts can only take part in test auctions.' using errcode = 'P0001';
    end if;
  end if;
end; $$;

create or replace function public.guard_test_seats()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_id text;
begin
  if new.subscriber_ids is not distinct from old.subscriber_ids then return new; end if;
  foreach v_id in array coalesce(new.subscriber_ids, '{}') loop
    if v_id is null or v_id = '' or v_id = any(coalesce(old.subscriber_ids, '{}')) then continue; end if;
    perform public.assert_same_test_world(v_id::uuid, new.is_test);
  end loop;
  return new;
end; $$;

drop trigger if exists guard_test_seats on public.auctions;
create trigger guard_test_seats before update of subscriber_ids on public.auctions
  for each row execute function public.guard_test_seats();

create or replace function public.guard_test_bids()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_same_test_world(
    new.user_id,
    (select a.is_test from public.auctions a where a.id = new.auction_id));
  return new;
end; $$;

drop trigger if exists guard_test_bids on public.bids;
create trigger guard_test_bids before insert on public.bids
  for each row execute function public.guard_test_bids();

/* 5. Tag what test mode already created --------------------------------------------- */
-- createTestAuction always wrote this description; the title is its default prefix.
update public.auctions set is_test = true
 where not is_test
   and (description = 'Auto-generated test auction (test mode).' or title like 'TEST ·%');
update public.profiles set is_test = true
 where not is_test and lower(email) like '%@seat.bidkita.test';
update public.wallet_transactions w set is_test = true
 where not w.is_test
   and exists (select 1 from public.profiles p where p.id = w.user_id and p.is_test);

/* 6. Signed-out visitors never see test auctions ------------------------------------- */
create or replace view public.auctions_public
with (security_invoker = on) as
select
  a.id, a.title, a.description, a.image_url, a.category_id, a.brand_id,
  a.entry_fee, a.max_subscribers, a.min_participants,
  a.start_price, a.current_price, a.bid_increment, a.target_price,
  a.duration_minutes, a.status, a.start_time, a.scheduled_start_time, a.end_time,
  a.featured, a.featured_order, a.round, a.mode,
  a.bid_fee, a.bids_per_participant, a.extra_bid_price,
  a.bid_rate_limit, a.bid_rate_window_minutes, a.min_round_minutes,
  a.pool_warn_pct, a.restart_count, a.max_restarts, a.anti_snipe_seconds,
  a.winner_name, a.paid, a.created_date, a.updated_date,
  a.subscriber_count
from public.auctions a
where not a.is_test;

grant select on public.auctions_public to anon, authenticated;

/* 7. Reports leave test data out ------------------------------------------------------- */

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
  where coalesce(status, '') not in ('pending', 'failed', 'rejected') and not is_test;

  select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'deposits', d.deposits, 'fees', d.fees) order by d.day), '[]'::jsonb)
  into v_daily
  from (
    select (created_date at time zone _tz)::date as day,
           coalesce(sum(abs(amount)) filter (where type = 'topup'), 0) as deposits,
           coalesce(sum(abs(amount)) filter (where type = 'subscription'), 0) as fees
    from public.wallet_transactions
    where coalesce(status, '') not in ('pending', 'failed', 'rejected')
      and not is_test
      and type in ('topup', 'subscription')
      and created_date >= (v_start::timestamp at time zone _tz)
    group by 1
  ) d;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'user_id', x.user_id, 'amount', x.amount, 'reference', x.reference, 'created_date', x.created_date)
           order by x.created_date desc), '[]'::jsonb)
  into v_pending
  from public.wallet_transactions x
  where x.status = 'pending' and x.type = 'topup' and not x.is_test;

  return v_totals || jsonb_build_object('daily', v_daily, 'pending', v_pending);
end; $$;

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
    and not x.is_test
    and public.is_confirmed_txn(x.status)
    and (_since is null or x.created_date >= _since)
  group by x.auction_id;
end; $$;

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
    and not x.is_test
    and public.is_confirmed_txn(x.status)
    and x.created_date >= _since
  group by 1;
end; $$;

-- Ended / archived list: test rows stay listed (with is_test, for the TEST
-- badge and so staff can archive them) but don't count in the totals.
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
    select a.id, a.created_date, a.is_test,
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
      coalesce(sum(seats) filter (where not is_test), 0) as seats,
      coalesce(sum(entry) filter (where not is_test), 0) as entry,
      coalesce(sum(bid_rev) filter (where not is_test), 0) as bid_rev,
      coalesce(sum(entry + bid_rev) filter (where not is_test), 0) as rev,
      coalesce(max(entry + bid_rev) filter (where not is_test), 0) as max_rev
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

create or replace function public.admin_auction_counts()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare r jsonb;
begin
  perform public.assert_admin();
  select jsonb_build_object(
    'ended', count(*) filter (where status = 'ended'),
    'archived', count(*) filter (where status = 'archived'),
    'nonArchived', count(*) filter (where status <> 'archived'),
    'revenue', coalesce(sum(coalesce(array_length(subscriber_ids, 1), 0) * coalesce(entry_fee, 0)) filter (where not is_test), 0))
  into r from public.auctions;
  return r;
end; $$;

create or replace function public.admin_winner_payment_totals()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare r jsonb;
begin
  perform public.assert_admin();
  select jsonb_build_object(
    'pending', coalesce(sum(wp.amount) filter (where wp.status = 'pending'), 0),
    'paid', coalesce(sum(wp.amount) filter (where wp.status = 'paid'), 0),
    'count', count(*))
  into r
  from public.winner_payments wp
  where not exists (select 1 from public.auctions a where a.id = wp.auction_id and a.is_test);
  return r;
end; $$;

-- Dashboard / Analytics (called by the api function): same numbers, without test data.
create or replace function public.admin_dashboard(_from timestamptz, _to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_entry_fees numeric := 0;
  v_bid_fees numeric := 0;
  v_extra_bids numeric := 0;
  v_winner_payment numeric := 0;
  v_refunds numeric := 0;
  v_deposits numeric := 0;
  v_product_cost numeric := 0;
  v_other_cost numeric := 0;
  v_item_cost numeric := 0;
  v_income numeric := 0;
  v_costs numeric := 0;
  v_live integer := 0;
  v_open integer := 0;
  v_ended integer := 0;
  v_unpaid integer := 0;
  v_unpaid_amount numeric := 0;
  v_pending_verifications integer := 0;
  v_pending_topups integer := 0;
  v_open_tickets integer := 0;
  v_pending_refunds integer := 0;
  v_new_users integer := 0;
  v_bids integer := 0;
  v_seats integer := 0;
  v_series jsonb := '[]'::jsonb;
begin
  perform public.admin_dashboard_guard();

  select
    coalesce(sum(case when w.type = 'subscription' then abs(w.amount) else 0 end), 0),
    coalesce(sum(case when w.type = 'bid_fee' then abs(w.amount) else 0 end), 0),
    coalesce(sum(case when w.type = 'bid_credits' then abs(w.amount) else 0 end), 0),
    coalesce(sum(case when w.type = 'winning_bid' then abs(w.amount) else 0 end), 0),
    coalesce(sum(case when w.type = 'refund' then abs(w.amount) else 0 end), 0),
    coalesce(sum(case when w.type in ('topup', 'deposit') then abs(w.amount) else 0 end), 0)
  into v_entry_fees, v_bid_fees, v_extra_bids, v_winner_payment, v_refunds, v_deposits
  from public.wallet_transactions w
  where w.status = 'confirmed' and not w.is_test and w.created_date >= _from and w.created_date < _to;

  select
    coalesce(sum(case when (a.winner_id is not null or a.winner_name is not null) then a.cost_price else 0 end), 0),
    coalesce(sum(case when (a.winner_id is not null or a.winner_name is not null) then a.other_cost else 0 end), 0)
  into v_product_cost, v_other_cost
  from public.auctions a
  where not a.is_test and a.created_date >= _from and a.created_date < _to;

  select coalesce(sum(abs(ci.amount)), 0) into v_item_cost
  from public.auction_cost_items ci
  join public.auctions a on a.id = ci.auction_id
  where not a.is_test and a.created_date >= _from and a.created_date < _to;

  v_income := v_entry_fees + v_bid_fees + v_extra_bids + v_winner_payment;
  v_costs := v_product_cost + v_other_cost + v_item_cost + v_refunds;

  select
    count(*) filter (where a.status = 'live'),
    count(*) filter (where a.status = 'open'),
    count(*) filter (where a.status = 'ended' and a.updated_date >= _from and a.updated_date < _to),
    coalesce(sum(coalesce(array_length(a.subscriber_ids, 1), 0)) filter (where a.created_date >= _from and a.created_date < _to), 0)
  into v_live, v_open, v_ended, v_seats
  from public.auctions a
  where not a.is_test;

  select count(*), coalesce(sum(wp.amount), 0) into v_unpaid, v_unpaid_amount
  from public.winner_payments wp
  where wp.status <> 'paid'
    and not exists (select 1 from public.auctions a where a.id = wp.auction_id and a.is_test);

  select count(*) into v_pending_verifications from public.profiles p
  where coalesce(p.verification_status, 'pending') = 'pending' and not p.is_test;

  select count(*) into v_pending_topups from public.wallet_transactions w
  where w.status = 'pending' and w.type in ('topup', 'deposit') and not w.is_test;

  select count(*) into v_open_tickets from public.support_tickets s where s.status <> 'closed';

  select count(*) into v_pending_refunds from public.refund_requests r where r.status = 'pending';

  select count(*) into v_new_users from public.profiles p
  where not p.is_test and p.created_date >= _from and p.created_date < _to;

  select count(*) into v_bids from public.bids b
  where b.archived = false and b.created_date >= _from and b.created_date < _to
    and not exists (select 1 from public.auctions a where a.id = b.auction_id and a.is_test);

  select coalesce(jsonb_agg(row_to_json(s) order by s.day), '[]'::jsonb) into v_series
  from (
    select
      d::date as day,
      coalesce((
        select sum(abs(w.amount)) from public.wallet_transactions w
        where w.status = 'confirmed' and not w.is_test
          and w.type in ('subscription','bid_fee','bid_credits','winning_bid')
          and w.created_date >= d and w.created_date < d + interval '1 day'
      ), 0) as income,
      coalesce((
        select sum(abs(w.amount)) from public.wallet_transactions w
        where w.status = 'confirmed' and not w.is_test and w.type = 'refund'
          and w.created_date >= d and w.created_date < d + interval '1 day'
      ), 0) as refunds,
      coalesce((
        select sum(abs(w.amount)) from public.wallet_transactions w
        where w.status = 'confirmed' and not w.is_test and w.type in ('topup','deposit')
          and w.created_date >= d and w.created_date < d + interval '1 day'
      ), 0) as deposits,
      coalesce((
        select count(*) from public.bids b
        where b.archived = false and b.created_date >= d and b.created_date < d + interval '1 day'
          and not exists (select 1 from public.auctions a where a.id = b.auction_id and a.is_test)
      ), 0) as bids,
      coalesce((
        select count(*) from public.profiles p
        where not p.is_test and p.created_date >= d and p.created_date < d + interval '1 day'
      ), 0) as users
    from generate_series(date_trunc('day', _from), date_trunc('day', _to - interval '1 second'), interval '1 day') as d
  ) s;

  return jsonb_build_object(
    'from', _from, 'to', _to,
    'entry_fees', round(v_entry_fees, 2),
    'bid_fees', round(v_bid_fees, 2),
    'extra_bids', round(v_extra_bids, 2),
    'winner_payment', round(v_winner_payment, 2),
    'refunds', round(v_refunds, 2),
    'deposits', round(v_deposits, 2),
    'income', round(v_income, 2),
    'product_cost', round(v_product_cost, 2),
    'other_cost', round(v_other_cost, 2),
    'item_cost', round(v_item_cost, 2),
    'costs', round(v_costs, 2),
    'net', round(v_income - v_costs, 2),
    'margin', case when v_income > 0 then round(((v_income - v_costs) / v_income) * 100, 1) else 0 end,
    'arpu', case when v_seats > 0 then round(v_income / v_seats, 2) else 0 end,
    'seats', v_seats,
    'live_auctions', v_live,
    'open_auctions', v_open,
    'ended_auctions', v_ended,
    'unpaid_wins', v_unpaid,
    'unpaid_amount', round(v_unpaid_amount, 2),
    'pending_verifications', v_pending_verifications,
    'pending_topups', v_pending_topups,
    'open_tickets', v_open_tickets,
    'pending_refunds', v_pending_refunds,
    'new_users', v_new_users,
    'bids', v_bids,
    'series', v_series
  );
end;
$$;

revoke execute on function public.admin_dashboard(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_dashboard(timestamptz, timestamptz) to service_role;

/* 8. Stop and clean up (called by the api function only) ------------------------------- */

-- Ends every test auction still open or live, at once and without a winner
-- (nothing to invoice: it was a test). Returns the ended rows' ids and titles.
create or replace function public.stop_test_auctions()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_rows jsonb;
begin
  with stopped as (
    update public.auctions
       set status = 'ended', end_time = now()
     where is_test and status in ('open', 'live', 'scheduled')
    returning id, title
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title)), '[]'::jsonb) into v_rows from stopped;
  return v_rows;
end; $$;

-- Removes every test auction with everything recorded against it, and every
-- test account's wallet row. With _keep_accounts = false it also removes the
-- test accounts' other records and profiles (the api function then deletes
-- their sign-ins). Only tagged rows are touched. Returns per-table counts.
create or replace function public.delete_test_data(_keep_accounts boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_counts jsonb := '{}'::jsonb;
  v_auctions uuid[];
  v_users uuid[];
  v_table text;
  v_n bigint;
  -- Everything that hangs off an auction (FK cascades cover most; deleting
  -- explicitly also covers tables without one).
  v_by_auction text[] := array[
    'bids', 'bid_credits', 'bid_events', 'bid_holds', 'winner_payments', 'fulfilments',
    'auction_rounds', 'auction_messages', 'auction_cost_items', 'auction_finance_overrides',
    'auction_finance_changes', 'notifications'];
  v_by_user text[] := array[
    'bids', 'bid_credits', 'bid_events', 'bid_holds', 'winner_payments', 'fulfilments',
    'notifications', 'refund_requests', 'support_tickets', 'participant_notes'];
begin
  if exists (select 1 from public.auctions where is_test and status in ('open', 'live', 'scheduled')) then
    raise exception 'Stop the running test auctions first.' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(id), '{}') into v_auctions from public.auctions where is_test;
  select coalesce(array_agg(id), '{}') into v_users from public.profiles where is_test;

  foreach v_table in array v_by_auction loop
    if to_regclass('public.' || v_table) is not null and exists (
         select 1 from information_schema.columns
          where table_schema = 'public' and table_name = v_table and column_name = 'auction_id') then
      execute format('delete from public.%I where auction_id = any($1)', v_table) using v_auctions;
      get diagnostics v_n = row_count;
      v_counts := v_counts || jsonb_build_object(v_table, v_n);
    end if;
  end loop;

  delete from public.activity_logs where target_type = 'auction' and target_id = any(v_auctions::text[]);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('activity_logs', v_n);

  -- Refund requests point at wallet rows: remove the test accounts' first.
  if to_regclass('public.refund_requests') is not null then
    delete from public.refund_requests where user_id = any(v_users);
  end if;

  -- Test accounts' rows only (wallet rows are tagged by account).
  delete from public.wallet_transactions where is_test;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('wallet_transactions', v_n);

  delete from public.auctions where is_test;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('auctions', v_n);

  if not _keep_accounts and coalesce(array_length(v_users, 1), 0) > 0 then
    foreach v_table in array v_by_user loop
      if to_regclass('public.' || v_table) is not null and exists (
           select 1 from information_schema.columns
            where table_schema = 'public' and table_name = v_table and column_name = 'user_id') then
        execute format('delete from public.%I where user_id = any($1)', v_table) using v_users;
      end if;
    end loop;
    delete from public.user_roles where user_id = any(v_users);
    delete from public.profiles where id = any(v_users);
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('profiles', v_n);
  end if;

  return v_counts || jsonb_build_object('user_ids', to_jsonb(v_users), 'accounts_kept', _keep_accounts);
end; $$;

revoke all on function public.stop_test_auctions() from public, anon, authenticated;
revoke all on function public.delete_test_data(boolean) from public, anon, authenticated;
grant execute on function public.stop_test_auctions() to service_role;
grant execute on function public.delete_test_data(boolean) to service_role;
revoke all on function public.assert_same_test_world(uuid, boolean) from public, anon;
