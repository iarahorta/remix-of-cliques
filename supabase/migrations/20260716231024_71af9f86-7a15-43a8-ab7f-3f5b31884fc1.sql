ALTER TABLE public.link_subscribers
  ADD COLUMN IF NOT EXISTS asaas_payment_link_id text,
  ADD COLUMN IF NOT EXISTS asaas_payment_link_url text;