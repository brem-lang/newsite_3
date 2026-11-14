-- Run the auction tick every minute: starts due auctions, closes expired
-- rounds, requests winner payments and releases expired holds.
-- pg_cron calls the api Edge Function through Kong on the Docker network,
-- authorised with a random token that only the database and the function see.
create extension if not exists pg_cron;
create extension if not exists pg_net;

insert into public.cron_tokens (name, token)
values ('auction_tick', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (name) do nothing;

create or replace function public.run_auction_tick()
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare
  tok text := (select token from public.cron_tokens where name = 'auction_tick');
begin
  return net.http_post(
    url := 'http://kong:8000/functions/v1/api',
    body := jsonb_build_object('name', 'auctionTick'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-tick-token', tok),
    timeout_milliseconds := 55000);
end $$;
revoke all on function public.run_auction_tick() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'auction-tick';
select cron.schedule('auction-tick', '* * * * *', 'select public.run_auction_tick()');

-- profiles / user_roles have no foreign key to auth.users, so deleting an
-- account (dashboard or API) left them behind. Clean them up on delete.
create or replace function public.handle_deleted_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.user_roles where user_id = old.id;
  delete from public.profiles where id = old.id;
  return old;
end $$;
drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted after delete on auth.users
  for each row execute function public.handle_deleted_user();
