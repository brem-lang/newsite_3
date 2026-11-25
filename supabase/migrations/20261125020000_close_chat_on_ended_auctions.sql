-- Auction chat is read-only once an auction is over.
-- New messages are refused when the auction is ended, archived, voided or
-- being voided. Messages are capped at 500 characters (the UI limit).
-- The existing (auction_id, created_date) index already serves the chat read.

drop policy if exists "auction messages insert own" on public.auction_messages;
create policy "auction messages insert own" on public.auction_messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and char_length(body) between 1 and 500
    and exists (
      select 1 from public.auctions a
      where a.id = auction_messages.auction_id
        and a.status not in ('ended', 'archived', 'voided', 'voiding')
    )
  );
