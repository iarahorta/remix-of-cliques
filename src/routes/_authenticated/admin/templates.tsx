import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Plus, Trash2, FileText, Eye, MessageCircle } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/templates")({
  head: () => ({ meta: [{ title: "Templates — Admin HS Assessoria" }] }),
  component: TemplatesAdmin,
});

interface VariableSpec { key: string; label: string; placeholder?: string; optional?: boolean }
interface Template { id: string; name: string; content: string; variables: VariableSpec[]; is_fixed: boolean; is_active: boolean; sort_order: number }

function normalizeTemplateContent(content: string) {
  // Conserta chaves quebradas (ex.: "{{1}" → "{{1}}")
  return content.replace(/\{\{(\w+)\}(?!\})/g, "{{$1}}");
}

function renderPreview(content: string, vars: VariableSpec[], data: Record<string, string>) {
  let out = normalizeTemplateContent(content);
  vars.forEach((v) => {
    const val = data[v.key] || (v.optional ? "" : `{{${v.key}}}`);
    const re = new RegExp(`\\{\\{\\s*${v.key}\\s*\\}\\}?`, "g");
    out = out.replace(re, val);
  });
  return out;
}

function TemplatesAdmin() {
  const [list, setList] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("message_templates").select("*").order("sort_order");
    setList((data as any) ?? []);
    if (!selectedId && data?.length) setSelectedId(data[0].id);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const selected = list.find((t) => t.id === selectedId) ?? null;

  const update = (patch: Partial<Template>) => {
    if (!selected) return;
    setList((arr) => arr.map((t) => t.id === selected.id ? { ...t, ...patch } : t));
  };

  const save = async () => {
    if (!selected) return;
    await supabase.from("message_templates").update({
      name: selected.name, content: normalizeTemplateContent(selected.content), variables: selected.variables as any, is_active: selected.is_active, is_fixed: selected.is_fixed,
    }).eq("id", selected.id);
    load();
  };

  const addTemplate = async () => {
    const { data } = await supabase.from("message_templates").insert({
      name: "Novo template",
      content: "Olá {{1}}! Mensagem aqui.",
      variables: [{ key: "1", label: "Saudação", placeholder: "Ex: Lucas", optional: true }] as any,
      is_fixed: false, sort_order: list.length + 1,
    }).select().single();
    load();
    if (data) setSelectedId(data.id);
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este template?")) return;
    await supabase.from("message_templates").delete().eq("id", id);
    setSelectedId(null);
    load();
  };

  return (
    <PageShell title="Templates de Mensagem" subtitle="Crie e edite os templates fixos com variáveis que o cliente preenche.">
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="card-premium p-4 h-fit">
          <button onClick={addTemplate} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gold-metal px-4 py-2 text-sm font-semibold mb-3">
            <Plus className="h-4 w-4" /> Novo template
          </button>
          {loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : (
            <div className="space-y-1">
              {list.map((t) => (
                <button key={t.id} onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors ${selectedId === t.id ? "bg-[oklch(0.78_0.13_75_/_0.12)] border border-[oklch(0.55_0.1_60)]" : "hover:bg-secondary/60"}`}>
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-[oklch(0.75_0.13_75)]" />
                    <span className="truncate flex-1">{t.name}</span>
                    {t.is_fixed && <span className="text-[9px] uppercase text-[oklch(0.75_0.13_75)]">fixo</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {selected && <Editor template={selected} onUpdate={update} onSave={save} onRemove={() => remove(selected.id)} />}
      </div>
    </PageShell>
  );
}

function Editor({ template, onUpdate, onSave, onRemove }: { template: Template; onUpdate: (p: Partial<Template>) => void; onSave: () => void; onRemove: () => void }) {
  const [previewData, setPreviewData] = useState<Record<string, string>>({});

  const variables = template.variables ?? [];

  const addVar = () => {
    const next = variables.length + 1;
    onUpdate({ variables: [...variables, { key: String(next), label: `Variável ${next}`, placeholder: "" }] });
  };
  const updateVar = (idx: number, patch: Partial<VariableSpec>) => {
    onUpdate({ variables: variables.map((v, i) => i === idx ? { ...v, ...patch } : v) });
  };
  const removeVar = (idx: number) => {
    onUpdate({ variables: variables.filter((_, i) => i !== idx) });
  };
  const insertVarToken = (key: string) => {
    const ta = document.getElementById("tpl-content") as HTMLTextAreaElement | null;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const next = template.content.slice(0, start) + `{{${key}}}` + template.content.slice(end);
    onUpdate({ content: next });
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + key.length + 4;
      ta.setSelectionRange(pos, pos);
    });
  };

  const preview = renderPreview(template.content, variables, previewData);

  return (
    <div className="space-y-6">
      <div className="card-premium p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <input
            value={template.name} onChange={(e) => onUpdate({ name: e.target.value })}
            className="flex-1 bg-transparent font-display text-2xl focus:outline-none focus:border-b focus:border-[oklch(0.55_0.1_60)]"
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={template.is_fixed} onChange={(e) => onUpdate({ is_fixed: e.target.checked })} />
            Template fixo
          </label>
          <button onClick={onRemove} className="p-2 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Conteúdo</span>
              {variables.map((v) => (
                <button key={v.key} type="button" onClick={() => insertVarToken(v.key)}
                  className="rounded-full border border-border bg-secondary/60 px-2.5 py-0.5 text-[10px] font-mono hover:bg-gold-metal hover:text-background hover:border-transparent transition-colors">
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>
            <textarea
              id="tpl-content" value={template.content} onChange={(e) => onUpdate({ content: e.target.value })}
              className="w-full min-h-[180px] rounded-lg bg-input border border-border px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
            <p className="mt-2 text-xs text-muted-foreground">Use {`{{1}}, {{2}}...`} para os campos que o cliente preenche.</p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Eye className="h-3.5 w-3.5 text-[oklch(0.75_0.13_75)]" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Pré-visualização</span>
            </div>
            <div className="rounded-2xl bg-[oklch(0.14_0.01_60)] border border-[oklch(0.3_0.03_65_/_0.5)] p-4 min-h-[180px]">
              <div className="inline-block max-w-full rounded-2xl bg-[oklch(0.3_0.05_70)] text-foreground p-3 text-sm whitespace-pre-wrap break-words">
                {preview || "Vazio"}
              </div>
              <div className="mt-1 text-[10px] text-white/40 flex items-center gap-1"><MessageCircle className="h-3 w-3" /> WhatsApp preview</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card-premium p-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-display text-lg">Variáveis</h4>
          <button onClick={addVar} className="inline-flex items-center gap-1.5 text-xs text-[oklch(0.75_0.13_75)] hover:underline">
            <Plus className="h-3.5 w-3.5" /> Adicionar variável
          </button>
        </div>
        <div className="space-y-2">
          {variables.map((v, i) => (
            <div key={i} className="grid grid-cols-[60px_1fr_1fr_auto_auto] gap-2 items-center rounded-lg border border-border bg-secondary/30 p-2">
              <input value={v.key} onChange={(e) => updateVar(i, { key: e.target.value })}
                placeholder="1" className="bg-input border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring" />
              <input value={v.label} onChange={(e) => updateVar(i, { label: e.target.value })}
                placeholder="Rótulo (ex: Saudação)" className="bg-input border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
              <input value={v.placeholder ?? ""} onChange={(e) => updateVar(i, { placeholder: e.target.value })}
                placeholder="Placeholder (ex: Lucas)" className="bg-input border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
              <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <input type="checkbox" checked={!!v.optional} onChange={(e) => updateVar(i, { optional: e.target.checked })} />
                opcional
              </label>
              <button onClick={() => removeVar(i)} className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Testar preview</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {variables.map((v) => (
              <input key={v.key} value={previewData[v.key] ?? ""} onChange={(e) => setPreviewData({ ...previewData, [v.key]: e.target.value })}
                placeholder={`${v.label} (${v.placeholder ?? `{{${v.key}}}`})`}
                className="bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            ))}
          </div>
        </div>
      </div>

      <button onClick={onSave} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gold-metal px-6 py-3 text-base font-semibold hover:scale-[1.01] transition-transform">
        <Save className="h-4 w-4" /> Salvar alterações
      </button>
    </div>
  );
}
