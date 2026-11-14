CREATE TABLE public.cron_tokens (
  name text PRIMARY KEY,
  token text NOT NULL,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.cron_tokens TO service_role;

ALTER TABLE public.cron_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cron_tokens_service_only" ON public.cron_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER touch_cron_tokens BEFORE UPDATE ON public.cron_tokens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_date();

INSERT INTO public.cron_tokens (name, token)
VALUES ('auction_tick', encode(gen_random_bytes(24), 'hex'))
ON CONFLICT (name) DO NOTHING;