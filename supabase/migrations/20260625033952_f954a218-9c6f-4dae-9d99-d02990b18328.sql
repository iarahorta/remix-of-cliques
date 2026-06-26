
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_jr';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_permission') THEN
    CREATE TYPE public.app_permission AS ENUM (
      'view_all_campaigns',
      'download_campaign_files',
      'download_valid_leads',
      'edit_templates',
      'manage_pricing',
      'manage_niches',
      'manage_users',
      'view_shortener_admin',
      'use_hygiene_tool',
      'customize_profile_photo',
      'manage_credits'
    );
  END IF;
END $$;
