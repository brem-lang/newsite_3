CREATE TABLE public.auction_cost_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'other',
  label text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auction_cost_items TO authenticated;
GRANT ALL ON public.auction_cost_items TO service_role;
ALTER TABLE public.auction_cost_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage auction cost items" ON public.auction_cost_items FOR ALL TO authenticated
  USING (public.can_manage_media(auth.uid())) WITH CHECK (public.can_manage_media(auth.uid()));
CREATE INDEX idx_auction_cost_items_auction ON public.auction_cost_items(auction_id);
CREATE TRIGGER touch_auction_cost_items BEFORE UPDATE ON public.auction_cost_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_date();

CREATE TABLE public.auction_finance_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL UNIQUE REFERENCES public.auctions(id) ON DELETE CASCADE,
  cost_price numeric,
  other_cost numeric,
  income_adjust numeric NOT NULL DEFAULT 0,
  note text,
  created_by uuid,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auction_finance_overrides TO authenticated;
GRANT ALL ON public.auction_finance_overrides TO service_role;
ALTER TABLE public.auction_finance_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage auction finance overrides" ON public.auction_finance_overrides FOR ALL TO authenticated
  USING (public.can_manage_media(auth.uid())) WITH CHECK (public.can_manage_media(auth.uid()));
CREATE TRIGGER touch_auction_finance_overrides BEFORE UPDATE ON public.auction_finance_overrides
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_date();

CREATE TABLE public.auction_finance_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  field text NOT NULL,
  old_value text,
  new_value text,
  note text,
  actor_id uuid,
  actor_name text,
  created_by uuid,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.auction_finance_changes TO authenticated;
GRANT ALL ON public.auction_finance_changes TO service_role;
ALTER TABLE public.auction_finance_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read auction finance changes" ON public.auction_finance_changes FOR SELECT TO authenticated
  USING (public.can_manage_media(auth.uid()));
CREATE POLICY "Admins write auction finance changes" ON public.auction_finance_changes FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_media(auth.uid()));
CREATE INDEX idx_auction_finance_changes_auction ON public.auction_finance_changes(auction_id, created_date DESC);
CREATE TRIGGER touch_auction_finance_changes BEFORE UPDATE ON public.auction_finance_changes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_date();