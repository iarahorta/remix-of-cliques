import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  getMySubscription,
  createSubscriberLink,
  createSubscriberRotatingLink,
  listMySubscriberLinks,
  getMyLinkMetrics,
  updateSubscriberLinkTarget,
  updateSubscriberLinkRotation,
  convertSubscriberLinkToSingle,
} from "@/lib/link-subscribers.functions";
import {
  Loader2, Copy, Check, ExternalLink, BarChart3, X, LogOut, Link2, AlertTriangle, Pencil, Plus, Trash2, Shuffle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/clientes/dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Meu Painel — cliques" }, { name: "robots", content: "noindex,nofollow" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/clientes" });
  },
  component: ClientesDashboard,
});

interface Sub {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  current_period_end: string | null;
  last_payment_at: string | null;
  plan_price_cents: number;
}

interface RotationUrl { url: string; weight: number; sort_order: number }
interface MyLink {
  id: string;
  slug: string;
  target_url: string | null;
  label: string | null;
  click_count: number;
  status: string;
  created_at: string;
  last_clicked_at: string | null;
  is_rotating: boolean;
  rotation_mode: "round_robin" | "random" | "weighted" | "sticky";
  short_link_urls: RotationUrl[];
}

type RotationMode = "round_robin" | "random" | "weighted" | "sticky";
const ROTATION_LABELS: Record<RotationMode, string> = {
  round_robin: "Alternado (round-robin)",
  random: "Aleatório",
  weighted: "Ponderado (por peso)",
  sticky: "Sequencial fixo",
};

const PIX_KEY = "iarachorta@gmail.com";

function normalizePhone(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D+/g, "");
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return null;
}

function buildWaUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function parseWaUrl(url: string | null): { phone: string; message: string } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname !== "wa.me") return null;
    const phone = u.pathname.replace(/^\/+/, "");
    const message = u.searchParams.get("text") ?? "";
    return { phone, message };
  } catch { return null; }
}

type RotRow = { kind: "url" | "whatsapp"; url: string; phone: string; message: string; weight: number };

function emptyRotRow(kind: RotRow["kind"] = "url"): RotRow {
  return { kind, url: "", phone: "", message: "", weight: 1 };
}

function rowToFinalUrl(row: RotRow): { ok: true; url: string } | { ok: false; reason: string } {
  if (row.kind === "whatsapp") {
    const p = normalizePhone(row.phone);
    if (!p) return { ok: false, reason: "Número de WhatsApp inválido — use DDD + número" };
    return { ok: true, url: buildWaUrl(p, row.message) };
  }
  const t = row.url.trim();
  if (!t) return { ok: false, reason: "URL vazia" };
  return { ok: true, url: t };
}

function urlToRow(u: string, weight: number): RotRow {
  const wa = parseWaUrl(u);
  if (wa) return { kind: "whatsapp", url: "", phone: wa.phone, message: wa.message, weight };
  return { kind: "url", url: u, phone: "", message: "", weight };
}

