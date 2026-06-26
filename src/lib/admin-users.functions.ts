import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppPermission, AppRole } from "@/hooks/use-auth";

const roleSchema = z.enum(["client", "operator", "admin_jr", "admin"]);
const permissionSchema = z.enum([
  "view_all_campaigns",
  "download_campaign_files",
  "download_valid_leads",
  "edit_templates",
  "manage_pricing",
  "manage_niches",
  "manage_users",
  "view_shortener_admin",
  "use_hygiene_tool",
  "customize_profile_photo",
  "manage_credits",
]);

type AdminProfile = {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  created_at: string | null;
  missing_profile?: boolean;
};

type CallerAccess = {
  isSuperAdmin: boolean;
  isAdmin: boolean;
  canManageUsers: boolean;
};

async function getCallerAccess(supabaseAdmin: any, userId: string): Promise<CallerAccess> {
  const [{ data: roles, error: rolesError }, { data: perms, error: permsError }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    supabaseAdmin.from("user_permissions").select("permission").eq("user_id", userId),
  ]);

  if (rolesError) throw new Error(rolesError.message);
  if (permsError) throw new Error(permsError.message);

  const roleSet = new Set(((roles ?? []) as { role: AppRole }[]).map((r) => r.role));
  const permSet = new Set(((perms ?? []) as { permission: AppPermission }[]).map((p) => p.permission));
  const isSuperAdmin = roleSet.has("super_admin");
  const isAdmin = isSuperAdmin || roleSet.has("admin");

  return {
    isSuperAdmin,
    isAdmin,
    canManageUsers: isAdmin || permSet.has("manage_users"),
  };
}

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await getCallerAccess(supabaseAdmin, context.userId);
    if (!access.canManageUsers) throw new Error("Sem permissão para gerenciar usuários.");

    const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }, { data: perms, error: permsError }, authResult] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, email, full_name, company, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("user_permissions").select("user_id, permission"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    if (profilesError) throw new Error(profilesError.message);
    if (rolesError) throw new Error(rolesError.message);
    if (permsError) throw new Error(permsError.message);

    const merged = new Map<string, AdminProfile>();
    ((profiles ?? []) as AdminProfile[]).forEach((profile) => merged.set(profile.id, profile));

    if (!authResult.error) {
      for (const authUser of authResult.data.users) {
        if (!merged.has(authUser.id)) {
          merged.set(authUser.id, {
            id: authUser.id,
            email: authUser.email ?? "sem-email",
            full_name: (authUser.user_metadata?.full_name as string | undefined) ?? null,
            company: null,
            created_at: authUser.created_at ?? null,
            missing_profile: true,
          });
        }
      }
    }

    const roleMap: Record<string, AppRole[]> = {};
    ((roles ?? []) as { user_id: string; role: AppRole }[]).forEach((role) => {
      (roleMap[role.user_id] = roleMap[role.user_id] ?? []).push(role.role);
    });

    const permMap: Record<string, AppPermission[]> = {};
    ((perms ?? []) as { user_id: string; permission: AppPermission }[]).forEach((perm) => {
      (permMap[perm.user_id] = permMap[perm.user_id] ?? []).push(perm.permission);
    });

    const profilesList = Array.from(merged.values())
      .filter((profile) => access.isSuperAdmin || !["admin", "super_admin"].some((role) => roleMap[profile.id]?.includes(role as AppRole)))
      .sort((a, b) => (Date.parse(b.created_at ?? "") || 0) - (Date.parse(a.created_at ?? "") || 0));

    return {
      profiles: profilesList,
      rolesByUser: roleMap,
      permsByUser: permMap,
      isSuperAdmin: access.isSuperAdmin,
    };
  });

export const setAdminUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid(), role: roleSchema }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await getCallerAccess(supabaseAdmin, context.userId);
    if (!access.isSuperAdmin) throw new Error("Só o admin-chefe pode alterar papéis.");

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (authUser?.user) {
      const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
        id: authUser.user.id,
        email: authUser.user.email ?? "sem-email",
        full_name: (authUser.user.user_metadata?.full_name as string | undefined) ?? "",
      }, { onConflict: "id" });
      if (profileError) throw new Error(profileError.message);
    }

    const { error: deleteError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .in("role", ["admin", "admin_jr", "operator", "client"]);
    if (deleteError) throw new Error(deleteError.message);

    const { error: insertError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (insertError) throw new Error(insertError.message);

    return { ok: true };
  });

export const setAdminUserPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid(), permission: permissionSchema, enabled: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await getCallerAccess(supabaseAdmin, context.userId);
    if (!access.isSuperAdmin) throw new Error("Só o admin-chefe pode alterar permissões.");

    if (data.enabled) {
      const { error } = await supabaseAdmin
        .from("user_permissions")
        .upsert({ user_id: data.userId, permission: data.permission }, { onConflict: "user_id,permission" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_permissions")
        .delete()
        .eq("user_id", data.userId)
        .eq("permission", data.permission);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

export const sendPasswordResetForUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), redirectOrigin: z.string().url() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const access = await getCallerAccess(supabaseAdmin, context.userId);
    if (!access.canManageUsers) throw new Error("Sem permissão para resetar senhas.");

    const { data: authUser, error: userErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (userErr) throw new Error(userErr.message);
    if (!authUser?.user?.email) throw new Error("Usuário sem e-mail cadastrado.");

    // Block resetting another admin/super_admin unless caller is super_admin
    const { data: targetRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    const targetIsAdmin = ((targetRoles ?? []) as { role: AppRole }[]).some(
      (r) => r.role === "admin" || r.role === "super_admin",
    );
    if (targetIsAdmin && !access.isSuperAdmin) {
      throw new Error("Apenas o admin-chefe pode resetar senha de outros admins.");
    }

    const redirectTo = `${data.redirectOrigin.replace(/\/$/, "")}/reset-password`;
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(authUser.user.email, {
      redirectTo,
    });
    if (error) throw new Error(error.message);

    return { ok: true, email: authUser.user.email };
  });