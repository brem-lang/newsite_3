CREATE TABLE public.bid_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id uuid,
  user_id uuid,
  event text NOT NULL,
  outcome text NOT NULL,
  reason text,
  mode text,
  amount numeric,
  price_before numeric,
  price_after numeric,
  round integer,
  latency_ms integer,
  severity text NOT NULL DEFAULT 'info',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_date timestamp with time zone NOT NULL DEFAULT now(),
  updated_date timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bid_events TO authenticated;
GRANT ALL ON public.bid_events TO service_role;

ALTER TABLE public.bid_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view bid events" ON public.bid_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX bid_events_created_idx ON public.bid_events (created_date DESC);
CREATE INDEX bid_events_auction_idx ON public.bid_events (auction_id, created_date DESC);
CREATE INDEX bid_events_severity_idx ON public.bid_events (severity, created_date DESC);

CREATE TRIGGER touch_bid_events BEFORE UPDATE ON public.bid_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_date();