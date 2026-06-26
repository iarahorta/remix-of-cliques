CREATE OR REPLACE FUNCTION public.bump_short_link_click(_slug text)
 RETURNS TABLE(target text, is_rotating boolean, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_status text;
  v_rot boolean;
  v_target text;
  v_idx int;
  v_count int;
BEGIN
  SELECT sl.id, sl.status, sl.is_rotating, sl.target_url, sl.rotation_index
    INTO v_id, v_status, v_rot, v_target, v_idx
  FROM public.short_links sl WHERE sl.slug = _slug;
  IF v_id IS NULL THEN RETURN; END IF;

  IF v_rot THEN
    SELECT count(*) INTO v_count FROM public.short_link_urls WHERE short_link_id = v_id;
    IF v_count > 0 THEN
      SELECT u.url INTO v_target
        FROM public.short_link_urls u
        WHERE u.short_link_id = v_id
        ORDER BY u.sort_order
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

  target := v_target;
  is_rotating := v_rot;
  status := v_status;
  RETURN NEXT;
END;
$function$;