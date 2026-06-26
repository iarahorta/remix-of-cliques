import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "admin" | "admin_jr" | "operator" | "client";

export type AppPermission =
  | "view_all_campaigns"
  | "download_campaign_files"
  | "download_valid_leads"
  | "edit_templates"
  | "manage_pricing"
  | "manage_niches"
  | "manage_users"
  | "view_shortener_admin"
  | "use_hygiene_tool"
  | "customize_profile_photo"
  | "manage_credits"
  | "manage_infobip";

export interface AuthState {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  permissions: AppPermission[];
  loading: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  hasPermission: (p: AppPermission) => boolean;
  /** Backward-compat helpers */
  canUseHygieneTool: boolean;
  canCustomizeProfilePhoto: boolean;
}

const STAFF_ROLES: AppRole[] = ["super_admin", "admin", "admin_jr", "operator"];

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<AppPermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setLoading(true);
        loadAccount(s.user.id).finally(() => setLoading(false));
      } else {
        setRoles([]);
        setPermissions([]);
        setLoading(false);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadAccount(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();

    async function loadAccount(uid: string) {
      const [{ data: rolesData }, { data: permsData }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("user_permissions" as any).select("permission").eq("user_id", uid),
      ]);
      setRoles((rolesData ?? []).map((r: any) => r.role as AppRole));
      setPermissions((permsData ?? []).map((r: any) => r.permission as AppPermission));
    }
  }, []);

  const isSuperAdmin = roles.includes("super_admin");
  const isAdmin = isSuperAdmin || roles.includes("admin");
  const isStaff = roles.some((r) => STAFF_ROLES.includes(r));

  const hasPermission = (p: AppPermission) => isAdmin || permissions.includes(p);

  return {
    session,
    user: session?.user ?? null,
    roles,
    permissions,
    loading,
    isSuperAdmin,
    isAdmin,
    isStaff,
    hasPermission,
    canUseHygieneTool: hasPermission("use_hygiene_tool"),
    canCustomizeProfilePhoto: hasPermission("customize_profile_photo"),
  };
}