function ClientesDashboard() {
  const navigate = useNavigate();
  const [sub, setSub] = useState<Sub | null>(null);
  const [links, setLinks] = useState<MyLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [mode, setMode] = useState<"normal" | "whatsapp" | "rotating">("normal");
  const [targetUrl, setTargetUrl] = useState("");
  const [waPhone, setWaPhone] = useState("");
  const [waMsg, setWaMsg] = useState("");
  const [label, setLabel] = useState("");
  const [rotMode, setRotMode] = useState<RotationMode>("round_robin");
  const [rotUrls, setRotUrls] = useState<RotRow[]>([
    emptyRotRow("whatsapp"), emptyRotRow("whatsapp"),
  ]);
  const [creating, setCreating] = useState(false);

  const [copied, setCopied] = useState<string | null>(null);
  const [metricsFor, setMetricsFor] = useState<MyLink | null>(null);
  const [editingFor, setEditingFor] = useState<MyLink | null>(null);

  const getSub = useServerFn(getMySubscription);
  const listLinks = useServerFn(listMySubscriberLinks);
  const createLink = useServerFn(createSubscriberLink);
  const createRotating = useServerFn(createSubscriberRotatingLink);

  const active = useMemo(() => {
    if (!sub) return false;
    const today = new Date().toISOString().slice(0, 10);
    return sub.status === "active" && !!sub.current_period_end && sub.current_period_end >= today;
  }, [sub]);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const s: any = await getSub({});
      setSub(s.subscription);
      const l: any = await listLinks({});
      setLinks(l.links ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Erro ao carregar");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const doCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active) return;
    setCreating(true);
    try {
      if (mode === "rotating") {
        const urls: { url: string; weight: number }[] = [];
        for (const row of rotUrls) {
          const res = rowToFinalUrl(row);
          if (!res.ok) {
            if (row.kind === "whatsapp" || row.url.trim().length > 0) {
              toast.error(res.reason);
              setCreating(false); return;
            }
            continue;
          }
          urls.push({ url: res.url, weight: Math.max(0, Math.floor(row.weight)) });
        }
        if (urls.length < 2) {
          toast.error("Adicione pelo menos 2 destinos para rotação.");
          setCreating(false); return;
        }
        const r: any = await createRotating({ data: { label: label || null, rotation_mode: rotMode, urls } });
        toast.success(`Link rotativo criado: ${r.url}`);
        setRotUrls([emptyRotRow("whatsapp"), emptyRotRow("whatsapp")]);
        setRotMode("round_robin");
      } else {
        let finalUrl = targetUrl;
        if (mode === "whatsapp") {
          const phone = normalizePhone(waPhone);
          if (!phone) {
            toast.error("Número de WhatsApp inválido — use DDD + número");
            setCreating(false); return;
          }
          finalUrl = buildWaUrl(phone, waMsg);
        }
        const r: any = await createLink({ data: { target_url: finalUrl, label: label || null } });
        toast.success(`Link criado: ${r.url}`);
      }
      setTargetUrl(""); setLabel(""); setWaPhone(""); setWaMsg("");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou");
    } finally { setCreating(false); }
  };

  const copyLink = async (slug: string) => {
    const url = `https://cliques.site/r/${slug}`;
    try { await navigator.clipboard.writeText(url); setCopied(slug); setTimeout(() => setCopied(null), 1500); } catch {}
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/clientes" });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-slate-800">
            <div className="h-8 w-8 rounded-md bg-[#0b3d91] text-white flex items-center justify-center">
              <Link2 className="h-4 w-4" />
            </div>
            <span>cliques</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 hidden sm:inline">{sub?.email ?? sub?.name ?? ""}</span>
            <button onClick={signOut} className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {err && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : (
          <>
            {/* Subscription status */}
            <section className={`rounded-2xl border p-6 ${active ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
              {active ? (
                <div>
                  <h2 className="font-semibold text-emerald-900">Assinatura ativa</h2>
                  <p className="text-sm text-emerald-800 mt-1">
                    Válida até <strong>{new Date(sub!.current_period_end!).toLocaleDateString("pt-BR")}</strong>.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 text-amber-900 font-semibold">
                    <AlertTriangle className="h-5 w-5" /> Assinatura pendente — R$ 19,90/mês
                  </div>
                  <p className="text-sm text-amber-900 mt-2">
                    Envie o pagamento via <strong>PIX</strong> para a chave abaixo e depois avise a Iara com o comprovante para liberar seu acesso.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <code className="bg-white border border-amber-200 text-slate-800 rounded px-3 py-1.5 text-sm">{PIX_KEY}</code>
                    <button
                      onClick={async () => { try { await navigator.clipboard.writeText(PIX_KEY); toast.success("Chave PIX copiada"); } catch {} }}
                      className="inline-flex items-center gap-1 text-xs bg-amber-900/10 hover:bg-amber-900/20 text-amber-900 px-2.5 py-1.5 rounded"
                    ><Copy className="h-3.5 w-3.5" /> Copiar</button>
                  </div>
                </div>
              )}
            </section>

            {/* Create form */}
            <section className="bg-white border border-slate-200 rounded-2xl p-6">
              <h2 className="font-semibold text-slate-900">Criar novo link</h2>
              {!active && (
                <p className="text-xs text-amber-800 mt-1">
                  Formulário desabilitado — regularize o pagamento para criar novos links.
                </p>
              )}

              <div className="mt-4 inline-flex flex-wrap rounded-lg border border-slate-200 p-1 bg-slate-50">
                <button
                  type="button"
                  disabled={!active}
                  onClick={() => setMode("normal")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md ${mode === "normal" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}
                >Link normal</button>
                <button
                  type="button"
                  disabled={!active}
                  onClick={() => setMode("whatsapp")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md ${mode === "whatsapp" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}
                >Link de WhatsApp</button>
                <button
                  type="button"
                  disabled={!active}
                  onClick={() => setMode("rotating")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1 ${mode === "rotating" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}
                ><Shuffle className="h-3.5 w-3.5" /> Link rotativo</button>
              </div>

              <form onSubmit={doCreate} className="mt-4 space-y-3">
                {mode === "normal" && (
                  <div className="grid gap-3 sm:grid-cols-[1fr,220px,auto]">
                    <input
                      disabled={!active}
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      placeholder="https://sua-url-de-destino.com"
                      required
                      type="url"
                      className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100"
                    />
                    <input
                      disabled={!active}
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="Rótulo (opcional)"
                      className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100"
                    />
                    <button
                      type="submit" disabled={!active || creating}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0b3d91] hover:bg-[#0a3582] text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                    >
                      {creating && <Loader2 className="h-4 w-4 animate-spin" />} Criar link
                    </button>
                  </div>
                )}
                {mode === "whatsapp" && (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        disabled={!active}
                        value={waPhone}
                        onChange={(e) => setWaPhone(e.target.value)}
                        placeholder="Ex: 11 91234-5678"
                        required
                        type="tel"
                        className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100"
                      />
                      <input
                        disabled={!active}
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder="Rótulo (opcional)"
                        className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100"
                      />
                    </div>
                    <textarea
                      disabled={!active}
                      value={waMsg}
                      onChange={(e) => setWaMsg(e.target.value)}
                      placeholder="Mensagem pré-preenchida quando abrirem o link"
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100"
                    />
                    <button
                      type="submit" disabled={!active || creating}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0b3d91] hover:bg-[#0a3582] text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                    >
                      {creating && <Loader2 className="h-4 w-4 animate-spin" />} Criar link de WhatsApp
                    </button>
                  </div>
                )}
                {mode === "rotating" && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">
                      O mesmo slug curto redireciona pra URLs diferentes segundo a regra escolhida — ótimo pra dividir tráfego, testes A/B ou revezar contatos.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium text-slate-700">Modo de rotação</label>
                        <select
                          disabled={!active}
                          value={rotMode}
                          onChange={(e) => setRotMode(e.target.value as RotationMode)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100"
                        >
                          {(Object.keys(ROTATION_LABELS) as RotationMode[]).map((m) => (
                            <option key={m} value={m}>{ROTATION_LABELS[m]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-700">Rótulo (opcional)</label>
                        <input
                          disabled={!active}
                          value={label}
                          onChange={(e) => setLabel(e.target.value)}
                          placeholder="Ex: Campanha janeiro"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100"
                        />
                      </div>
                    </div>
                    <RotationRowsEditor
                      rows={rotUrls}
                      setRows={setRotUrls}
                      disabled={!active}
                      showWeight={rotMode === "weighted"}
                    />
                    <button
                      type="submit" disabled={!active || creating}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0b3d91] hover:bg-[#0a3582] text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                    >
                      {creating && <Loader2 className="h-4 w-4 animate-spin" />} Criar link rotativo
                    </button>
                  </div>
                )}
              </form>
            </section>

            {/* Links list */}
            <section className="bg-white border border-slate-200 rounded-2xl">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Meus links</h2>
                <span className="text-xs text-slate-500">{links.length} {links.length === 1 ? "link" : "links"}</span>
              </div>
              {links.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">Nenhum link ainda.</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {links.map((l) => {
                    const short = `cliques.site/r/${l.slug}`;
                    return (
                      <li key={l.id} className="px-6 py-4 flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
                            {short}
                            {l.is_rotating && (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-[#0b3d91] bg-[#0b3d91]/10 rounded px-1.5 py-0.5">
                                <Shuffle className="h-3 w-3" /> {ROTATION_LABELS[l.rotation_mode] ?? l.rotation_mode}
                              </span>
                            )}
                          </div>
                          {l.is_rotating ? (
                            <div className="text-xs text-slate-500 mt-0.5">
                              {l.label ? <span className="mr-2 text-slate-700">[{l.label}]</span> : null}
                              → {l.short_link_urls?.length ?? 0} URLs em rotação
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500 truncate max-w-md">
                              {l.label ? <span className="mr-2 text-slate-700">[{l.label}]</span> : null}
                              → {l.target_url ?? "—"}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => copyLink(l.slug)}
                          className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded px-2 py-1"
                        >
                          {copied === l.slug ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                          Copiar
                        </button>
                        <a
                          href={`https://${short}`} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded px-2 py-1"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Abrir
                        </a>
                        <button
                          onClick={() => setEditingFor(l)}
                          className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded px-2 py-1"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </button>
                        <button
                          onClick={() => setMetricsFor(l)}
                          className="inline-flex items-center gap-1 text-xs text-white bg-[#0b3d91] hover:bg-[#0a3582] rounded px-2.5 py-1"
                        >
                          <BarChart3 className="h-3.5 w-3.5" /> Ver métricas
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <p className="text-xs text-slate-500 text-center">
              Apenas cliques reais são contabilizados — tráfego de robôs e crawlers é filtrado automaticamente.
              {" "}<Link to="/portal" className="underline">Sobre nós</Link>
            </p>
          </>
        )}
      </main>

      {metricsFor && (
        <MetricsModal link={metricsFor} onClose={() => setMetricsFor(null)} />
      )}
      {editingFor && (
        <EditTargetModal
          link={editingFor}
          onClose={() => setEditingFor(null)}
          onSaved={async () => { setEditingFor(null); await load(); }}
        />
      )}
    </div>
  );
}

function EditTargetModal({
  link, onClose, onSaved,
}: { link: MyLink; onClose: () => void; onSaved: () => void }) {
  const wa = parseWaUrl(link.target_url);
  const initialTab: "single" | "rotating" = link.is_rotating ? "rotating" : "single";
  const [tab, setTab] = useState<"single" | "rotating">(initialTab);

  // single mode state
  const [isWa, setIsWa] = useState<boolean>(!!wa && !link.is_rotating);
  const [phone, setPhone] = useState(wa?.phone ?? "");
  const [msg, setMsg] = useState(wa?.message ?? "");
  const [url, setUrl] = useState(link.is_rotating ? "" : (link.target_url ?? ""));

  // rotating mode state
  const initialUrls: RotRow[] = link.is_rotating && link.short_link_urls?.length
    ? [...link.short_link_urls]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((u) => urlToRow(u.url, u.weight ?? 1))
    : [urlToRow(link.target_url ?? "", 1), emptyRotRow("whatsapp")];
  const [rotUrls, setRotUrls] = useState<RotRow[]>(initialUrls);
  const [rotMode, setRotMode] = useState<RotationMode>(link.rotation_mode ?? "round_robin");

  const [saving, setSaving] = useState(false);
  const updateSingle = useServerFn(updateSubscriberLinkTarget);
  const updateRotation = useServerFn(updateSubscriberLinkRotation);
  const convertSingle = useServerFn(convertSubscriberLinkToSingle);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (tab === "single") {
        let finalUrl = url;
        if (isWa) {
          const normalized = normalizePhone(phone);
          if (!normalized) { toast.error("Número de WhatsApp inválido"); setSaving(false); return; }
          finalUrl = buildWaUrl(normalized, msg);
        }
        if (link.is_rotating) {
          await convertSingle({ data: { linkId: link.id, target_url: finalUrl } });
        } else {
          await updateSingle({ data: { linkId: link.id, target_url: finalUrl } });
        }
        toast.success("Destino atualizado");
      } else {
        const urls = rotUrls
          .map((u) => ({ url: u.url.trim(), weight: Math.max(0, Math.floor(u.weight)) }))
          .filter((u) => u.url.length > 0);
        if (urls.length < 2) { toast.error("Adicione pelo menos 2 URLs"); setSaving(false); return; }
        await updateRotation({ data: { linkId: link.id, rotation_mode: rotMode, urls } });
        toast.success("Rotação atualizada");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="font-semibold text-slate-900">Editar — cliques.site/r/{link.slug}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-md text-slate-500"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <div className="inline-flex rounded-lg border border-slate-200 p-1 bg-slate-50">
            <button
              type="button"
              onClick={() => setTab("single")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${tab === "single" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}
            >Destino único</button>
            <button
              type="button"
              onClick={() => setTab("rotating")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1 ${tab === "rotating" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}
            ><Shuffle className="h-3.5 w-3.5" /> Rotativo</button>
          </div>

          {tab === "single" ? (
            <>
              <div className="inline-flex rounded-lg border border-slate-200 p-1 bg-slate-50">
                <button type="button" onClick={() => setIsWa(false)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md ${!isWa ? "bg-white shadow text-slate-900" : "text-slate-500"}`}
                >URL livre</button>
                <button type="button" onClick={() => setIsWa(true)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md ${isWa ? "bg-white shadow text-slate-900" : "text-slate-500"}`}
                >WhatsApp</button>
              </div>
              {isWa ? (
                <>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Número de WhatsApp (com DDD)</label>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ex: 11 91234-5678" type="tel" required
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"/>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Mensagem</label>
                    <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"/>
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-xs font-medium text-slate-700">URL de destino</label>
                  <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"/>
                </div>
              )}
              {link.is_rotating && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  Salvar aqui converte o link rotativo em destino único — as URLs adicionais serão removidas.
                </p>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-slate-700">Modo de rotação</label>
                <select value={rotMode} onChange={(e) => setRotMode(e.target.value as RotationMode)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
                  {(Object.keys(ROTATION_LABELS) as RotationMode[]).map((m) => (
                    <option key={m} value={m}>{ROTATION_LABELS[m]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                {rotUrls.map((row, idx) => (
                  <div key={idx} className="grid gap-2 grid-cols-[1fr,90px,auto] items-center">
                    <input
                      value={row.url}
                      onChange={(e) => setRotUrls((prev) => prev.map((r, i) => i === idx ? { ...r, url: e.target.value } : r))}
                      placeholder={`URL ${idx + 1}`}
                      type="url"
                      className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    />
                    <input
                      disabled={rotMode !== "weighted"}
                      value={row.weight}
                      onChange={(e) => setRotUrls((prev) => prev.map((r, i) => i === idx ? { ...r, weight: Number(e.target.value) || 0 } : r))}
                      type="number" min={0} max={1000}
                      title="Peso (só ponderado)"
                      className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100"
                    />
                    <button type="button" disabled={rotUrls.length <= 2}
                      onClick={() => setRotUrls((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 disabled:opacity-40"
                    ><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
                <button type="button" disabled={rotUrls.length >= 20}
                  onClick={() => setRotUrls((prev) => [...prev, { url: "", weight: 1 }])}
                  className="inline-flex items-center gap-1 text-xs text-[#0b3d91] hover:text-[#0a3582] disabled:opacity-40"
                ><Plus className="h-3.5 w-3.5" /> Adicionar URL</button>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancelar</button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0b3d91] hover:bg-[#0a3582] text-white px-5 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MetricsModal({ link, onClose }: { link: MyLink; onClose: () => void }) {
  const [data, setData] = useState<{
    total: number;
    daily: { day: string; count: number }[];
    topCountries: { name: string; count: number }[];
    topCities: { name: string; count: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const getMetrics = useServerFn(getMyLinkMetrics);

  useEffect(() => {
    (async () => {
      try {
        const r: any = await getMetrics({ data: { shortLinkId: link.id } });
        setData(r);
      } catch (e: any) {
        setErr(e?.message ?? "Erro");
      } finally { setLoading(false); }
    })();
  }, [link.id]);

  const max = data ? Math.max(1, ...data.daily.map((d) => d.count)) : 1;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h3 className="font-semibold text-slate-900">Métricas — cliques.site/r/{link.slug}</h3>
            <p className="text-xs text-slate-500">Apenas cliques reais — bots filtrados automaticamente</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-md text-slate-500">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
          ) : err ? (
            <div className="text-sm text-red-700">{err}</div>
          ) : data ? (
            <>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-5">
                <div className="text-xs uppercase tracking-wider text-slate-500">Cliques reais (últimos 30 dias)</div>
                <div className="mt-1 text-4xl font-bold text-slate-900">{data.total}</div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-3">Cliques por dia</h4>
                <div className="flex items-end gap-1 h-32 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  {data.daily.map((d) => (
                    <div key={d.day} title={`${d.day}: ${d.count}`} className="flex-1 flex flex-col justify-end">
                      <div
                        className="w-full bg-[#0b3d91] rounded-t"
                        style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 2 : 0 }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                  <span>{data.daily[0]?.day}</span>
                  <span>{data.daily[data.daily.length - 1]?.day}</span>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <StatList title="Top países" rows={data.topCountries} />
                <StatList title="Top cidades" rows={data.topCities} />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatList({ title, rows }: { title: string; rows: { name: string; count: number }[] }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <h4 className="text-sm font-semibold text-slate-800 mb-3">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400">Sem dados ainda.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {rows.map((r) => (
            <li key={r.name} className="flex justify-between text-slate-700">
              <span className="truncate">{r.name}</span>
              <span className="font-semibold text-slate-900">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
