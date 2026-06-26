
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS auto_dispatch boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_error text;

CREATE INDEX IF NOT EXISTS idx_campaigns_auto_dispatch_eligible
  ON public.campaigns (payment_status, dispatched_at, scheduled_at)
  WHERE auto_dispatch = true AND dispatched_at IS NULL AND payment_status = 'paid';
