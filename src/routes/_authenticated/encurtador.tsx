import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Link2, Plus, Trash2, Copy, Check, ExternalLink, Loader2, Search,
  Globe, Wand2, Upload, RefreshCw, Pencil, X, BarChart3, Download,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { PageShell } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";
import {
  bulkGenerateSlugs, bulkImportUrls, updateShortLinkTarget,
  bulkReplaceTargets, getShortLinkDomain, setShortLinkDomain,
  getRotationUrls, setRotationUrls,
} from "@/lib/short-links.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/encurtador")({
  head: () => ({ meta: [{ title: "Encurtador — zpclik" }] }),
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const ok = (roles ?? []).some(
      (r: any) => r.role === "admin" || r.role === "super_admin",
    );
    if (!ok) throw redirect({ to: "/clientes/dashboard" });
  },
  component: Encurtador,
});

interface ShortLink {
  id: string;
  slug: string;
  is_rotating: boolean;
  target_url: string | null;
  click_count: number;
  status: string;
  label: string | null;
  
  created_at: string;
  last_clicked_at: string | null;
}

type Tab = "all" | "available" | "occupied" | "analysis";

function Encurtador() {
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [domain, setDomain] = useState<string | null>(null);

  const [modal, setModal] = useState<null | "gen" | "import" | "edit" | "bulk" | "domain" | "new" | "metrics">(null);
  const [editing, setEditing] = useState<ShortLink | null>(null);
  const [metricsLink, setMetricsLink] = useState<ShortLink | null>(null);

  const getDomain = useServerFn(getShortLinkDomain);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("short_links")
      .select("id,slug,is_rotating,target_url,click_count,status,label,created_at,last_clicked_at")
      .order("created_at", { ascending: false });
    setLinks((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    getDomain({}).then((r: any) => setDomain(r.domain));
  }, []);

  const counts = useMemo(() => ({
    all: links.length,
    available: links.filter(l => l.status === "available").length,
    occupied: links.filter(l => l.status === "occupied").length,
    analysis: links.filter(l => l.status === "analysis").length,
  }), [links]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return links
      .filter(l => tab === "all" ? true : l.status === tab)
      .filter(l => !q || l.slug.includes(q) || (l.target_url ?? "").toLowerCase().includes(q) || (l.label ?? "").toLowerCase().includes(q));
  }, [links, tab, search]);

  const toggleOne = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const baseHost = domain ?? (typeof window !== "undefined" ? window.location.host : "");

  return (
    <PageShell title="Encurtador de Link" subtitle="Encurte, edite o destino e rotacione seus links.">
      <div className="flex flex-wrap gap-2 mb-5">
        <Btn icon={Globe} label={`Domínio (${baseHost || "—"})`} onClick={() => setModal("domain")} />
        <Btn icon={RefreshCw} label="Trocar Todos" onClick={() => {
          if (selected.size === 0) return toast.error("Selecione links primeiro");
          setModal("bulk");
        }} />
        <Btn icon={Wand2} label="Gerar em Massa" onClick={() => setModal("gen")} primary />
        <Btn icon={Upload} label="Importar em Massa" onClick={() => setModal("import")} />
        <Btn icon={Plus} label="Novo" onClick={() => setModal("new")} primary />
      </div>

      <section className="card-premium p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="font-display text-xl">Seus Links ({counts.all})</h3>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar por slug, URL ou apelido…"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <div className="flex gap-1 mb-4 border-b border-border overflow-x-auto">
          {([
            ["all", "Todos"],
            ["available", "Disponíveis"],
            ["occupied", "Ocupados"],
            ["analysis", "Análise"],
          ] as [Tab, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === k ? "border-[oklch(0.78_0.14_75)] text-[oklch(0.88_0.14_80)]" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {label} ({counts[k]})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-[oklch(0.75_0.13_75)]" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhum link nesta aba. Use <span className="text-[#0b3d91] font-semibold">Gerar em Massa</span> para criar slugs vazios.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(l => (
              <LinkRow key={l.id} link={l} host={baseHost} selected={selected.has(l.id)}
                onToggle={() => toggleOne(l.id)}
                onEdit={() => { setEditing(l); setModal("edit"); }}
                onMetrics={() => { setMetricsLink(l); setModal("metrics"); }}
                onChange={load} />
            ))}
          </div>
        )}
      </section>

      {modal === "gen" && <GenerateModal onClose={() => setModal(null)} onDone={load} />}
      {modal === "import" && <ImportModal onClose={() => setModal(null)} onDone={load} />}
      {modal === "new" && <NewLinkModal onClose={() => setModal(null)} onDone={load} />}
      {modal === "edit" && editing && (
        <EditModal link={editing} onClose={() => { setModal(null); setEditing(null); }} onDone={load} />
      )}
      {modal === "bulk" && (
        <BulkReplaceModal ids={[...selected]} onClose={() => setModal(null)} onDone={() => { setSelected(new Set()); load(); }} />
      )}
      {modal === "domain" && (
        <DomainModal current={domain} onClose={() => setModal(null)} onSaved={(d) => setDomain(d)} />
      )}
      {modal === "metrics" && metricsLink && (
        <MetricsModal link={metricsLink} onClose={() => { setModal(null); setMetricsLink(null); }} />
      )}
    </PageShell>
  );
}

