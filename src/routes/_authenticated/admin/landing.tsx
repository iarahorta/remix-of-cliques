import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Save, GripVertical, Star, Eye, EyeOff } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/landing")({
  head: () => ({ meta: [{ title: "Landing — Admin HS Assessoria" }] }),
  component: LandingAdmin,
});

interface Plan {
  id: string;
  name: string;
  price_label: string;
  period_label: string | null;
  description: string | null;
  features: string[];
  cta_label: string;
  cta_url: string;
  highlighted: boolean;
  sort_order: number;
  active: boolean;
}

function LandingAdmin() {
  const [list, setList] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("landing_plans" as any)
      .select("*")
      .order("sort_order", { ascending: true });
    setList(((data as any) ?? []) as Plan[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addPlan = async () => {
    const nextOrder = list.length ? Math.max(...list.map((p) => p.sort_order)) + 1 : 0;
    const { data, error } = await supabase
      .from("landing_plans" as any)
      .insert({
        name: "Novo Plano",
        price_label: "R$ 0",
        period_label: null,
        description: "",
        features: ["Recurso 1", "Recurso 2"],
        cta_label: "Falar com consultor",
        cta_url: "https://wa.me/5531975225821",
        highlighted: false,
        sort_order: nextOrder,
        active: true,
      } as any)
      .select()
      .single();
    if (error) { alert(error.message); return; }
    setList((arr) => [...arr, data as any as Plan]);
  };

  const update = (id: string, patch: Partial<Plan>) => {
    setList((arr) => arr.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const save = async (plan: Plan) => {
    setSavingId(plan.id);
    const { error } = await supabase
      .from("landing_plans" as any)
      .update({
        name: plan.name,
        price_label: plan.price_label,
        period_label: plan.period_label,
        description: plan.description,
        features: plan.features,
        cta_label: plan.cta_label,
        cta_url: plan.cta_url,
        highlighted: plan.highlighted,
        sort_order: plan.sort_order,
        active: plan.active,
      } as any)
      .eq("id", plan.id);
    setSavingId(null);
    if (error) alert(error.message);
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este plano?")) return;
    const { error } = await supabase.from("landing_plans" as any).delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setList((arr) => arr.filter((p) => p.id !== id));
  };

  const move = async (id: string, dir: -1 | 1) => {
    const sorted = [...list].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((p) => p.id === id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    const a = sorted[idx];
    const aOrder = a.sort_order;
    a.sort_order = swap.sort_order;
    swap.sort_order = aOrder;
    setList(sorted);
    await Promise.all([
      supabase.from("landing_plans" as any).update({ sort_order: a.sort_order } as any).eq("id", a.id),
      supabase.from("landing_plans" as any).update({ sort_order: swap.sort_order } as any).eq("id", swap.id),
    ]);
  };

  return (
    <PageShell
      title="Landing — Planos"
      subtitle="Edite os cards de preço exibidos na página inicial pública."
      actions={
        <button onClick={addPlan} className="inline-flex items-center gap-2 rounded-lg bg-gold-metal px-4 py-2 text-sm font-semibold">
          <Plus className="h-4 w-4" /> Novo plano
        </button>
      }
    >
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : list.length === 0 ? (
        <div className="card-premium p-10 text-center text-sm text-muted-foreground">
          Nenhum plano cadastrado. Clique em "Novo plano" para começar.
        </div>
      ) : (
        <div className="grid gap-5">
          {list.sort((a, b) => a.sort_order - b.sort_order).map((p, i) => (
            <div key={p.id} className="card-premium p-6">
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex lg:flex-col items-center gap-2 lg:gap-1 lg:pt-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <button disabled={i === 0} onClick={() => move(p.id, -1)} className="text-xs px-2 py-0.5 rounded border border-border hover:bg-secondary disabled:opacity-30">↑</button>
                  <button disabled={i === list.length - 1} onClick={() => move(p.id, 1)} className="text-xs px-2 py-0.5 rounded border border-border hover:bg-secondary disabled:opacity-30">↓</button>
                </div>

                <div className="flex-1 grid gap-4 md:grid-cols-2">
                  <Field label="Nome do plano">
                    <input value={p.name} onChange={(e) => update(p.id, { name: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Preço (texto livre, ex: R$ 497)">
                    <input value={p.price_label} onChange={(e) => update(p.id, { price_label: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Período (ex: /mês — opcional)">
                    <input value={p.period_label ?? ""} onChange={(e) => update(p.id, { period_label: e.target.value || null })} className={inputCls} />
                  </Field>
                  <Field label="Texto do botão (CTA)">
                    <input value={p.cta_label} onChange={(e) => update(p.id, { cta_label: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Link do CTA (WhatsApp / URL)" full>
                    <input value={p.cta_url} onChange={(e) => update(p.id, { cta_url: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Descrição curta" full>
                    <input value={p.description ?? ""} onChange={(e) => update(p.id, { description: e.target.value })} className={inputCls} />
                  </Field>

                  <Field label="Recursos / Features (um por linha)" full>
                    <textarea
                      rows={5}
                      value={p.features.join("\n")}
                      onChange={(e) => update(p.id, { features: e.target.value.split("\n").map((s) => s.trimEnd()).filter(Boolean) })}
                      className={inputCls + " font-mono text-xs"}
                    />
                  </Field>

                  <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-2 border-t border-border">
                    <button
                      onClick={() => update(p.id, { highlighted: !p.highlighted })}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${p.highlighted ? "bg-gold-metal" : "border border-border bg-secondary/40"}`}
                    >
                      <Star className="h-3.5 w-3.5" /> {p.highlighted ? "Destaque ativo" : "Marcar como destaque"}
                    </button>
                    <button
                      onClick={() => update(p.id, { active: !p.active })}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border ${p.active ? "border-[oklch(0.6_0.13_75_/_0.5)] text-[oklch(0.85_0.14_75)]" : "border-border text-muted-foreground"}`}
                    >
                      {p.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {p.active ? "Ativo (visível)" : "Inativo (oculto)"}
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => remove(p.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 text-destructive px-3 py-2 text-xs font-medium hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </button>
                    <button
                      onClick={() => save(p)}
                      disabled={savingId === p.id}
                      className="inline-flex items-center gap-2 rounded-lg bg-gold-metal px-4 py-2 text-xs font-semibold disabled:opacity-60"
                    >
                      {savingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}

const inputCls = "w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
