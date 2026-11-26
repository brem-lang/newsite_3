-- The site trades in Philippine pesos only.
alter table public.site_settings alter column active_currency set default 'PHP';
update public.site_settings set active_currency = 'PHP' where active_currency is distinct from 'PHP';

-- Rebrand: BidKita - Live Online Auction.
update public.site_settings set site_name = 'BidKita', tagline = 'Live Online Auction' where key = 'global';
update public.payment_methods
   set instructions = replace(instructions, 'Mazad Atna Ltd', 'BidKita')
 where instructions like '%Mazad Atna%';
