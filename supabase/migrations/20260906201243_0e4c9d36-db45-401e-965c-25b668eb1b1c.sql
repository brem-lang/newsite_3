UPDATE public.auctions
SET bids_per_participant = GREATEST(1, ROUND(entry_fee / NULLIF(bid_increment, 0))::int)
WHERE status IN ('open','live','scheduled')
  AND bid_increment > 0;