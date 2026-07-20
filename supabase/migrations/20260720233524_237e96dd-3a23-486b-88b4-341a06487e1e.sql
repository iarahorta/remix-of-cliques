REVOKE INSERT, UPDATE, DELETE ON public.asgard_pix_charges FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.credit_balances FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.credit_transactions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.link_subscribers FROM anon, authenticated;

-- Explicit deny policies for clarity: no non-service-role writes are allowed.
-- Service role bypasses RLS and retains full write access via existing grants.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='asgard_pix_charges' AND policyname='deny writes to non-service') THEN
    CREATE POLICY "deny writes to non-service" ON public.asgard_pix_charges
      AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='credit_balances' AND policyname='deny writes to non-service') THEN
    CREATE POLICY "deny writes to non-service" ON public.credit_balances
      AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
    CREATE POLICY "deny updates to non-service" ON public.credit_balances
      AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
    CREATE POLICY "deny deletes to non-service" ON public.credit_balances
      AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='credit_transactions' AND policyname='deny writes to non-service') THEN
    CREATE POLICY "deny writes to non-service" ON public.credit_transactions
      AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
    CREATE POLICY "deny updates to non-service" ON public.credit_transactions
      AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
    CREATE POLICY "deny deletes to non-service" ON public.credit_transactions
      AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='link_subscribers' AND policyname='deny writes to non-service') THEN
    CREATE POLICY "deny writes to non-service" ON public.link_subscribers
      AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
    CREATE POLICY "deny updates to non-service" ON public.link_subscribers
      AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
    CREATE POLICY "deny deletes to non-service" ON public.link_subscribers
      AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);
  END IF;
END $$;