function Btn({ icon: Icon, label, onClick, primary }: { icon: any; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
        primary
          ? "bg-gold-metal hover:scale-[1.02]"
          : "border border-border bg-secondary/40 hover:bg-secondary text-foreground"
      }`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function statusBadge(s: string) {
  if (s === "available") return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[oklch(0.4_0.12_140_/_0.3)] text-[oklch(0.85_0.14_140)]">Disponível</span>;
  if (s === "analysis") return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[oklch(0.4_0.12_75_/_0.3)] text-[oklch(0.85_0.14_80)]">Em análise</span>;
  return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[oklch(0.4_0.1_30_/_0.3)] text-[oklch(0.8_0.13_50)]">Ocupado</span>;
}

function LinkRow({ link, host, selected, onToggle, onEdit, onMetrics, onChange }: {
  link: ShortLink; host: string; selected: boolean;
  onToggle: () => void; onEdit: () => void; onMetrics: () => void; onChange: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const shortUrl = `https://${host}/r/${link.slug}`;

  const copy = async () => {
    await navigator.clipboard.writeText(shortUrl);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
    toast.success("Link copiado");
  };
  const remove = async () => {
    if (!confirm(`Excluir /r/${link.slug}?`)) return;
    await supabase.from("short_links").delete().eq("id", link.id);
    onChange();
  };

  return (
    <div className={`rounded-xl border p-4 transition ${selected ? "border-[oklch(0.7_0.14_75)] bg-[oklch(0.3_0.06_70_/_0.2)]" : "border-border bg-secondary/30"}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={selected} onChange={onToggle}
          className="mt-1 h-4 w-4 accent-[oklch(0.7_0.14_75)]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-[oklch(0.85_0.14_75)] truncate">{host}/r/{link.slug}</span>
            {statusBadge(link.status)}
            {link.label && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{link.label}</span>}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground truncate flex items-center gap-1">
            <ExternalLink className="h-3 w-3 shrink-0" />
            {link.target_url ?? <span className="italic">— sem destino —</span>}
          </p>
          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span title="Contagem bruta — inclui prévias do WhatsApp/redes sociais e robôs. Veja o modal de métricas para o número real, sem bots.">
              {link.click_count} cliques (bruto)
            </span>
            <span>· criado {new Date(link.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            {link.last_clicked_at && <span>· último: {new Date(link.last_clicked_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onMetrics} title="Métricas" className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground">
            <BarChart3 className="h-4 w-4" />
          </button>
          <button onClick={onEdit} title="Editar" className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={copy} title="Copiar" className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground">
            {copied ? <Check className="h-4 w-4 text-[oklch(0.86_0.14_80)]" /> : <Copy className="h-4 w-4" />}
          </button>
          <button onClick={remove} title="Excluir" className="p-2 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============== MODALS ============== */

function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card-premium p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function GenerateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [count, setCount] = useState(20);
  const [length, setLength] = useState(6);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const fn = useServerFn(bulkGenerateSlugs);
  const submit = async () => {
    setSaving(true);
    try {
      const defaultTarget = typeof window !== "undefined" ? null : null;
      const r: any = await fn({ data: { count, length, label, default_target: defaultTarget } });
      toast.success(`${r.created} slugs criados — criados`);
      onDone(); onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };
  return (
    <ModalShell title="Gerar em Massa" onClose={onClose}>
      <p className="text-sm text-muted-foreground mb-4">Cria N slugs já apontando para o destino que quiser. Você pode trocar o destino de cada slug a qualquer momento.</p>
      <div className="grid grid-cols-2 gap-3">
        <NumField label="Quantidade" value={count} onChange={setCount} min={1} max={500} />
        <NumField label="Tamanho do slug" value={length} onChange={setLength} min={4} max={12} />
      </div>
      <label className="block mt-3">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Apelido (opcional)</span>
        <input value={label} onChange={e => setLabel(e.target.value)}
          placeholder="Ex.: Lote agosto"
          className="mt-1.5 w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none" />
      </label>
      <button onClick={submit} disabled={saving}
        className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gold-metal px-6 py-3 text-sm font-semibold disabled:opacity-50">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />} Gerar {count} slugs
      </button>
    </ModalShell>
  );
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const fn = useServerFn(bulkImportUrls);
  const urls = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const submit = async () => {
    setSaving(true);
    try {
      const r: any = await fn({ data: { urls } });
      toast.success(`${r.created} links importados`);
      onDone(); onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };
  return (
    <ModalShell title="Importar em Massa" onClose={onClose}>
      <p className="text-sm text-muted-foreground mb-3">Cole 1 URL por linha. Cada uma vira 1 slug <b>Ocupado</b>.</p>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={8}
        placeholder="https://destino1.com&#10;https://destino2.com"
        className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm font-mono focus:outline-none" />
      <div className="text-xs text-muted-foreground mt-1">{urls.length} URL(s) válidas</div>
      <button onClick={submit} disabled={saving || urls.length === 0}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gold-metal px-6 py-3 text-sm font-semibold disabled:opacity-50">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />} Importar {urls.length} links
      </button>
    </ModalShell>
  );
}

function NewLinkModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [slug, setSlug] = useState(Math.random().toString(36).slice(2, 8));
  const [target, setTarget] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const { error } = await supabase.from("short_links").insert({
        user_id: u.user.id, slug: slug.toLowerCase(),
        target_url: target.trim() || null, is_rotating: false,
        status: target.trim() ? "occupied" : "available", label: label || null,
      });
      if (error) throw error;
      toast.success("Link criado");
      onDone(); onClose();
    } catch (e: any) { toast.error(e.message?.includes("duplicate") ? "Slug em uso" : e.message); }
    finally { setSaving(false); }
  };
  return (
    <ModalShell title="Novo Link" onClose={onClose}>
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Slug</span>
          <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-input border border-border px-3 py-2">
            <span className="text-xs text-muted-foreground">/r/</span>
            <input value={slug} onChange={e => setSlug(e.target.value)} pattern="[a-z0-9-]+"
              className="flex-1 bg-transparent text-sm font-mono focus:outline-none" />
          </div>
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">URL de destino (opcional)</span>
          <input value={target} onChange={e => setTarget(e.target.value)} type="url" placeholder="https://… (deixe vazio se ainda for aprovar template)"
            className="mt-1.5 w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Apelido (opcional)</span>
          <input value={label} onChange={e => setLabel(e.target.value)}
            className="mt-1.5 w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none" />
        </label>
        <button onClick={submit} disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gold-metal px-6 py-3 text-sm font-semibold disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Criar
        </button>
      </div>
    </ModalShell>
  );
}

function EditModal({ link, onClose, onDone }: { link: ShortLink; onClose: () => void; onDone: () => void }) {
  const [isRotating, setIsRotating] = useState(link.is_rotating);
  const [target, setTarget] = useState(link.target_url ?? "");
  const [urls, setUrls] = useState<string[]>([""]);
  const [status, setStatus] = useState(link.status);
  const [label, setLabel] = useState(link.label ?? "");
  const [saving, setSaving] = useState(false);
  const updateFn = useServerFn(updateShortLinkTarget);
  const rotFn = useServerFn(setRotationUrls);
  const getRot = useServerFn(getRotationUrls);

  useEffect(() => {
    if (link.is_rotating) {
      getRot({ data: { short_link_id: link.id } }).then((r: any) => {
        const list = (r.urls ?? []).map((u: any) => u.url);
        setUrls(list.length ? list : [""]);
      });
    }
  }, []);

  const submit = async () => {
    setSaving(true);
    try {
      if (isRotating) {
        const clean = urls.map(u => u.trim()).filter(Boolean);
        if (clean.length < 2) throw new Error("Adicione pelo menos 2 URLs para rotação");
        await rotFn({ data: { short_link_id: link.id, urls: clean, is_rotating: true } });
        await updateFn({ data: { id: link.id, target_url: clean[0], status, label } });
      } else {
        await rotFn({ data: { short_link_id: link.id, urls: [], is_rotating: false } });
        await updateFn({ data: { id: link.id, target_url: target, status, label } });
      }
      toast.success("Atualizado");
      onDone(); onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <ModalShell title={`Editar /r/${link.slug}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
          <div>
            <div className="text-sm font-semibold">Modo Rotação</div>
            <div className="text-[11px] text-muted-foreground">Alterne entre múltiplas URLs a cada clique</div>
          </div>
          <button onClick={() => setIsRotating(v => !v)}
            className={`relative h-6 w-11 rounded-full transition ${isRotating ? "bg-[oklch(0.7_0.14_75)]" : "bg-secondary border border-border"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition ${isRotating ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>

        {!isRotating ? (
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">URL de destino</span>
            <input value={target} onChange={e => setTarget(e.target.value)} type="url"
              placeholder="https://…"
              className="mt-1.5 w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none" />
            <p className="text-[11px] text-muted-foreground mt-1">Trocar o destino mantém o mesmo slug curto.</p>
          </label>
        ) : (
          <div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">URLs em rotação</span>
            <div className="mt-1.5 space-y-2">
              {urls.map((u, i) => (
                <div key={i} className="flex gap-2">
                  <input value={u} onChange={e => setUrls(arr => arr.map((x, j) => j === i ? e.target.value : x))}
                    type="url" placeholder={`https://destino-${i + 1}.com`}
                    className="flex-1 rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none" />
                  <button onClick={() => setUrls(arr => arr.filter((_, j) => j !== i))}
                    disabled={urls.length === 1}
                    className="p-2 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive disabled:opacity-30">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={() => setUrls(arr => [...arr, ""])}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-[oklch(0.7_0.14_75)]">
                <Plus className="h-4 w-4" /> Adicionar URL
              </button>
            </div>
          </div>
        )}

        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Status</span>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="mt-1.5 w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none">
            <option value="available">Disponível</option>
            <option value="analysis">Em análise</option>
            <option value="occupied">Ocupado</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Apelido</span>
          <input value={label} onChange={e => setLabel(e.target.value)}
            className="mt-1.5 w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none" />
        </label>
        <div className="text-[11px] text-muted-foreground">
          {link.click_count} cliques registrados (bruto — inclui prévias/robôs)
          {link.last_clicked_at && ` · último em ${new Date(link.last_clicked_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
        </div>
        <button onClick={submit} disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gold-metal px-6 py-3 text-sm font-semibold disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
        </button>
      </div>
    </ModalShell>
  );
}

function BulkReplaceModal({ ids, onClose, onDone }: { ids: string[]; onClose: () => void; onDone: () => void }) {
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const fn = useServerFn(bulkReplaceTargets);
  const submit = async () => {
    setSaving(true);
    try {
      const r: any = await fn({ data: { ids, target_url: url } });
      toast.success(`${r.updated} links atualizados`);
      onDone(); onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };
  return (
    <ModalShell title={`Trocar destino de ${ids.length} links`} onClose={onClose}>
      <p className="text-sm text-muted-foreground mb-3">Os {ids.length} slugs selecionados vão apontar para a mesma URL.</p>
      <input value={url} onChange={e => setUrl(e.target.value)} type="url" placeholder="https://novo-destino.com"
        className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none" />
      <button onClick={submit} disabled={saving || !url}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gold-metal px-6 py-3 text-sm font-semibold disabled:opacity-50">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />} Aplicar
      </button>
    </ModalShell>
  );
}

function DomainModal({ current, onClose, onSaved }: { current: string | null; onClose: () => void; onSaved: (d: string | null) => void }) {
  const [val, setVal] = useState(current ?? "");
  const [saving, setSaving] = useState(false);
  const fn = useServerFn(setShortLinkDomain);
  const submit = async () => {
    setSaving(true);
    try {
      const r: any = await fn({ data: { domain: val || null } });
      toast.success("Domínio salvo");
      onSaved(r.domain); onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };
  return (
    <ModalShell title="Domínio do Redirecionador" onClose={onClose}>
      <p className="text-sm text-muted-foreground mb-3">
        Domínio mostrado nos links curtos (ex.: <code>entrars.site</code>). Você precisa apontar esse domínio para o Lovable (registro A <code>185.158.133.1</code> + TXT <code>_lovable</code>). Enquanto isso os links também funcionam em <code>{typeof window !== "undefined" ? window.location.host : ""}</code>.
      </p>
      <input value={val} onChange={e => setVal(e.target.value)} placeholder="entrars.site"
        className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm font-mono focus:outline-none" />
      <button onClick={submit} disabled={saving}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gold-metal px-6 py-3 text-sm font-semibold disabled:opacity-50">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
      </button>
    </ModalShell>
  );
}

function NumField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <input type="number" min={min} max={max} value={value}
        onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
        className="mt-1.5 w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none" />
    </label>
  );
}

interface ClickRow {
  id: string;
  created_at: string;
  ip: string | null;
  country: string | null;
  region: string | null;
  region_code: string | null;
  city: string | null;
  user_agent: string | null;
  referer: string | null;
  target_url: string | null;
  is_bot: boolean;
}

function formatLocal(c: { city: string | null; region: string | null; region_code: string | null; country: string | null }): string {
  const uf = (c.region_code && c.region_code.length <= 3) ? c.region_code.toUpperCase() : (c.region ?? "");
  if (c.city && uf) return `${c.city}/${uf}`;
  return [c.city, c.region, c.country].filter(Boolean).join(", ");
}

function MetricsModal({ link, onClose }: { link: ShortLink; onClose: () => void }) {
  const [clicks, setClicks] = useState<ClickRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [period, setPeriod] = useState<"today" | "7d" | "30d" | "all">("30d");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("short_link_clicks")
        .select("id,created_at,ip,country,region,region_code,city,user_agent,referer,target_url,is_bot")
        .eq("short_link_id", link.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) setError(error.message);
      else setClicks((data as ClickRow[]) ?? []);
    })();
  }, [link.id]);

  const parseOS = (ua: string | null) => {
    if (!ua) return "—";
    if (/iPhone|iPad|iOS/i.test(ua)) return "iOS";
    if (/Android/i.test(ua)) return "Android";
    if (/Windows/i.test(ua)) return "Windows";
    if (/Mac OS/i.test(ua)) return "macOS";
    if (/Linux/i.test(ua)) return "Linux";
    return "Outro";
  };
  const parseBrowser = (ua: string | null) => {
    if (!ua) return "—";
    if (/Edg\//i.test(ua)) return "Edge";
    if (/OPR\/|Opera/i.test(ua)) return "Opera";
    if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) return "Chrome";
    if (/Firefox/i.test(ua)) return "Firefox";
    if (/Safari/i.test(ua)) return "Safari";
    if (/WhatsApp/i.test(ua)) return "WhatsApp";
    if (/Instagram/i.test(ua)) return "Instagram";
    if (/FBAN|FBAV|Facebook/i.test(ua)) return "Facebook";
    return "Outro";
  };
  const parseDevice = (ua: string | null) => {
    if (!ua) return "Desconhecido";
    if (/Mobile|Android|iPhone|iPod/i.test(ua) && !/iPad|Tablet/i.test(ua)) return "Mobile";
    if (/iPad|Tablet/i.test(ua)) return "Tablet";
    return "Desktop";
  };
  const parseReferrer = (r: string | null) => {
    if (!r) return "Direto";
    try { return new URL(r).hostname.replace(/^www\./, ""); } catch { return r; }
  };

  const periodFiltered = useMemo(() => {
    if (!clicks) return [];
    if (period === "all") return clicks;
    const now = Date.now();
    const ms = period === "today" ? 24 * 3600 * 1000 : period === "7d" ? 7 * 86400 * 1000 : 30 * 86400 * 1000;
    return clicks.filter(c => now - new Date(c.created_at).getTime() <= ms);
  }, [clicks, period]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return periodFiltered;
    return periodFiltered.filter(c => {
      const hay = [
        c.ip, c.country, c.region, c.region_code, c.city, c.referer, c.target_url,
        parseOS(c.user_agent), parseBrowser(c.user_agent), parseDevice(c.user_agent),
        new Date(c.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [periodFiltered, filter]);

  const stats = useMemo(() => {
    if (!clicks) return null;
    const real = filtered.filter((c) => !c.is_bot);
    const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
    const byCountry = new Map<string, number>();
    const byCity = new Map<string, number>();
    const byRegion = new Map<string, number>();
    const byReferrer = new Map<string, number>();
    const byDevice = new Map<string, number>();
    const byBrowser = new Map<string, number>();
    const byOS = new Map<string, number>();
    const byTarget = new Map<string, number>();
    const byDay = new Map<string, number>();
    const byHour = new Map<string, number>();
    const uniqueIps = new Set<string>();
    for (const c of real) {
      inc(byCountry, c.country || "—");
      if (c.city) inc(byCity, c.city);
      if (c.region) inc(byRegion, c.region);
      inc(byReferrer, parseReferrer(c.referer));
      inc(byDevice, parseDevice(c.user_agent));
      inc(byBrowser, parseBrowser(c.user_agent));
      inc(byOS, parseOS(c.user_agent));
      if (c.target_url) inc(byTarget, c.target_url);
      const d = new Date(c.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      inc(byDay, d);
      const h = new Date(c.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).slice(0, 2);
      inc(byHour, h);
      if (c.ip) uniqueIps.add(c.ip);
    }
    const sortDesc = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]);
    // Chart series
    const daySeries = [...byDay.entries()]
      .map(([label, value]) => ({ label, value, ts: parseBrDate(label) }))
      .sort((a, b) => a.ts - b.ts)
      .map(({ label, value }) => ({ label, value }));
    const hourSeries = Array.from({ length: 24 }, (_, i) => {
      const key = String(i).padStart(2, "0");
      return { label: `${key}h`, value: byHour.get(key) ?? 0 };
    });
    return {
      total: real.length,
      rawTotal: filtered.length,
      bots: filtered.length - real.length,
      uniqueIps: uniqueIps.size,
      countriesCount: byCountry.size,
      devicesCount: byDevice.size,
      topCountries: sortDesc(byCountry).slice(0, 8),
      topCities: sortDesc(byCity).slice(0, 8),
      topRegions: sortDesc(byRegion).slice(0, 8),
      topReferrers: sortDesc(byReferrer).slice(0, 8),
      topDevices: sortDesc(byDevice).slice(0, 8),
      topBrowsers: sortDesc(byBrowser).slice(0, 8),
      topOS: sortDesc(byOS).slice(0, 8),
      topTargets: sortDesc(byTarget).slice(0, 8),
      daySeries,
      hourSeries,
    };
  }, [clicks, filtered]);

  const exportCsv = () => {
    const headers = ["data_iso", "data_br", "ip", "pais", "regiao", "uf", "cidade", "local", "dispositivo", "navegador", "sistema", "user_agent", "origem", "destino"];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const c of filtered) {
      lines.push([
        c.created_at,
        new Date(c.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        c.ip ?? "",
        c.country ?? "",
        c.region ?? "",
        c.region_code ?? "",
        c.city ?? "",
        formatLocal(c),
        parseDevice(c.user_agent),
        parseBrowser(c.user_agent),
        parseOS(c.user_agent),
        c.user_agent ?? "",
        c.referer ?? "",
        c.target_url ?? "",
      ].map(esc).join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `cliques-${link.slug}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl my-4 rounded-2xl border border-[#27272A] bg-[#09090B] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-5 sm:p-6 border-b border-[#1F1F22]">
          <div className="min-w-0">
            <h3 className="font-display text-lg sm:text-2xl tracking-tight text-white">
              Analytics Premium — <span className="text-[#F5C026]">/r/{link.slug}</span>
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Acessos reais · bots filtrados · dados completos por clique
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as typeof period)}
              className="rounded-lg bg-[#141416] border border-[#27272A] text-zinc-200 text-sm px-3 py-2 focus:outline-none focus:border-[#F5C026]"
            >
              <option value="today">Hoje</option>
              <option value="7d">7 dias</option>
              <option value="30d">30 dias</option>
              <option value="all">Tudo</option>
            </select>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!stats || filtered.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-[#F5C026] hover:bg-[#FFC700] text-black text-sm font-semibold px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-[#141416]"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-6">
          {error && <p className="text-sm text-red-400">{error}</p>}
          {!clicks && !error && (
            <div className="py-16 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#F5C026]" />
            </div>
          )}

          {stats && (
            <>
              {/* KPI grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  label="Cliques reais"
                  value={stats.total}
                  hint={`${stats.bots} prévia(s)/robô(s) ignorado(s) · bruto: ${stats.rawTotal}`}
                />
                <KpiCard label="IPs únicos" value={stats.uniqueIps} />
                <KpiCard label="Países" value={stats.countriesCount} />
                <KpiCard label="Dispositivos" value={stats.devicesCount} />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard title="Cliques por dia">
                  {stats.daySeries.length === 0 ? (
                    <EmptyChart />
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={stats.daySeries} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                        <defs>
                          <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#F5C026" stopOpacity={0.55} />
                            <stop offset="100%" stopColor="#F5C026" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#1F1F22" strokeDasharray="3 3" />
                        <XAxis dataKey="label" stroke="#71717A" tick={{ fill: "#A1A1AA", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#27272A" }} />
                        <YAxis stroke="#71717A" tick={{ fill: "#A1A1AA", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#27272A" }} allowDecimals={false} />
                        <Tooltip contentStyle={{ background: "#141416", border: "1px solid #27272A", borderRadius: 8, color: "#fafafa" }} labelStyle={{ color: "#F5C026" }} />
                        <Area type="monotone" dataKey="value" stroke="#F5C026" strokeWidth={2} fill="url(#goldFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>

                <ChartCard title="Cliques por hora (Brasília)">
                  {stats.total === 0 ? (
                    <EmptyChart />
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={stats.hourSeries} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                        <CartesianGrid stroke="#1F1F22" strokeDasharray="3 3" />
                        <XAxis dataKey="label" stroke="#71717A" tick={{ fill: "#A1A1AA", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#27272A" }} interval={2} />
                        <YAxis stroke="#71717A" tick={{ fill: "#A1A1AA", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#27272A" }} allowDecimals={false} />
                        <Tooltip cursor={{ fill: "rgba(245,192,38,0.08)" }} contentStyle={{ background: "#141416", border: "1px solid #27272A", borderRadius: 8, color: "#fafafa" }} labelStyle={{ color: "#F5C026" }} />
                        <Bar dataKey="value" fill="#F5C026" radius={[3, 3, 0, 0]} maxBarSize={14} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              </div>

              {/* Filter */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filtrar por IP, país, cidade, origem, destino, dispositivo…"
                  className="w-full rounded-lg bg-[#141416] border border-[#27272A] text-zinc-100 placeholder:text-zinc-500 pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#F5C026]"
                />
              </div>

              {/* Breakdown grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <BreakdownCard title="Top países" rows={stats.topCountries} />
                <BreakdownCard title="Top cidades" rows={stats.topCities} />
                <BreakdownCard title="Top regiões" rows={stats.topRegions} />
                <BreakdownCard title="Top referrers" rows={stats.topReferrers} />
                <BreakdownCard title="Dispositivos" rows={stats.topDevices} />
                <BreakdownCard title="Navegadores" rows={stats.topBrowsers} />
                <BreakdownCard title="Sistemas" rows={stats.topOS} />
                <BreakdownCard title="Destinos" rows={stats.topTargets} mono />
              </div>

              {/* Recent table */}
              <div className="rounded-xl border border-[#27272A] bg-[#141416] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1F1F22] text-[11px] uppercase tracking-widest text-[#F5C026] font-semibold">
                  Últimos cliques ({filtered.length})
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-[#0D0D0D] text-zinc-400">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Data (BR)</th>
                        <th className="text-left px-3 py-2 font-medium">IP</th>
                        <th className="text-left px-3 py-2 font-medium">Local</th>
                        <th className="text-left px-3 py-2 font-medium">Dispositivo</th>
                        <th className="text-left px-3 py-2 font-medium">Origem</th>
                        <th className="text-left px-3 py-2 font-medium">Destino</th>
                      </tr>
                    </thead>
                    <tbody className="text-zinc-200">
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                            {clicks!.length === 0 ? "Nenhum clique ainda." : "Nenhum clique corresponde ao filtro."}
                          </td>
                        </tr>
                      ) : filtered.slice(0, 100).map((c) => (
                        <tr key={c.id} className="border-t border-[#1F1F22]">
                          <td className="px-3 py-2 font-mono whitespace-nowrap">
                            {new Date(c.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </td>
                          <td className="px-3 py-2 font-mono">{c.ip ?? "—"}</td>
                          <td className="px-3 py-2">
                            {formatLocal(c) || "—"}
                            {c.is_bot ? <span className="ml-2 text-[10px] text-[#F5C026]">robô/prévia</span> : null}
                          </td>
                          <td className="px-3 py-2">{parseDevice(c.user_agent)} · {parseBrowser(c.user_agent)}</td>
                          <td className="px-3 py-2 max-w-[160px] truncate" title={c.referer ?? ""}>{parseReferrer(c.referer)}</td>
                          <td className="px-3 py-2 max-w-[220px] truncate" title={c.target_url ?? ""}>{c.target_url ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function parseBrDate(br: string): number {
  // "DD/MM/YYYY" -> timestamp
  const [d, m, y] = br.split("/").map(Number);
  if (!d || !m || !y) return 0;
  return new Date(y, m - 1, d).getTime();
}

function KpiCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[#27272A] bg-[#141416] p-4">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">{label}</div>
      <div className="text-3xl sm:text-4xl font-display font-bold text-[#F5C026] mt-1 tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-zinc-500 mt-2 leading-snug">{hint}</div>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#27272A] bg-[#141416] p-4">
      <div className="text-[11px] uppercase tracking-widest text-[#F5C026] font-semibold mb-3">{title}</div>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-[220px] flex items-center justify-center text-xs text-zinc-500">
      Sem dados no período selecionado.
    </div>
  );
}

function BreakdownCard({ title, rows, mono = false }: { title: string; rows: [string, number][]; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-[#27272A] bg-[#141416] p-4">
      <div className="text-[11px] uppercase tracking-widest text-[#F5C026] font-semibold mb-3">{title}</div>
      {rows.length === 0 ? (
        <div className="text-xs text-zinc-500 py-4 text-center">Sem dados.</div>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {rows.map(([k, n]) => (
            <li key={k} className="flex items-center justify-between gap-2">
              <span className={`text-zinc-300 truncate ${mono ? "font-mono text-xs" : ""}`} title={k}>{k}</span>
              <span className="text-[#F5C026] font-semibold tabular-nums shrink-0">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
