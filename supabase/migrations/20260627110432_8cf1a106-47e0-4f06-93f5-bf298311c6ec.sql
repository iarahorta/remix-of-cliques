
CREATE TABLE public.used_slugs (
  slug text PRIMARY KEY,
  short_link_id uuid,
  first_used_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.used_slugs TO authenticated;
GRANT ALL ON public.used_slugs TO service_role;

ALTER TABLE public.used_slugs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "used_slugs readable by authenticated"
  ON public.used_slugs FOR SELECT
  TO authenticated
  USING (true);

-- Backfill from existing links
INSERT INTO public.used_slugs (slug, short_link_id, first_used_at)
SELECT slug, id, created_at FROM public.short_links
ON CONFLICT (slug) DO NOTHING;

-- Trigger: block reuse of any slug ever created
CREATE OR REPLACE FUNCTION public.enforce_unique_slug_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.used_slugs WHERE slug = NEW.slug) THEN
    RAISE EXCEPTION 'slug_already_used: % was previously used and cannot be reused', NEW.slug
      USING ERRCODE = 'unique_violation';
  END IF;
  INSERT INTO public.used_slugs (slug, short_link_id) VALUES (NEW.slug, NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_short_links_unique_slug_history
  BEFORE INSERT ON public.short_links
  FOR EACH ROW EXECUTE FUNCTION public.enforce_unique_slug_history();
