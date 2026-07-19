
CREATE TYPE public.partner_type AS ENUM ('manager','white_label','affiliate','agency','reseller');
CREATE TYPE public.partner_status AS ENUM ('active','inactive','suspended');
CREATE TYPE public.commission_status AS ENUM ('pending','approved','paid','canceled','reversed');

CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_token text NOT NULL UNIQUE,
  type public.partner_type NOT NULL DEFAULT 'affiliate',
  name text NOT NULL,
  email text, phone text, tax_id text, pix_key text, pix_key_type text,
  default_commission_bps int NOT NULL DEFAULT 2000 CHECK (default_commission_bps BETWEEN 0 AND 10000),
  status public.partner_status NOT NULL DEFAULT 'active',
  notes text, owner_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX partners_status_idx ON public.partners(status);
CREATE INDEX partners_type_idx ON public.partners(type);

CREATE OR REPLACE FUNCTION public.generate_partner_token()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  alphabet text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  result text; i int; b bytea;
BEGIN
  LOOP
    result := ''; b := gen_random_bytes(10);
    FOR i IN 0..9 LOOP
      result := result || substr(alphabet, (get_byte(b, i) % 62) + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.partners WHERE public_token = result);
  END LOOP;
  RETURN result;
END; $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partners TO authenticated;
GRANT ALL ON public.partners TO service_role;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY partners_admin_select ON public.partners FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'super_admin'::public.app_role));
CREATE POLICY partners_admin_insert ON public.partners FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'super_admin'::public.app_role));
CREATE POLICY partners_admin_update ON public.partners FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'super_admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'super_admin'::public.app_role));
CREATE POLICY partners_admin_delete ON public.partners FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::public.app_role));
CREATE TRIGGER partners_touch BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.partners_set_token()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.public_token IS NULL OR NEW.public_token = '' THEN
    NEW.public_token := public.generate_partner_token();
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER partners_set_token_trg BEFORE INSERT ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.partners_set_token();

