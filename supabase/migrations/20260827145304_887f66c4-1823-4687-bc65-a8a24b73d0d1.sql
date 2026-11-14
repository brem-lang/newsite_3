UPDATE public.bids b
SET archived = true
FROM public.auctions a
WHERE b.auction_id = a.id
  AND a.status <> 'ended'
  AND a.start_time IS NOT NULL
  AND b.archived = false
  AND (b.created_date < a.start_time OR b.amount > a.current_price);

UPDATE public.auctions SET round = round + 1
WHERE status <> 'ended' AND EXISTS (SELECT 1 FROM public.bids b WHERE b.auction_id = auctions.id AND b.archived = true);