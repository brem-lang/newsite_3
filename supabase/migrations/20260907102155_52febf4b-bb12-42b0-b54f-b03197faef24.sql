DELETE FROM public.bids b WHERE NOT EXISTS (SELECT 1 FROM public.auctions a WHERE a.id = b.auction_id);
DELETE FROM public.profiles p WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);