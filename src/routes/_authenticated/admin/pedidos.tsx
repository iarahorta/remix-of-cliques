import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Loader2, Download, ExternalLink, Search, Calendar, FileSpreadsheet, Film,
  CheckCircle2, Send, Undo2, DollarSign, Edit3, User, Eye, Trash2, Copy,
  Image as ImageIcon, MessageCircle, Link as LinkIcon, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { CampaignDetailModal } from "@/components/campaign-detail-modal";

export const Route = createFileRoute("/_authenticated/admin/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos — Admin HS Assessoria" }] }),
  component: PedidosPage,
});

type Campaign = {
  id: string;
  name: string | null;
  link: string | null;
  message: string | null;
  send_count: number | null;
  unit_price_cents: number | null;
  debit_cents: number | null;
  refund_cents: number | null;
  hygiene_valid: number | null;
  hygiene_invalid: number | null;
  hygiene_duplicates: number | null;
  status: string;
  payment_status: string;
  paid_at: string | null;
  paid_method: string | null;
  channel: string | null;
  client_display_name: string | null;
  scheduled_at: string | null;
  created_at: string;
  user_id: string;
  niche_id: string | null;
  template_id: string | null;
  profile_photo_url: string | null;
  template_data: Record<string, any> | null;
};
type Profile = { id: string; email: string | null; full_name: string | null; phone: string | null };
type Niche = { id: string; name: string | null };
type Template = { id: string; name: string | null };
type FileRow = { id: string; campaign_id: string; kind: string; filename: string; storage_path: string; mime: string | null };

const STATUS_TABS = [
  { key: "all", label: "Todos" },
  { key: "draft", label: "Pendentes" },
  { key: "processing", label: "Enviados" },
  { key: "completed", label: "Concluídos" },
] as const;
const PAY_TABS = [
  { key: "all", label: "Todos" },
  { key: "paid", label: "Pago" },
  { key: "unpaid", label: "Não Pago" },
] as const;

const todayISO = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); };
const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const copy = (t: string, m = "Copiado") => { navigator.clipboard.writeText(t); toast.success(m); };

