ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS round integer NOT NULL DEFAULT 1;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS round integer NOT NULL DEFAULT 1;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS bids_auction_round_idx ON public.bids (auction_id, round);