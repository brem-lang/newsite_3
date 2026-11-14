ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS auctions_featured_idx ON public.auctions (featured, featured_order);