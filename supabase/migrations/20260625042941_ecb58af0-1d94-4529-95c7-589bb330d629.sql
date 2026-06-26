
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS client_display_name text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_method text,
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS payment_reference text;

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_payment_status_chk;
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_payment_status_chk CHECK (payment_status IN ('paid','unpaid','refunded'));

CREATE INDEX IF NOT EXISTS idx_campaigns_payment_status ON public.campaigns(payment_status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON public.campaigns(created_at DESC);
