import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { useAuth, type AppPermission, type AppRole } from "@/hooks/use-auth";
import { listAdminUsers, sendPasswordResetForUser, setAdminUserPermission, setAdminUserRole } from "@/lib/admin-users.functions";
import { KeyRound, Loader2, Lock, RefreshCw, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — Admin HS Assessoria" }] }),
  component: UsuariosPage,
});

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  created_at?: string | null;
  missing_profile?: boolean;
};

const ALL_PERMS: { key: AppPermission; label: string; help: string }[] = [
  { key: "view_all_campaigns", label: "Ver todas as campanhas", help: "Acessa /admin/campanhas e abre pedidos de todos os clientes." },
  { key: "download_campaign_files", label: "Baixar arquivos das campanhas", help: "Template, lista e mídia anexada." },
  { key: "download_valid_leads", label: "Baixar leads válidos (Infobip)", help: "CSV de números higienizados pronto pra subir." },
  { key: "edit_templates", label: "Editar templates de mensagem", help: "Acessa /admin/templates." },
  { key: "manage_pricing", label: "Gerenciar preços", help: "/admin/valores e overrides por cliente." },
  { key: "manage_niches", label: "Gerenciar nichos", help: "Criar e editar nichos." },
  { key: "manage_users", label: "Gerenciar usuários", help: "/admin/usuarios — não consegue mexer em admins." },
  { key: "manage_credits", label: "Lançar créditos manuais", help: "Recargas e débitos manuais." },
  { key: "view_shortener_admin", label: "Ver encurtadores de todos", help: "Painel de encurtadores admin." },
  { key: "use_hygiene_tool", label: "Higienização avulsa", help: "Liberar /higienizacao." },
  { key: "customize_profile_photo", label: "Foto de perfil personalizada", help: "Permite enviar foto própria nas campanhas." },
];

const SELECTABLE_ROLES: { value: AppRole; label: string; description: string }[] = [
  { value: "client", label: "Cliente", description: "Acesso normal — só vê o próprio painel." },
  { value: "operator", label: "Operador", description: "Disparador. Só vê o que você marcar abaixo." },
  { value: "admin_jr", label: "Admin pequeno", description: "Sub-admin com acesso limitado às caixinhas marcadas." },
  { value: "admin", label: "Admin", description: "Acesso total ao painel (não muda papéis nem outros admins)." },
];

