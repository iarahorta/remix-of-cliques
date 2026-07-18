
ALTER TABLE public.link_subscribers
  ADD COLUMN IF NOT EXISTS asgard_last_order_id text,
  ADD COLUMN IF NOT EXISTS asgard_last_charge_status text;

CREATE TABLE IF NOT EXISTS public.asgard_pix_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES public.link_subscribers(id) ON DELETE CASCADE,
  order_id text NOT NULL UNIQUE,
  transaction_id text,
  status text NOT NULL DEFAULT 'pending',
  amount numeric(10,2) NOT NULL,
  copy_paste text,
  qrcode text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS asgard_pix_charges_subscriber_idx ON public.asgard_pix_charges(subscriber_id);
CREATE INDEX IF NOT EXISTS asgard_pix_charges_status_idx ON public.asgard_pix_charges(status);

GRANT SELECT ON public.asgard_pix_charges TO authenticated;
GRANT ALL ON public.asgard_pix_charges TO service_role;

ALTER TABLE public.asgard_pix_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscribers read own asgard charges" ON public.asgard_pix_charges
  FOR SELECT TO authenticated
  USING (
    subscriber_id = auth.uid()
    OR private.has_permission(auth.uid(), 'view_shortener_admin'::public.app_permission)
  );

CREATE TRIGGER asgard_pix_charges_touch
  BEFORE UPDATE ON public.asgard_pix_charges
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
