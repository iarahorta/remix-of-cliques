import { createFileRoute, redirect } from "@tanstack/react-router";
import { Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/login" });

    const [{ data: roles }, { data: perms }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      supabase.from("user_permissions" as any).select("permission").eq("user_id", u.user.id),
    ]);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role as string));
    const permSet = new Set((perms ?? []).map((r: any) => r.permission as string));
    const isAdmin = roleSet.has("admin") || roleSet.has("super_admin");
    const isSuperAdmin = roleSet.has("super_admin");
    const adminPerms = ["view_all_campaigns", "edit_templates", "manage_pricing", "manage_users", "manage_niches", "manage_credits", "manage_infobip"];
    const hasAnyAdminAccess = isAdmin || adminPerms.some((p) => permSet.has(p));
    if (!hasAnyAdminAccess) throw redirect({ to: "/painel" });
    return { isAdmin, isSuperAdmin, permissions: Array.from(permSet) };
  },
  component: () => <Outlet />,
});
