
DROP POLICY IF EXISTS "Public can read short_links" ON public.short_links;
DROP POLICY IF EXISTS "Public read short_links" ON public.short_links;
DROP POLICY IF EXISTS "short_links_public_read" ON public.short_links;
DROP POLICY IF EXISTS "Anyone can read short links" ON public.short_links;
DROP POLICY IF EXISTS "Public can read short_link_urls" ON public.short_link_urls;
DROP POLICY IF EXISTS "Public read short_link_urls" ON public.short_link_urls;
DROP POLICY IF EXISTS "short_link_urls_public_read" ON public.short_link_urls;
DROP POLICY IF EXISTS "Anyone can read short link urls" ON public.short_link_urls;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='short_links' AND roles::text LIKE '%public%' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.short_links', r.policyname);
  END LOOP;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='short_link_urls' AND roles::text LIKE '%public%' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.short_link_urls', r.policyname);
  END LOOP;
END $$;

REVOKE SELECT ON public.short_links FROM anon;
REVOKE SELECT ON public.short_link_urls FROM anon;