function PedidosPage() {
  const { isAdmin, hasPermission, user } = useAuth();
  const canSeeAll = isAdmin || hasPermission("view_all_campaigns");

  const [rows, setRows] = useState<Campaign[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [niches, setNiches] = useState<Record<string, Niche>>({});
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [files, setFiles] = useState<Record<string, FileRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<string>("all");
  const [payTab, setPayTab] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [openTemplate, setOpenTemplate] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    const { data: camps, error: e1 } = await supabase
      .from("campaigns")
      .select("id, name, link, message, send_count, unit_price_cents, debit_cents, refund_cents, hygiene_valid, hygiene_invalid, hygiene_duplicates, status, payment_status, paid_at, paid_method, channel, client_display_name, scheduled_at, created_at, user_id, niche_id, template_id, profile_photo_url, template_data")
      .order("created_at", { ascending: false })
      .limit(500);
    if (e1) { setError(e1.message); setLoading(false); return; }
    const list = (camps ?? []) as Campaign[];
    setRows(list);

    if (list.length) {
      const userIds = Array.from(new Set(list.map((c) => c.user_id).filter(Boolean)));
      const nicheIds = Array.from(new Set(list.map((c) => c.niche_id).filter(Boolean) as string[]));
      const tplIds = Array.from(new Set(list.map((c) => c.template_id).filter(Boolean) as string[]));
      const ids = list.map((c) => c.id);

      const [pr, nr, tr, fr] = await Promise.all([
        userIds.length ? supabase.from("profiles").select("id, email, full_name, phone").in("id", userIds) : Promise.resolve({ data: [] as Profile[] } as any),
        nicheIds.length ? supabase.from("niches").select("id, name").in("id", nicheIds) : Promise.resolve({ data: [] as Niche[] } as any),
        tplIds.length ? supabase.from("message_templates").select("id, name").in("id", tplIds) : Promise.resolve({ data: [] as Template[] } as any),
        supabase.from("campaign_files").select("id, campaign_id, kind, filename, storage_path, mime").in("campaign_id", ids),
      ]);
      const pm: Record<string, Profile> = {}; ((pr.data as Profile[]) ?? []).forEach((p) => { pm[p.id] = p; });
      const nm: Record<string, Niche> = {}; ((nr.data as Niche[]) ?? []).forEach((n) => { nm[n.id] = n; });
      const tm: Record<string, Template> = {}; ((tr.data as Template[]) ?? []).forEach((t) => { tm[t.id] = t; });
      const fm: Record<string, FileRow[]> = {}; ((fr.data as FileRow[]) ?? []).forEach((f) => { (fm[f.campaign_id] = fm[f.campaign_id] ?? []).push(f); });
      setProfiles(pm); setNiches(nm); setTemplates(tm); setFiles(fm);
    } else {
      setProfiles({}); setNiches({}); setTemplates({}); setFiles({});
    }
    setLoading(false);
  };

  useEffect(() => { if (canSeeAll) load(); }, [canSeeAll]);

  const counts = useMemo(() => {
    const c = { all: rows.length, draft: 0, processing: 0, completed: 0 };
    rows.forEach((r) => {
      if (r.status === "draft" || r.status === "scheduled") c.draft += 1;
      else if (r.status === "processing") c.processing += 1;
      else if (r.status === "completed") c.completed += 1;
    });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate + "T00:00:00").getTime() : null;
    const to = toDate ? new Date(toDate + "T23:59:59").getTime() : null;
    return rows.filter((r) => {
      if (statusTab === "draft" && !["draft", "scheduled"].includes(r.status)) return false;
      if (statusTab === "processing" && r.status !== "processing") return false;
      if (statusTab === "completed" && r.status !== "completed") return false;
      if (payTab !== "all" && r.payment_status !== payTab) return false;
      if (from || to) {
        const t = new Date(r.created_at).getTime();
        if (from && t < from) return false;
        if (to && t > to) return false;
      }
      if (q) {
        const p = profiles[r.user_id];
        const hay = `${r.name ?? ""} ${r.client_display_name ?? ""} ${p?.full_name ?? ""} ${p?.email ?? ""} ${p?.phone ?? ""} ${r.link ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, profiles, search, statusTab, payTab, fromDate, toDate]);

  const setQuickRange = (k: "today" | "yesterday" | "week") => {
    if (k === "today") { setFromDate(todayISO()); setToDate(todayISO()); }
    else if (k === "yesterday") { setFromDate(todayISO(-1)); setToDate(todayISO(-1)); }
    else {
      const day = new Date().getDay();
      const monOff = day === 0 ? -6 : 1 - day;
      setFromDate(todayISO(monOff)); setToDate(todayISO());
    }
  };

  const update = async (id: string, patch: Record<string, any>, label: string) => {
    setBusy(id);
    const { error } = await supabase.from("campaigns").update(patch as any).eq("id", id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(label);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const togglePaid = (r: Campaign) => {
    if (r.payment_status === "paid")
      update(r.id, { payment_status: "unpaid", paid_at: null, paid_method: null, paid_by: null }, "Marcado como não pago");
    else
      update(r.id, { payment_status: "paid", paid_at: new Date().toISOString(), paid_method: "manual", paid_by: user?.id ?? null }, "Pagamento confirmado");
  };
  const markStatus = (r: Campaign, status: string, label: string) => update(r.id, { status }, label);

  const downloadFile = async (f: FileRow) => {
    const { data } = await supabase.storage.from("campaign-files").createSignedUrl(f.storage_path, 60);
    if (!data?.signedUrl) return toast.error("Falha ao gerar link");
    const a = document.createElement("a"); a.href = data.signedUrl; a.download = f.filename;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const openInTab = async (f: FileRow) => {
    const { data } = await supabase.storage.from("campaign-files").createSignedUrl(f.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (!canSeeAll) {
    return (
      <PageShell title="Pedidos" subtitle="Acesso restrito.">
        <div className="card-premium p-6 text-sm text-muted-foreground">Sem permissão para ver pedidos.</div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Pedidos (Admin)" subtitle="Todos os pedidos de disparo dos clientes">
      <div className="card-premium p-4 md:p-6 mb-6 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex items-center gap-2 flex-1 rounded-lg bg-input border border-border px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, e-mail, telefone, link..."
              className="flex-1 bg-transparent text-sm focus:outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none" />
            <span className="text-xs text-muted-foreground">até</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none" />
          </div>
          <button onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs hover:bg-secondary">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <QuickBtn onClick={() => setQuickRange("today")}>Hoje</QuickBtn>
          <QuickBtn onClick={() => setQuickRange("yesterday")}>Ontem</QuickBtn>
          <QuickBtn onClick={() => setQuickRange("week")}>Essa semana</QuickBtn>
          <QuickBtn onClick={() => { setFromDate(""); setToDate(""); }}>Limpar datas</QuickBtn>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {STATUS_TABS.map((t) => (
            <TabBtn key={t.key} active={statusTab === t.key} onClick={() => setStatusTab(t.key)}>
              {t.label} <span className="ml-1.5 text-xs opacity-70">{t.key === "all" ? counts.all : (counts as any)[t.key]}</span>
            </TabBtn>
          ))}
          <div className="mx-2 h-5 w-px bg-border" />
          <span className="text-xs text-muted-foreground">Pagamento:</span>
          {PAY_TABS.map((t) => (
            <TabBtn key={t.key} active={payTab === t.key} onClick={() => setPayTab(t.key)} variant="ghost">{t.label}</TabBtn>
          ))}
        </div>
      </div>

      <div className="card-premium p-4 md:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center">
            <FileSpreadsheet className="h-4 w-4 text-[oklch(0.84_0.14_80)]" />
          </div>
          <p className="font-semibold">Total: {filtered.length} pedidos</p>
        </div>

        {error && <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">Erro ao carregar: {error}</div>}

        {loading ? (
          <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">Nenhum pedido encontrado.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => {
              const cf = files[r.id] ?? [];
              const photo = cf.find((f) => f.kind === "photo" || f.kind === "profile");
              const leadsOriginal = cf.find((f) => f.filename.startsWith("original-"));
              const leadsValid = cf.find((f) => f.filename === "leads-validos.csv");
              const media = cf.find((f) => f.kind === "media");
              const cost = (r.debit_cents ?? 0) - (r.refund_cents ?? 0);
              const unit = (r.unit_price_cents ?? 0) / 100;
              const isPaid = r.payment_status === "paid";
              const prof = profiles[r.user_id];
              const niche = r.niche_id ? niches[r.niche_id] : null;
              const tpl = r.template_id ? templates[r.template_id] : null;
              const clientName = r.client_display_name ?? prof?.full_name ?? prof?.email ?? "—";
              return (
                <div key={r.id} className="rounded-xl border border-border bg-secondary/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-secondary overflow-hidden shrink-0 flex items-center justify-center">
                      {r.profile_photo_url
                        ? <img src={r.profile_photo_url} alt="" className="h-full w-full object-cover" />
                        : <User className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold">{clientName}</span>
                        {niche?.name && <Badge tone="green">{niche.name}</Badge>}
                        {tpl?.name && <Badge tone="blue">Template: {tpl.name}</Badge>}
                        <Badge tone="muted">{(r.send_count ?? 0).toLocaleString("pt-BR")} msgs</Badge>
                        {unit > 0 && <Badge tone="muted">R${unit.toFixed(2).replace(".", ",")} / msg</Badge>}
                        <Badge tone="green">{brl(cost)}</Badge>
                        <StatusBadge status={r.status} />
                        <PaymentBadge paid={isPaid} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
                        <CopyRow label="E-mail" value={prof?.email ?? "—"} />
                        <CopyRow label="Telefone" value={prof?.phone ?? "—"} />
                        <CopyRow label="Nome do disparo" value={r.client_display_name ?? "—"} />
                        <CopyRow label="ID do pedido" value={r.id} mono />
                        {r.link && <CopyRow label="Link" value={r.link} />}
                        <CopyRow label="Canal" value={r.channel ?? "manual"} />
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                        <span>🕒 Criado: {new Date(r.created_at).toLocaleString("pt-BR")}</span>
                        {r.scheduled_at && <span>📅 Agendado: {new Date(r.scheduled_at).toLocaleString("pt-BR")}</span>}
                        {isPaid && r.paid_at && <span>💰 Pago {r.paid_method ? `(${r.paid_method})` : ""}: {new Date(r.paid_at).toLocaleString("pt-BR")}</span>}
                        <span>✅ Válidos: {r.hygiene_valid ?? 0}</span>
                        <span>⚠️ Inválidos: {r.hygiene_invalid ?? 0}</span>
                        <span>♻️ Duplicados: {r.hygiene_duplicates ?? 0}</span>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2">
                        {media && <Chip icon={<Film className="h-3 w-3" />}>mídia</Chip>}
                        {photo && <Chip icon={<ImageIcon className="h-3 w-3" />}>foto</Chip>}
                        {leadsOriginal && <Chip icon={<FileSpreadsheet className="h-3 w-3" />}>lista original</Chip>}
                        {leadsValid && <Chip icon={<CheckCircle2 className="h-3 w-3" />}>lista higienizada</Chip>}
                      </div>

                      {r.message && (
                        <button onClick={() => setOpenTemplate(openTemplate === r.id ? null : r.id)}
                          className="mt-2 text-xs text-[oklch(0.84_0.14_80)] hover:underline inline-flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" /> {openTemplate === r.id ? "Esconder" : "Ver"} mensagem
                        </button>
                      )}
                      {openTemplate === r.id && r.message && (
                        <pre className="mt-2 whitespace-pre-wrap text-xs bg-input border border-border rounded-lg p-3 text-foreground/90">{r.message}</pre>
                      )}

                      <div className="flex flex-wrap gap-2 mt-3">
                        <ActBtn onClick={() => setDetailId(r.id)} icon={<Eye className="h-3.5 w-3.5" />} variant="info">Ver pedido completo</ActBtn>
                        {photo && <ActBtn onClick={() => downloadFile(photo)} icon={<Download className="h-3.5 w-3.5" />}>Foto</ActBtn>}
                        {leadsOriginal && <ActBtn onClick={() => downloadFile(leadsOriginal)} icon={<Download className="h-3.5 w-3.5" />}>Lista original</ActBtn>}
                        {leadsValid && <ActBtn onClick={() => downloadFile(leadsValid)} icon={<Download className="h-3.5 w-3.5" />}>Válidos</ActBtn>}
                        {media && <ActBtn onClick={() => openInTab(media)} icon={<Film className="h-3.5 w-3.5" />}>Ver mídia</ActBtn>}
                        <ActBtn onClick={() => setDetailId(r.id)} icon={<Edit3 className="h-3.5 w-3.5" />}>Editar</ActBtn>
                        <ActBtn onClick={() => togglePaid(r)} disabled={busy === r.id}
                          icon={<DollarSign className="h-3.5 w-3.5" />} variant={isPaid ? "danger" : "success"}>
                          {isPaid ? "Marcar Não Pago" : "Marcar Pago"}
                        </ActBtn>
                        <ActBtn onClick={async () => {
                          if (!confirm(`Excluir o pedido de "${clientName}"?`)) return;
                          setBusy(r.id);
                          const { error } = await supabase.from("campaigns").delete().eq("id", r.id);
                          setBusy(null);
                          if (error) { toast.error(error.message); return; }
                          setRows((prev) => prev.filter((x) => x.id !== r.id));
                          toast.success("Pedido excluído");
                        }} disabled={busy === r.id} icon={<Trash2 className="h-3.5 w-3.5" />} variant="danger">Excluir</ActBtn>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2 justify-end">
                        {(r.status === "draft" || r.status === "scheduled") && (
                          <ActBtn onClick={() => markStatus(r, "processing", "Marcado como enviado")} icon={<Send className="h-3.5 w-3.5" />} variant="info">
                            Marcar como Enviado
                          </ActBtn>
                        )}
                        {r.status === "processing" && (
                          <>
                            <ActBtn onClick={() => markStatus(r, "completed", "Concluído")} icon={<CheckCircle2 className="h-3.5 w-3.5" />} variant="success">Marcar Concluído</ActBtn>
                            <ActBtn onClick={() => markStatus(r, "draft", "Voltou para pendente")} icon={<Undo2 className="h-3.5 w-3.5" />} variant="muted">Voltar p/ Pendente</ActBtn>
                          </>
                        )}
                        {r.status === "completed" && (
                          <ActBtn onClick={() => markStatus(r, "processing", "Voltou para enviado")} icon={<Undo2 className="h-3.5 w-3.5" />} variant="muted">Reabrir</ActBtn>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <CampaignDetailModal id={detailId} open={!!detailId} onOpenChange={(v) => !v && setDetailId(null)} />
    </PageShell>
  );
}

function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className={`flex-1 truncate ${mono ? "font-mono text-[11px]" : ""}`}>{value}</span>
      <button onClick={() => copy(value)} className="p-1 rounded hover:bg-secondary shrink-0" title="Copiar">
        <Copy className="h-3 w-3" />
      </button>
    </div>
  );
}
function Chip({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2 py-0.5 text-[10px] text-muted-foreground">{icon}{children}</span>;
}
function QuickBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium hover:bg-secondary transition">{children}</button>;
}
function TabBtn({ children, active, onClick, variant }: { children: React.ReactNode; active: boolean; onClick: () => void; variant?: "ghost" }) {
  const base = "rounded-lg px-3 py-1.5 text-sm font-medium transition";
  const cls = active
    ? "bg-[oklch(0.4_0.12_75)] text-[oklch(0.95_0.06_80)] border border-[oklch(0.58_0.12_75_/_0.45)]"
    : variant === "ghost" ? "text-muted-foreground hover:text-foreground"
    : "border border-border bg-secondary/40 hover:bg-secondary";
  return <button onClick={onClick} className={`${base} ${cls}`}>{children}</button>;
}
function Badge({ children, tone }: { children: React.ReactNode; tone: "green" | "muted" | "red" | "yellow" | "blue" }) {
  const map: Record<string, string> = {
    green: "bg-[oklch(0.4_0.12_75_/_0.25)] text-[oklch(0.86_0.14_80)] border-[oklch(0.58_0.12_75_/_0.4)]",
    muted: "bg-secondary text-muted-foreground border-border",
    red: "bg-destructive/20 text-destructive border-destructive/40",
    yellow: "bg-[oklch(0.4_0.15_75_/_0.25)] text-[oklch(0.85_0.16_75)] border-[oklch(0.55_0.14_75_/_0.4)]",
    blue: "bg-[oklch(0.3_0.1_240_/_0.3)] text-[oklch(0.8_0.12_240)] border-[oklch(0.5_0.1_240_/_0.4)]",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${map[tone]}`}>{children}</span>;
}
function StatusBadge({ status }: { status: string }) {
  if (status === "completed") return <Badge tone="green">Concluído</Badge>;
  if (status === "processing") return <Badge tone="blue">Enviado</Badge>;
  if (status === "scheduled" || status === "draft") return <Badge tone="yellow">Pendente</Badge>;
  if (status === "failed" || status === "cancelled") return <Badge tone="red">{status}</Badge>;
  return <Badge tone="muted">{status}</Badge>;
}
function PaymentBadge({ paid }: { paid: boolean }) {
  return paid ? <Badge tone="green">Pago</Badge> : <Badge tone="red">Não Pago</Badge>;
}
function ActBtn({ children, onClick, icon, variant, disabled }: {
  children: React.ReactNode; onClick: () => void; icon?: React.ReactNode;
  variant?: "success" | "danger" | "info" | "muted"; disabled?: boolean;
}) {
  const cls =
    variant === "success" ? "border-[oklch(0.58_0.12_75_/_0.5)] text-[oklch(0.86_0.14_80)] hover:bg-[oklch(0.4_0.12_75_/_0.15)]"
    : variant === "danger" ? "border-destructive/40 text-destructive hover:bg-destructive/10"
    : variant === "info" ? "border-[oklch(0.5_0.12_240_/_0.5)] text-[oklch(0.8_0.12_240)] hover:bg-[oklch(0.35_0.1_240_/_0.2)]"
    : variant === "muted" ? "border-border text-muted-foreground hover:bg-secondary"
    : "border-border bg-input hover:bg-secondary";
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${cls}`}>
      {icon}{children}
    </button>
  );
}
