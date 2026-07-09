
CREATE TABLE public.short_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_link_id uuid NOT NULL REFERENCES public.short_links(id) ON DELETE CASCADE,
  slug text NOT NULL,
  target_url text,
  ip text,
  country text,
  region text,
  city text,
  user_agent text,
  referer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_short_link_clicks_link_created ON public.short_link_clicks (short_link_id, created_at DESC);

GRANT SELECT ON public.short_link_clicks TO authenticated;
GRANT ALL ON public.short_link_clicks TO service_role;

ALTER TABLE public.short_link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read clicks" ON public.short_link_clicks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.short_links sl
      WHERE sl.id = short_link_clicks.short_link_id
        AND (sl.user_id = auth.uid() OR private.has_permission(auth.uid(), 'view_shortener_admin'::app_permission))
    )
  );