CREATE TABLE public.partner_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  product_code text NOT NULL,
  commission_bps int NOT NULL CHECK (commission_bps BETWEEN 0 AND 10000),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(partner_id, product_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_products TO authenticated;
GRANT ALL ON public.partner_products TO service_role;
ALTER TABLE public.partner_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY pp_admin_all ON public.partner_products FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'super_admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'super_admin'::public.app_role));
CREATE TRIGGER pp_touch BEFORE UPDATE ON public.partner_products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.gateway_fee_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway text NOT NULL, method text NOT NULL,
  fixed_cents int NOT NULL DEFAULT 0,
  percent_bps int NOT NULL DEFAULT 0 CHECK (percent_bps BETWEEN 0 AND 10000),
  active boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gfr_lookup ON public.gateway_fee_rules(gateway, method, active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gateway_fee_rules TO authenticated;
GRANT ALL ON public.gateway_fee_rules TO service_role;
ALTER TABLE public.gateway_fee_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY gfr_admin_all ON public.gateway_fee_rules FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'super_admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'super_admin'::public.app_role));
CREATE TRIGGER gfr_touch BEFORE UPDATE ON public.gateway_fee_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.gateway_fee_rules (gateway, method, fixed_cents, percent_bps, notes)
VALUES ('asgard','pix',0,0,'Regra inicial — ajustar com a taxa real do Asgard');

CREATE TABLE public.partner_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
  public_token text NOT NULL,
  visitor_id text NOT NULL,
  subscriber_id uuid REFERENCES public.link_subscribers(id) ON DELETE SET NULL,
  landing_url text,
  utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  referer text, ip_hash text, user_agent text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  attributed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pr_visitor ON public.partner_referrals(visitor_id);
CREATE INDEX pr_partner ON public.partner_referrals(partner_id);
CREATE INDEX pr_subscriber ON public.partner_referrals(subscriber_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_referrals TO authenticated;
GRANT ALL ON public.partner_referrals TO service_role;
ALTER TABLE public.partner_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY pr_admin_all ON public.partner_referrals FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'super_admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'super_admin'::public.app_role));

CREATE TABLE public.partner_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
  subscriber_id uuid REFERENCES public.link_subscribers(id) ON DELETE SET NULL,
  product_code text NOT NULL DEFAULT 'zpclik',
  source_type text NOT NULL, source_id text NOT NULL,
  gross_cents int NOT NULL CHECK (gross_cents >= 0),
  gateway_fee_cents int NOT NULL DEFAULT 0 CHECK (gateway_fee_cents >= 0),
  other_fee_cents int NOT NULL DEFAULT 0 CHECK (other_fee_cents >= 0),
  net_cents int GENERATED ALWAYS AS (gross_cents - gateway_fee_cents - other_fee_cents) STORED,
  commission_bps int NOT NULL CHECK (commission_bps BETWEEN 0 AND 10000),
  commission_cents int NOT NULL CHECK (commission_cents >= 0),
  status public.commission_status NOT NULL DEFAULT 'pending',
  paid_at timestamptz, paid_method text, paid_ref text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_type, source_id)
);
CREATE INDEX pc_partner_status ON public.partner_commissions(partner_id, status);
CREATE INDEX pc_subscriber ON public.partner_commissions(subscriber_id);
CREATE INDEX pc_created ON public.partner_commissions(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_commissions TO authenticated;
GRANT ALL ON public.partner_commissions TO service_role;
ALTER TABLE public.partner_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pc_admin_all ON public.partner_commissions FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'super_admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'super_admin'::public.app_role));
CREATE TRIGGER pc_touch BEFORE UPDATE ON public.partner_commissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.partner_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
  total_cents int NOT NULL CHECK (total_cents >= 0),
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz, paid_ref text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_payouts TO authenticated;
GRANT ALL ON public.partner_payouts TO service_role;
ALTER TABLE public.partner_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY po_admin_all ON public.partner_payouts FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'super_admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'super_admin'::public.app_role));
CREATE TRIGGER po_touch BEFORE UPDATE ON public.partner_payouts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.link_subscribers
  ADD COLUMN partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  ADD COLUMN referral_id uuid REFERENCES public.partner_referrals(id) ON DELETE SET NULL,
  ADD COLUMN attributed_at timestamptz;
CREATE INDEX ls_partner ON public.link_subscribers(partner_id);

CREATE OR REPLACE FUNCTION public.protect_subscriber_attribution()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF OLD.partner_id IS NOT NULL AND NEW.partner_id IS DISTINCT FROM OLD.partner_id THEN
    RAISE EXCEPTION 'partner attribution is immutable';
  END IF;
  IF OLD.referral_id IS NOT NULL AND NEW.referral_id IS DISTINCT FROM OLD.referral_id THEN
    RAISE EXCEPTION 'referral attribution is immutable';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER ls_protect_attribution BEFORE UPDATE ON public.link_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.protect_subscriber_attribution();

CREATE OR REPLACE FUNCTION public.resolve_commission_bps(_partner_id uuid, _product_code text)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT commission_bps FROM public.partner_products
      WHERE partner_id = _partner_id AND product_code = _product_code AND active LIMIT 1),
    (SELECT default_commission_bps FROM public.partners WHERE id = _partner_id)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.resolve_commission_bps(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_partner_by_token(_token text)
RETURNS TABLE(token text, active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public_token, (status = 'active')
  FROM public.partners WHERE public_token = _token;
$$;
REVOKE EXECUTE ON FUNCTION public.get_partner_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_partner_by_token(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_partner_commission(
  _source_type text, _source_id text, _subscriber_id uuid, _gross_cents int,
  _product_code text DEFAULT 'zpclik', _gateway text DEFAULT 'asgard', _method text DEFAULT 'pix'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_partner uuid; v_bps int; v_fixed int := 0; v_pct int := 0; v_fee int := 0;
  v_commission int; v_id uuid;
BEGIN
  SELECT partner_id INTO v_partner FROM public.link_subscribers WHERE id = _subscriber_id;
  IF v_partner IS NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.partners WHERE id = v_partner AND status = 'active') THEN
    RETURN NULL;
  END IF;
  v_bps := public.resolve_commission_bps(v_partner, _product_code);
  IF v_bps IS NULL OR v_bps = 0 THEN RETURN NULL; END IF;
  SELECT fixed_cents, percent_bps INTO v_fixed, v_pct
  FROM public.gateway_fee_rules
  WHERE gateway = _gateway AND method = _method AND active
    AND (effective_to IS NULL OR effective_to > now()) AND effective_from <= now()
  ORDER BY effective_from DESC LIMIT 1;
  v_fee := COALESCE(v_fixed,0) + (_gross_cents * COALESCE(v_pct,0) / 10000);
  IF v_fee < 0 THEN v_fee := 0; END IF;
  IF v_fee > _gross_cents THEN v_fee := _gross_cents; END IF;
  v_commission := ((_gross_cents - v_fee) * v_bps) / 10000;
  INSERT INTO public.partner_commissions(
    partner_id, subscriber_id, product_code, source_type, source_id,
    gross_cents, gateway_fee_cents, commission_bps, commission_cents, status
  ) VALUES (
    v_partner, _subscriber_id, _product_code, _source_type, _source_id,
    _gross_cents, v_fee, v_bps, v_commission, 'pending'
  )
  ON CONFLICT (source_type, source_id) DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.record_partner_commission(text,text,uuid,int,text,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reverse_partner_commission(_source_type text, _source_id text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.partner_commissions
    SET status = CASE WHEN status = 'paid'::public.commission_status
                      THEN 'reversed'::public.commission_status
                      ELSE 'canceled'::public.commission_status END,
        updated_at = now()
    WHERE source_type = _source_type AND source_id = _source_id;
$$;
REVOKE EXECUTE ON FUNCTION public.reverse_partner_commission(text,text) FROM PUBLIC, anon, authenticated;
