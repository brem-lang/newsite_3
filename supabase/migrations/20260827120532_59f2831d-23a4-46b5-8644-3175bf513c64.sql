ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS min_participants integer,
  ADD COLUMN IF NOT EXISTS winner_name text;

UPDATE public.auctions SET min_participants = max_subscribers WHERE min_participants IS NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_country_code text,
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text,
  ADD COLUMN IF NOT EXISTS address_country text,
  ADD COLUMN IF NOT EXISTS address_zip text;