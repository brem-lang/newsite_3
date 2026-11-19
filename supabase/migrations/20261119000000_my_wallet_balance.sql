-- The signed-in user's confirmed wallet balance, summed in Postgres over every
-- transaction. Replaces the browser summing the latest 200 rows, which was
-- wrong for users with more than 200 transactions.
--
-- Unlike wallet_confirmed_balance(_user_id) this takes no argument: it only
-- ever reads auth.uid()'s own rows, so it is safe to expose to members.
-- Served by wallet_tx_user_created_idx (user_id, created_date).
create or replace function public.my_wallet_balance()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(round(sum(amount)::numeric, 2), 0)
  from public.wallet_transactions
  where user_id = (select auth.uid())
    and coalesce(status, '') not in ('pending', 'failed');
$$;

revoke all on function public.my_wallet_balance() from public, anon;
grant execute on function public.my_wallet_balance() to authenticated;
