
ALTER TABLE public.short_links
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS infobip_template_id text,
  ADD COLUMN IF NOT EXISTS last_clicked_at timestamptz;

-- Normalize status enum: available | occupied | analysis
UPDATE public.short_links SET status='available' WHERE status IS NULL OR status NOT IN ('available','occupied','analysis');

-- Default short_link_domain in app_settings
INSERT INTO public.app_settings(key, value)
VALUES ('short_link', jsonb_build_object('domain', null))
ON CONFLICT (key) DO NOTHING;

-- bump_click helper used by the public redirect route
CREATE OR REPLACE FUNCTION public.bump_short_link_click(_slug text)
RETURNS TABLE(target text, is_rotating boolean, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_status text;
  v_rot boolean;
  v_target text;
  v_idx int;
  v_count int;
BEGIN
  SELECT id, status, is_rotating, target_url, rotation_index
    INTO v_id, v_status, v_rot, v_target, v_idx
  FROM public.short_links WHERE slug = _slug;
  IF v_id IS NULL THEN RETURN; END IF;

  IF v_rot THEN
    SELECT count(*) INTO v_count FROM public.short_link_urls WHERE short_link_id = v_id;
    IF v_count > 0 THEN
      SELECT url INTO v_target
        FROM public.short_link_urls
        WHERE short_link_id = v_id
        ORDER BY sort_order
        OFFSET (v_idx % v_count) LIMIT 1;
      UPDATE public.short_links
        SET rotation_index = (v_idx + 1) % v_count,
            click_count = click_count + 1,
            last_clicked_at = now()
        WHERE id = v_id;
    END IF;
  ELSE
    UPDATE public.short_links
      SET click_count = click_count + 1,
          last_clicked_at = now()
      WHERE id = v_id;
  END IF;

  RETURN QUERY SELECT v_target, v_rot, v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_short_link_click(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_short_link_click(text) TO service_role;
