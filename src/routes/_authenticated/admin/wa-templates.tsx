import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageShell } from "@/components/page-shell";
import { Loader2, Plus, RefreshCw, Trash2, MessageSquareText, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { syncInfobipTemplates, createInfobipTemplate, deleteInfobipTemplate, createInfobipTemplateBatch } from "@/lib/infobip.functions";

export const Route = createFileRoute("/_authenticated/admin/wa-templates")({
  head: () => ({ meta: [{ title: "WhatsApp Templates — HS Assessoria" }] }),
  component: WaTemplatesPage,
});

type Row = {
  id: string; name: string; language: string; category: string; status: string;
  status_reason: string | null; body_text: string; header_text: string | null; footer_text: string | null;
  button_text: string | null; button_url_pattern: string | null; last_synced_at: string | null;
};

function WaTemplatesPage() {
  const sync = useServerFn(syncInfobipTemplates);
  const create = useServerFn(createInfobipTemplate);
  const createBatch = useServerFn(createInfobipTemplateBatch);
  const remove = useServerFn(deleteInfobipTemplate);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [openNew, setOpenNew] = useState(false);
  const [openDetail, setOpenDetail] = useState<Row | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("wa_templates").select("*").order("created_at", { ascending: false });
    setRows((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const doSync = async () => {
    setSyncing(true);
    try { const r: any = await sync({}); toast.success(`${r.count} templates sincronizados`); await load(); }
    catch (e: any) { toast.error(e.message); }
    finally { setSyncing(false); }
  };

  const doDelete = async (id: string) => {
    if (!confirm("Remover template local? (não apaga na Infobip)")) return;
    try { await remove({ data: { id } }); toast.success("Removido"); setRows((r) => r.filter((x) => x.id !== id)); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <PageShell title="WhatsApp Templates" subtitle="Templates da sua conta Infobip.">
      <div className="flex flex-wrap justify-end gap-2 mb-6">
        <button onClick={doSync} disabled={syncing}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/60 px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50">
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sincronizar
        </button>
        <button onClick={() => setOpenNew(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gold-metal px-4 py-2.5 text-sm font-semibold hover:scale-[1.02] transition">
          <Plus className="h-4 w-4" /> Novo template
        </button>
      </div>

      <div className="card-premium p-4 md:p-6">
        {loading ? (
          <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">Nenhum template ainda. Clique em Sincronizar para puxar da Infobip ou Novo template.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((t) => (
              <button key={t.id} onClick={() => setOpenDetail(t)}
                className="w-full text-left rounded-xl border border-border bg-secondary/20 p-4 hover:bg-secondary/40 transition flex items-center gap-3">
                <MessageSquareText className="h-4 w-4 text-[oklch(0.84_0.14_80)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{t.name}</span>
                    <StatusBadge status={t.status} />
                    <span className="text-xs text-muted-foreground">{t.language} · {t.category}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-1">{t.body_text}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); doDelete(t.id); }}
                  className="p-2 rounded-md hover:bg-destructive/20 text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>

      <NewTemplateDialog open={openNew} onOpenChange={setOpenNew}
        onCreated={async (msg) => { toast.success(msg); await load(); }}
        createFn={create as any} createBatchFn={createBatch as any} />

      <Dialog open={!!openDetail} onOpenChange={(v) => !v && setOpenDetail(null)}>
        <DialogContent className="max-w-2xl bg-card border-border">
          {openDetail && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-2xl">{openDetail.name}</h3>
                <StatusBadge status={openDetail.status} />
              </div>
              <p className="text-xs text-muted-foreground">{openDetail.language} · {openDetail.category}</p>
              {openDetail.status_reason && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive text-xs">
                  <strong>Motivo:</strong> {openDetail.status_reason}
                </div>
              )}
              {openDetail.header_text && <Section label="Header">{openDetail.header_text}</Section>}
              <Section label="Body">{openDetail.body_text}</Section>
              {openDetail.footer_text && <Section label="Footer">{openDetail.footer_text}</Section>}
              {openDetail.button_text && (
                <Section label="Botão">
                  <div className="text-xs">
                    <p><strong>{openDetail.button_text}</strong></p>
                    <p className="text-muted-foreground break-all">{openDetail.button_url_pattern}</p>
                  </div>
                </Section>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <div className="rounded-lg border border-border bg-input p-3 whitespace-pre-wrap text-sm">{children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "APPROVED" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
    : status === "REJECTED" ? "bg-destructive/20 text-destructive border-destructive/40"
    : "bg-amber-500/20 text-amber-300 border-amber-500/40";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${tone}`}>{status}</span>;
}

function NewTemplateDialog({ open, onOpenChange, onCreated, createFn, createBatchFn }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onCreated: (msg: string) => void;
  createFn: (args: any) => Promise<any>;
  createBatchFn: (args: any) => Promise<any>;
}) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("pt_BR");
  const [category, setCategory] = useState("MARKETING");
  const [body, setBody] = useState("");
  const [header, setHeader] = useState("");
  const [footer, setFooter] = useState("");
  const [btnText, setBtnText] = useState("");
  const [btnUrl, setBtnUrl] = useState("");
  const [variants, setVariants] = useState(1);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name || !body) { toast.error("Nome e Body são obrigatórios"); return; }
    setBusy(true);
    try {
      const payload = {
        language, category, body_text: body,
        header_text: header || null, footer_text: footer || null,
        button_text: btnText || null, button_url_pattern: btnUrl || null,
      };
      if (variants > 1) {
        const r: any = await createBatchFn({ data: { ...payload, base_name: name, variants } });
        onOpenChange(false);
        setName(""); setBody(""); setHeader(""); setFooter(""); setBtnText(""); setBtnUrl(""); setVariants(1);
        onCreated(`${r.ok} variantes enviadas para aprovação${r.failed ? ` (${r.failed} falharam)` : ""}`);
      } else {
        const r: any = await createFn({ data: { ...payload, name } });
        onOpenChange(false);
        setName(""); setBody(""); setHeader(""); setFooter(""); setBtnText(""); setBtnUrl(""); setVariants(1);
        onCreated(`Enviado para aprovação (${r.status})`);
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <h3 className="font-display text-2xl mb-1">Novo template WhatsApp</h3>
        <p className="text-xs text-muted-foreground mb-4">Use <code>{"{{1}}"}</code>, <code>{"{{2}}"}</code>… para variáveis. Botão fixo com URL genérica + placeholder {`{{1}}`}.</p>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
          <Row2><F label="Nome" value={name} onChange={setName} placeholder="meu_template_01" /><F label="Idioma" value={language} onChange={setLanguage} /></Row2>
          <F label="Categoria" value={category} onChange={setCategory} placeholder="MARKETING / UTILITY / AUTHENTICATION" />
          <F label="Header (opcional, texto puro)" value={header} onChange={setHeader} />
          <T label="Body" value={body} onChange={setBody} rows={5} />
          <F label="Footer (opcional)" value={footer} onChange={setFooter} />
          <Row2>
            <F label="Texto do botão" value={btnText} onChange={setBtnText} placeholder="Acessar" />
            <F label="URL do botão" value={btnUrl} onChange={setBtnUrl} placeholder="https://seudominio.com/{{1}}" />
          </Row2>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Quantidade de variantes para aprovação</label>
            <input type="number" min={1} max={20} value={variants}
              onChange={(e) => setVariants(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              className="w-32 rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-[oklch(0.6_0.12_75)]" />
            <p className="text-[11px] text-muted-foreground mt-1">
              {variants > 1
                ? `Será criado: ${name || "nome"}_01 … ${name || "nome"}_${String(variants).padStart(2, "0")}`
                : "1 template único."}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => onOpenChange(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancelar</button>
          <button onClick={submit} disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-gold-metal px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Enviar para aprovação
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex-1">
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-[oklch(0.6_0.12_75)]" />
    </div>
  );
}
function T({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-[oklch(0.6_0.12_75)] font-mono" />
    </div>
  );
}
function Row2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}
