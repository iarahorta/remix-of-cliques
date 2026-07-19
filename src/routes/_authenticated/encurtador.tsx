import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Link2, Plus, Trash2, Copy, Check, ExternalLink, Loader2, Search,
  Globe, Wand2, Upload, RefreshCw, Pencil, X, BarChart3, Download,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";
import {
  bulkGenerateSlugs, bulkImportUrls, updateShortLinkTarget,
  bulkReplaceTargets, getShortLinkDomain, setShortLinkDomain,
  getRotationUrls, setRotationUrls,
} from "@/lib/short-links.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/encurtador")({
  head: () => ({ meta: [{ title: "Encurtador — cliques" }] }),
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
            <span>{link.click_count} cliques</span>
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
      const defaultTarget = typeof window !== "undefined" ? `${window.location.origin}/portal` : null;
      const r: any = await fn({ data: { count, length, label, default_target: defaultTarget } });
      toast.success(`${r.created} slugs criados — apontando para /portal`);
      onDone(); onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };
  return (
    <ModalShell title="Gerar em Massa" onClose={onClose}>
      <p className="text-sm text-muted-foreground mb-4">Cria N slugs já apontando para <code>/portal</code>. Você pode trocar o destino de cada slug a qualquer momento.</p>
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
          {link.click_count} cliques registrados {link.last_clicked_at && `· último em ${new Date(link.last_clicked_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
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
  city: string | null;
  user_agent: string | null;
  referer: string | null;
  target_url: string | null;
}

function MetricsModal({ link, onClose }: { link: ShortLink; onClose: () => void }) {
  const [clicks, setClicks] = useState<ClickRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("short_link_clicks")
        .select("id,created_at,ip,country,region,city,user_agent,referer,target_url")
        .eq("short_link_id", link.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) setError(error.message);
      else setClicks((data as ClickRow[]) ?? []);
    })();
  }, [link.id]);

  const parseUA = (ua: string | null) => {
    if (!ua) return "—";
    if (/WhatsApp/i.test(ua)) return "WhatsApp";
    if (/Instagram/i.test(ua)) return "Instagram";
    if (/FBAN|FBAV|Facebook/i.test(ua)) return "Facebook";
    if (/iPhone|iPad/i.test(ua)) return "iOS";
    if (/Android/i.test(ua)) return "Android";
    if (/Windows/i.test(ua)) return "Windows";
    if (/Mac OS/i.test(ua)) return "macOS";
    if (/Linux/i.test(ua)) return "Linux";
    return "Outro";
  };

  const filtered = useMemo(() => {
    if (!clicks) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return clicks;
    return clicks.filter(c => {
      const hay = [
        c.ip, c.country, c.region, c.city, c.referer, c.target_url,
        parseUA(c.user_agent),
        new Date(c.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [clicks, filter]);

  const stats = useMemo(() => {
    if (!clicks) return null;
    const byCountry = new Map<string, number>();
    const byDay = new Map<string, number>();
    const uniqueIps = new Set<string>();
    for (const c of filtered) {
      const k = c.country || "—";
      byCountry.set(k, (byCountry.get(k) ?? 0) + 1);
      const d = new Date(c.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
      if (c.ip) uniqueIps.add(c.ip);
    }
    return {
      total: filtered.length,
      uniqueIps: uniqueIps.size,
      countries: [...byCountry.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
      days: [...byDay.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    };
  }, [clicks, filtered]);

  const exportCsv = () => {
    const headers = ["data_iso", "data_br", "ip", "pais", "regiao", "cidade", "dispositivo", "user_agent", "origem", "destino"];
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
        c.city ?? "",
        parseUA(c.user_agent),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card-premium p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-xl">Métricas · /r/{link.slug}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Últimos 500 cliques com IP, localização e dispositivo</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {!clicks && !error && (
          <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-[oklch(0.75_0.13_75)]" /></div>
        )}

        {stats && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <StatCard label="Cliques" value={stats.total.toString()} />
              <StatCard label="IPs únicos" value={stats.uniqueIps.toString()} />
              <StatCard label="Países" value={stats.countries.length.toString()} />
              <StatCard label="Dias ativos" value={stats.days.length.toString()} />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  placeholder="Filtrar por IP, país, cidade, origem, destino, dispositivo…"
                  className="w-full rounded-lg bg-input border border-border pl-9 pr-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={exportCsv}
                disabled={filtered.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary/50 hover:bg-secondary px-3 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" />
                Exportar CSV ({filtered.length})
              </button>
            </div>

            {stats.countries.length > 0 && (
              <div className="grid md:grid-cols-2 gap-4 mb-5">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Top países</div>
                  <ul className="space-y-1 text-sm">
                    {stats.countries.map(([c, n]) => (
                      <li key={c} className="flex justify-between"><span className="font-mono">{c}</span><span className="text-muted-foreground">{n}</span></li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Top dias</div>
                  <ul className="space-y-1 text-sm">
                    {stats.days.map(([d, n]) => (
                      <li key={d} className="flex justify-between"><span className="font-mono">{d}</span><span className="text-muted-foreground">{n}</span></li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-secondary/50 text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Data (BR)</th>
                    <th className="text-left px-3 py-2 font-medium">IP</th>
                    <th className="text-left px-3 py-2 font-medium">Local</th>
                    <th className="text-left px-3 py-2 font-medium">Dispositivo</th>
                    <th className="text-left px-3 py-2 font-medium">Origem</th>
                    <th className="text-left px-3 py-2 font-medium">Destino</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">{clicks!.length === 0 ? "Nenhum clique ainda." : "Nenhum clique corresponde ao filtro."}</td></tr>
                  ) : filtered.map(c => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        {new Date(c.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </td>
                      <td className="px-3 py-2 font-mono">{c.ip ?? "—"}</td>
                      <td className="px-3 py-2">{[c.city, c.region, c.country].filter(Boolean).join(", ") || "—"}</td>
                      <td className="px-3 py-2">{parseUA(c.user_agent)}</td>
                      <td className="px-3 py-2 max-w-[160px] truncate" title={c.referer ?? ""}>{c.referer ?? "—"}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate" title={c.target_url ?? ""}>{c.target_url ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3 bg-secondary/30">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-display mt-1">{value}</div>
    </div>
  );
}