function UsuariosPage() {
  const { isSuperAdmin, hasPermission } = useAuth();
  const canManageUsers = hasPermission("manage_users");
  const listUsers = useServerFn(listAdminUsers);
  const updateRole = useServerFn(setAdminUserRole);
  const updatePermission = useServerFn(setAdminUserPermission);
  const resetPassword = useServerFn(sendPasswordResetForUser);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [rolesByUser, setRolesByUser] = useState<Record<string, AppRole[]>>({});
  const [permsByUser, setPermsByUser] = useState<Record<string, Set<AppPermission>>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listUsers();
      setProfiles(result.profiles ?? []);
      setRolesByUser(result.rolesByUser ?? {});
      const pMap: Record<string, Set<AppPermission>> = {};
      Object.entries(result.permsByUser ?? {}).forEach(([userId, permissions]) => {
        pMap[userId] = new Set(permissions as AppPermission[]);
      });
      setPermsByUser(pMap);
    } catch (e: any) {
      setError(e.message ?? String(e));
      setProfiles([]);
      setRolesByUser({});
      setPermsByUser({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const userRoleOf = (uid: string): AppRole => {
    const r = rolesByUser[uid] ?? [];
    if (r.includes("super_admin")) return "super_admin";
    if (r.includes("admin")) return "admin";
    if (r.includes("admin_jr")) return "admin_jr";
    if (r.includes("operator")) return "operator";
    return "client";
  };

  const isTargetProtected = (uid: string) => {
    const current = userRoleOf(uid);
    return current === "super_admin" || (current === "admin" && !isSuperAdmin);
  };

  const setRole = async (uid: string, newRole: AppRole) => {
    if (!isSuperAdmin) return;
    setSavingId(uid);
    setError(null);
    try {
      await updateRole({ data: { userId: uid, role: newRole } });
      await load();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSavingId(null);
    }
  };

  const togglePerm = async (uid: string, perm: AppPermission, currentlyOn: boolean) => {
    if (!isSuperAdmin) return;
    setSavingId(uid);
    setError(null);
    try {
      await updatePermission({ data: { userId: uid, permission: perm, enabled: !currentlyOn } });
      await load();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSavingId(null);
    }
  };

  const triggerReset = async (uid: string, email: string) => {
    if (!confirm(`Enviar link de redefinição de senha para ${email}?`)) return;
    setSavingId(uid);
    setError(null);
    setResetMsg(null);
    try {
      const res = await resetPassword({ data: { userId: uid, redirectOrigin: window.location.origin } });
      setResetMsg(`Link enviado para ${res.email}.`);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSavingId(null);
    }
  };


  const visibleProfiles = useMemo(() => {
    if (isSuperAdmin) return profiles;
    // manage_users (non super_admin) sees only non-admins
    return profiles.filter((p) => {
      const r = userRoleOf(p.id);
      return r !== "admin" && r !== "super_admin";
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, rolesByUser, isSuperAdmin]);

  if (!canManageUsers) {
    return (
      <PageShell title="Usuários" subtitle="Acesso restrito.">
        <div className="card-premium p-6 text-sm text-muted-foreground">Você não tem permissão para gerenciar usuários.</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Usuários"
      subtitle={isSuperAdmin
        ? "Defina o papel de cada pessoa e marque exatamente o que cada uma pode fazer."
        : "Visualização — apenas o admin-chefe pode alterar papéis e permissões."}
      actions={
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-4 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Atualizar lista
        </button>
      }
    >
      {error && (
        <div className="card-premium p-3 mb-4 text-sm text-destructive border border-destructive/40">
          <ShieldAlert className="inline h-4 w-4 mr-2" />{error}
        </div>
      )}
      {resetMsg && (
        <div className="card-premium p-3 mb-4 text-sm text-emerald-500 border border-emerald-500/40">
          {resetMsg}
        </div>
      )}

      <div className="card-premium p-4 md:p-6">
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin mb-2" /> Carregando...
          </div>
        ) : visibleProfiles.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Nenhum usuário ainda.</p>
        ) : (
          <div className="divide-y divide-border">
            {visibleProfiles.map((p) => {
              const role = userRoleOf(p.id);
              const protectedRow = isTargetProtected(p.id);
              const userPerms = permsByUser[p.id] ?? new Set<AppPermission>();
              const isOpen = expanded === p.id;
              return (
                <div key={p.id} className="py-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.full_name || p.email}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.email}{p.company ? ` · ${p.company}` : ""}{p.missing_profile ? " · perfil reparado ao alterar papel" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {role === "super_admin" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-gold-metal px-3 py-2 text-xs font-semibold">
                          <Lock className="h-3.5 w-3.5" /> Admin-chefe
                        </span>
                      ) : (
                        <select
                          value={role}
                          disabled={!isSuperAdmin || protectedRow || savingId === p.id}
                          onChange={(e) => setRole(p.id, e.target.value as AppRole)}
                          className="rounded-lg bg-input border border-border px-3 py-2 text-xs font-medium disabled:opacity-50"
                        >
                          {SELECTABLE_ROLES.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      )}
                      <button
                        onClick={() => triggerReset(p.id, p.email)}
                        disabled={savingId === p.id || (isTargetProtected(p.id) && !isSuperAdmin)}
                        title="Enviar link de redefinição de senha para o e-mail do usuário"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs hover:bg-secondary disabled:opacity-50"
                      >
                        <KeyRound className="h-3.5 w-3.5" /> Resetar senha
                      </button>
                      <button
                        onClick={() => setExpanded(isOpen ? null : p.id)}
                        className="rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs hover:bg-secondary"
                      >
                        {isOpen ? "Fechar" : "Permissões"}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-3 rounded-xl border border-border bg-secondary/20 p-4">
                      {role === "admin" || role === "super_admin" ? (
                        <p className="text-xs text-muted-foreground">
                          Admins têm todas as permissões automaticamente. Mude o papel para "Admin pequeno", "Operador" ou "Cliente" para marcar acessos individuais.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {ALL_PERMS.map((perm) => {
                            const on = userPerms.has(perm.key);
                            return (
                              <label
                                key={perm.key}
                                className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                                  on ? "border-[oklch(0.7_0.13_75)] bg-[oklch(0.34_0.06_70_/_0.25)]" : "border-border bg-input/40 hover:bg-input"
                                } ${!isSuperAdmin ? "cursor-not-allowed opacity-60" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={on}
                                  disabled={!isSuperAdmin || savingId === p.id}
                                  onChange={() => togglePerm(p.id, perm.key, on)}
                                  className="mt-0.5 h-4 w-4 accent-[oklch(0.78_0.14_75)]"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium">{perm.label}</p>
                                  <p className="text-[11px] text-muted-foreground leading-snug">{perm.help}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageShell>
  );
}
