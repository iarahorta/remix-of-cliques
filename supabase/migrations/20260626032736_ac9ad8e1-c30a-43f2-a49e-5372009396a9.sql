CREATE TABLE public.landing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price_label text NOT NULL DEFAULT '',
  period_label text,
  description text,
  features text[] NOT NULL DEFAULT '{}',
  cta_label text NOT NULL DEFAULT 'Falar com consultor',
  cta_url text NOT NULL DEFAULT 'https://wa.me/5531975225821',
  highlighted boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.landing_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_plans TO authenticated;
GRANT ALL ON public.landing_plans TO service_role;

ALTER TABLE public.landing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public reads active plans"
  ON public.landing_plans FOR SELECT
  USING (active = true OR private.has_role(auth.uid(), 'admin'::public.app_role) OR private.is_super_admin(auth.uid()));

CREATE POLICY "admins manage plans"
  ON public.landing_plans FOR ALL
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.is_super_admin(auth.uid()))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.is_super_admin(auth.uid()));

CREATE TRIGGER landing_plans_touch_updated_at
  BEFORE UPDATE ON public.landing_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
