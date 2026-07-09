
-- Restrict app_settings SELECT to admins
DROP POLICY IF EXISTS "anyone authenticated reads" ON public.app_settings;
CREATE POLICY "admins read settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- Restrict message_templates SELECT to users with edit_templates permission
DROP POLICY IF EXISTS "auth reads templates" ON public.message_templates;
CREATE POLICY "managers read templates" ON public.message_templates
  FOR SELECT TO authenticated
  USING (private.has_permission(auth.uid(), 'edit_templates'::app_permission));

-- Restrict used_slugs SELECT to owners of the linked short_link (or admins)
DROP POLICY IF EXISTS "used_slugs readable by authenticated" ON public.used_slugs;
CREATE POLICY "owners read used_slugs" ON public.used_slugs
  FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.short_links sl
      WHERE sl.id = used_slugs.short_link_id AND sl.user_id = auth.uid()
    )
  );
