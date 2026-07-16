alter table public.link_subscribers
  add column if not exists asaas_customer_id text,
  add column if not exists asaas_subscription_id text,
  add column if not exists asaas_last_payment_id text,
  add column if not exists asaas_last_payment_status text,
  add column if not exists asaas_last_invoice_url text,
  add column if not exists overdue_since timestamptz;

create index if not exists link_subscribers_asaas_customer_idx
  on public.link_subscribers(asaas_customer_id);
create index if not exists link_subscribers_asaas_subscription_idx
  on public.link_subscribers(asaas_subscription_id);