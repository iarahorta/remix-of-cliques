CREATE TABLE public.subscriber_gifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscriber_id UUID NOT NULL REFERENCES public.link_subscribers(id) ON DELETE CASCADE,
  granted_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  days_granted INTEGER NOT NULL CHECK (days_granted > 0 AND days_granted <= 3650),
  previous_end_date DATE,
  new_end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriber_gifts_subscriber ON public.subscriber_gifts(subscriber_id, created_at DESC);

GRANT SELECT ON public.subscriber_gifts TO authenticated;
GRANT ALL ON public.subscriber_gifts TO service_role;

ALTER TABLE public.subscriber_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can read gifts"
  ON public.subscriber_gifts FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "subscribers can read own gifts"
  ON public.subscriber_gifts FOR SELECT
  TO authenticated
  USING (subscriber_id = auth.uid());