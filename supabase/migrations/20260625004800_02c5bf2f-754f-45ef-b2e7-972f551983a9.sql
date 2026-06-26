
-- ===== ROLES =====
CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'client');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','operator'))
$$;

CREATE POLICY "users see own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ===== PROFILES =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  company TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own or staff" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "update own or admin" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "insert own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Trigger to auto-create profile + assign role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles(id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  SELECT NOT EXISTS(SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO is_first;
  IF is_first THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'client');
  END IF;
  INSERT INTO public.credit_balances(user_id, balance_cents) VALUES (NEW.id, 0)
    ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

-- ===== CREDIT BALANCES (R$ in cents) =====
CREATE TABLE public.credit_balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_cents BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_balances TO authenticated;
GRANT ALL ON public.credit_balances TO service_role;
ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own or staff" ON public.credit_balances FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- ===== CREDIT TRANSACTIONS =====
CREATE TYPE public.tx_type AS ENUM ('recharge','debit','refund','adjustment');
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type tx_type NOT NULL,
  amount_cents BIGINT NOT NULL,
  balance_after_cents BIGINT NOT NULL,
  campaign_id UUID,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own or staff" ON public.credit_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- ===== NICHES (pricing per message in cents) =====
CREATE TABLE public.niches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.niches TO authenticated, anon;
GRANT ALL ON public.niches TO service_role;
ALTER TABLE public.niches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads active niches" ON public.niches FOR SELECT USING (TRUE);
CREATE POLICY "admins manage niches" ON public.niches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.niches(slug,name,price_cents,icon,sort_order) VALUES
  ('black','Black',30,'gem',1),
  ('rifa','Rifa',18,'ticket',2),
  ('bet','Bet',28,'trending-up',3),
  ('white','White',17,'shield-check',4),
  ('politica','Política',26,'landmark',5),
  ('ob','OB',18,'user',6);

-- ===== CLIENT PRICING OVERRIDES =====
CREATE TABLE public.client_pricing_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  niche_id UUID NOT NULL REFERENCES public.niches(id) ON DELETE CASCADE,
  price_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, niche_id)
);
GRANT SELECT ON public.client_pricing_overrides TO authenticated;
GRANT ALL ON public.client_pricing_overrides TO service_role;
ALTER TABLE public.client_pricing_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own or staff" ON public.client_pricing_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "admins manage" ON public.client_pricing_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ===== MESSAGE TEMPLATES (fixed by admin) =====
CREATE TABLE public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_fixed BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth reads templates" ON public.message_templates FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "admins manage templates" ON public.message_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.message_templates(name,content,variables,is_fixed,sort_order) VALUES
  ('Oferta padrão',
   'Olá {{1}}! Temos uma novidade: {{2}}. {{3}} Para {{4}}, use o botão abaixo',
   '[{"key":"1","label":"Saudação","placeholder":"Ex: Lucas","optional":true},{"key":"2","label":"Informação principal","placeholder":"Ex: oferta exclusiva"},{"key":"3","label":"Detalhes","placeholder":"Ex: Constam informações disponíveis para consulta em nosso portal...","optional":true},{"key":"4","label":"Ação","placeholder":"Ex: garantir o seu"}]'::jsonb,
   TRUE, 1);

-- ===== CAMPAIGNS =====
CREATE TYPE public.campaign_status AS ENUM ('draft','scheduled','processing','completed','cancelled');
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  niche_id UUID REFERENCES public.niches(id),
  template_id UUID REFERENCES public.message_templates(id),
  message TEXT NOT NULL,
  template_data JSONB DEFAULT '{}'::jsonb,
  link TEXT,
  short_link_id UUID,
  send_count INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  debit_cents BIGINT NOT NULL,
  refund_cents BIGINT NOT NULL DEFAULT 0,
  delivered_count INTEGER,
  failed_count INTEGER,
  status campaign_status NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own or staff" ON public.campaigns FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "insert own" ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "update own or staff" ON public.campaigns FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- ===== CAMPAIGN FILES =====
CREATE TYPE public.file_kind AS ENUM ('contacts','media','report');
CREATE TABLE public.campaign_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  kind file_kind NOT NULL,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  size_bytes BIGINT,
  mime TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.campaign_files TO authenticated;
GRANT ALL ON public.campaign_files TO service_role;
ALTER TABLE public.campaign_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "via campaign" ON public.campaign_files FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id
    AND (c.user_id = auth.uid() OR public.is_staff(auth.uid()))));
CREATE POLICY "insert via campaign" ON public.campaign_files FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id
    AND (c.user_id = auth.uid() OR public.is_staff(auth.uid()))));
CREATE POLICY "delete via campaign" ON public.campaign_files FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id
    AND (c.user_id = auth.uid() OR public.is_staff(auth.uid()))));

-- ===== SHORT LINKS =====
CREATE TABLE public.short_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  is_rotating BOOLEAN NOT NULL DEFAULT FALSE,
  target_url TEXT,
  rotation_index INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.short_links TO authenticated;
GRANT SELECT ON public.short_links TO anon;
GRANT ALL ON public.short_links TO service_role;
ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public resolve" ON public.short_links FOR SELECT USING (TRUE);
CREATE POLICY "own or staff write" ON public.short_links FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE public.short_link_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_link_id UUID NOT NULL REFERENCES public.short_links(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.short_link_urls TO authenticated;
GRANT SELECT ON public.short_link_urls TO anon;
GRANT ALL ON public.short_link_urls TO service_role;
ALTER TABLE public.short_link_urls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public resolve urls" ON public.short_link_urls FOR SELECT USING (TRUE);
CREATE POLICY "owner staff write" ON public.short_link_urls FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.short_links sl WHERE sl.id = short_link_id
    AND (sl.user_id = auth.uid() OR public.is_staff(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.short_links sl WHERE sl.id = short_link_id
    AND (sl.user_id = auth.uid() OR public.is_staff(auth.uid()))));

-- ===== updated_at trigger =====
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER t_profiles_u BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_niches_u BEFORE UPDATE ON public.niches FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_templates_u BEFORE UPDATE ON public.message_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_campaigns_u BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_shortlinks_u BEFORE UPDATE ON public.short_links FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== Signup trigger =====
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
