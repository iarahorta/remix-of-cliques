CREATE OR REPLACE FUNCTION public.record_short_link_visit(
  _slug text,
  _ip text DEFAULT NULL,
  _country text DEFAULT NULL,
  _region text DEFAULT NULL,
  _region_code text DEFAULT NULL,
  _city text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _referer text DEFAULT NULL
)
RETURNS TABLE(target text, status text, click_id uuid, is_bot boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_link public.short_links%rowtype;
  v_urls_count int;
  v_chosen text;
  v_next_cursor int;
  v_total_weight int;
  v_r int;
  v_acc int := 0;
  v_row record;
  v_click_id uuid;
  v_is_bot boolean;
BEGIN
  SELECT * INTO v_link
  FROM public.short_links
  WHERE slug = lower(trim(_slug));

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::text, 'not_found'::text, NULL::uuid, NULL::boolean;
    RETURN;
  END IF;

  IF v_link.status <> 'active' THEN
    RETURN QUERY SELECT NULL::text, v_link.status, NULL::uuid, NULL::boolean;
    RETURN;
  END IF;

  IF NOT COALESCE(v_link.is_rotating, false) THEN
    v_chosen := v_link.target_url;
  ELSE
    SELECT count(*) INTO v_urls_count
    FROM public.short_link_urls
    WHERE short_link_id = v_link.id;

    IF v_urls_count = 0 THEN
      v_chosen := v_link.target_url;
    ELSIF v_link.rotation_mode = 'random' THEN
      SELECT url INTO v_chosen
      FROM public.short_link_urls
      WHERE short_link_id = v_link.id
      ORDER BY random()
      LIMIT 1;
    ELSIF v_link.rotation_mode = 'weighted' THEN
      SELECT COALESCE(sum(weight), 0) INTO v_total_weight
      FROM public.short_link_urls
      WHERE short_link_id = v_link.id;

      IF v_total_weight <= 0 THEN
        SELECT url INTO v_chosen
        FROM public.short_link_urls
        WHERE short_link_id = v_link.id
        ORDER BY sort_order
        LIMIT 1;
      ELSE
        v_r := 1 + floor(random() * v_total_weight)::int;
        FOR v_row IN
          SELECT url, weight
          FROM public.short_link_urls
          WHERE short_link_id = v_link.id
          ORDER BY sort_order
        LOOP
          v_acc := v_acc + v_row.weight;
          IF v_r <= v_acc THEN
            v_chosen := v_row.url;
            EXIT;
          END IF;
        END LOOP;
      END IF;
    ELSIF v_link.rotation_mode = 'sticky' THEN
      SELECT url INTO v_chosen
      FROM public.short_link_urls
      WHERE short_link_id = v_link.id
      ORDER BY sort_order
      LIMIT 1;
    ELSE
      v_next_cursor := COALESCE(v_link.rotation_cursor, 0) % v_urls_count;
      SELECT url INTO v_chosen
      FROM public.short_link_urls
      WHERE short_link_id = v_link.id
      ORDER BY sort_order
      OFFSET v_next_cursor
      LIMIT 1;

      UPDATE public.short_links
      SET rotation_cursor = (v_next_cursor + 1) % v_urls_count
      WHERE id = v_link.id;
    END IF;
  END IF;

  IF v_chosen IS NULL OR btrim(v_chosen) = '' THEN
    RETURN QUERY SELECT NULL::text, 'missing_target'::text, NULL::uuid, NULL::boolean;
    RETURN;
  END IF;

  UPDATE public.short_links
  SET click_count = COALESCE(click_count, 0) + 1,
      last_clicked_at = now()
  WHERE id = v_link.id;

  INSERT INTO public.short_link_clicks(
    short_link_id,
    slug,
    target_url,
    ip,
    country,
    region,
    region_code,
    city,
    user_agent,
    referer
  ) VALUES (
    v_link.id,
    v_link.slug,
    v_chosen,
    NULLIF(_ip, ''),
    NULLIF(_country, ''),
    NULLIF(_region, ''),
    NULLIF(_region_code, ''),
    NULLIF(_city, ''),
    NULLIF(_user_agent, ''),
    NULLIF(_referer, '')
  )
  RETURNING id, short_link_clicks.is_bot INTO v_click_id, v_is_bot;

  RETURN QUERY SELECT v_chosen, v_link.status, v_click_id, v_is_bot;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_short_link_visit(text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_short_link_visit(text, text, text, text, text, text, text, text) TO service_role;