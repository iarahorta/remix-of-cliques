
-- Hygiene stats + profile photo for campaigns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS hygiene_total integer,
  ADD COLUMN IF NOT EXISTS hygiene_valid integer,
  ADD COLUMN IF NOT EXISTS hygiene_invalid integer,
  ADD COLUMN IF NOT EXISTS hygiene_duplicates integer,
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS profile_photo_source text DEFAULT 'default';

-- Per-client permission to upload custom profile photo
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_customize_profile_photo boolean NOT NULL DEFAULT false;

-- App-wide settings (default campaign profile photo, etc.)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone authenticated reads" ON public.app_settings;
CREATE POLICY "anyone authenticated reads" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin writes" ON public.app_settings;
CREATE POLICY "admin writes" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings(key, value) VALUES ('default_campaign_photo', '{"url": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Allow admins to update other profiles (for can_customize_profile_photo toggle)
DROP POLICY IF EXISTS "admin updates any profile" ON public.profiles;
CREATE POLICY "admin updates any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
