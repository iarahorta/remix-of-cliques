
-- Fix mutable search_path on classify_short_link_click_bot
CREATE OR REPLACE FUNCTION public.classify_short_link_click_bot()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  ua text := lower(coalesce(NEW.user_agent, ''));
BEGIN
  IF ua = '' THEN
    NEW.is_bot := true;
  ELSIF ua ~ '(bot|crawler|spider|slurp|facebookexternalhit|whatsapp|telegrambot|discordbot|slackbot|skypeuripreview|linkedinbot|twitterbot|applebot|googlebot|bingbot|ahrefsbot|semrushbot|mj12bot|python-requests|curl|go-http-client|okhttp|headlesschrome|phantomjs|meta-externalagent|pingdom|uptimerobot|redditbot|pinterest|preview)' THEN
    NEW.is_bot := true;
  ELSE
    NEW.is_bot := false;
  END IF;
  RETURN NEW;
END;
$function$;

-- Scope admin management policy on landing_plans to authenticated only
DROP POLICY IF EXISTS "admins manage plans" ON public.landing_plans;
CREATE POLICY "admins manage plans" ON public.landing_plans
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.is_super_admin(auth.uid()))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.is_super_admin(auth.uid()));

-- Scope public reads policy explicitly to anon + authenticated (removes reliance on public role)
DROP POLICY IF EXISTS "public reads active plans" ON public.landing_plans;
CREATE POLICY "public reads active plans" ON public.landing_plans
  AS PERMISSIVE FOR SELECT
  TO anon, authenticated
  USING ((active = true) OR private.has_role(auth.uid(), 'admin'::app_role) OR private.is_super_admin(auth.uid()));

-- Scope subscriber self-read policy to authenticated only
DROP POLICY IF EXISTS "subscriber reads own row" ON public.link_subscribers;
CREATE POLICY "subscriber reads own row" ON public.link_subscribers
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((id = auth.uid()) OR private.has_permission(auth.uid(), 'view_shortener_admin'::app_permission));
