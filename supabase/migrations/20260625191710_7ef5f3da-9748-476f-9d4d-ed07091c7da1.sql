
-- wa_templates table (local mirror of Infobip WhatsApp templates)
CREATE TABLE IF NOT EXISTS public.wa_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  language text NOT NULL DEFAULT 'pt_BR',
  category text NOT NULL DEFAULT 'MARKETING',
  status text NOT NULL DEFAULT 'PENDING',
  status_reason text,
  header_type text,
  header_text text,
  body_text text NOT NULL,
  footer_text text,
  button_url_pattern text,
  button_text text,
  infobip_template_id text,
  last_synced_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, language)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_templates TO authenticated;
GRANT ALL ON public.wa_templates TO service_role;

ALTER TABLE public.wa_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_templates read"
  ON public.wa_templates FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), 'edit_templates')
    OR public.has_permission(auth.uid(), 'manage_infobip')
    OR public.has_permission(auth.uid(), 'view_all_campaigns')
  );

CREATE POLICY "wa_templates manage"
  ON public.wa_templates FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'edit_templates') OR public.has_permission(auth.uid(), 'manage_infobip'))
  WITH CHECK (public.has_permission(auth.uid(), 'edit_templates') OR public.has_permission(auth.uid(), 'manage_infobip'));

CREATE TRIGGER wa_templates_updated_at
  BEFORE UPDATE ON public.wa_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- campaign_deliveries table (per-number delivery log)
CREATE TABLE IF NOT EXISTS public.campaign_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  phone text NOT NULL,
  message_id text,
  status text NOT NULL DEFAULT 'sent',
  status_detail text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_deliveries_campaign_idx ON public.campaign_deliveries(campaign_id);
CREATE INDEX IF NOT EXISTS campaign_deliveries_message_idx ON public.campaign_deliveries(message_id);
CREATE UNIQUE INDEX IF NOT EXISTS campaign_deliveries_msg_uniq ON public.campaign_deliveries(message_id) WHERE message_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_deliveries TO authenticated;
GRANT ALL ON public.campaign_deliveries TO service_role;

ALTER TABLE public.campaign_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deliveries via campaign"
  ON public.campaign_deliveries FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
     WHERE c.id = campaign_deliveries.campaign_id
       AND (c.user_id = auth.uid() OR public.has_permission(auth.uid(), 'view_all_campaigns'))
  ));

-- Augment campaigns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS infobip_bulk_id text,
  ADD COLUMN IF NOT EXISTS infobip_template_id uuid REFERENCES public.wa_templates(id),
  ADD COLUMN IF NOT EXISTS delivered_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS infobip_meta jsonb;

ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_channel_chk;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_channel_chk CHECK (channel IN ('manual','infobip'));

-- app_settings.infobip default row
INSERT INTO public.app_settings(key, value)
VALUES ('infobip', '{"base_url": null, "default_sender": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;
