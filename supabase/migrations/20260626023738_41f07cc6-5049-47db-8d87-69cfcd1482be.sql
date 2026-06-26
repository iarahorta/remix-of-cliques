CREATE POLICY "delete own or staff" ON public.campaigns
FOR DELETE TO authenticated
USING (user_id = auth.uid() OR private.has_permission(auth.uid(), 'view_all_campaigns'::public.app_permission));