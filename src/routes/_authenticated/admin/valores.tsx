import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Save, Plus, Trash2, Gem, Ticket, TrendingUp, ShieldCheck, Landmark, User as UserIcon } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/valores")({
  head: () => ({ meta: [{ title: "Valores — Admin HS Assessoria" }] }),
  component: ValoresAdmin,
});

const ICONS: Record<string, any> = { gem: Gem, ticket: Ticket, "trending-up": TrendingUp, "shield-check": ShieldCheck, landmark: Landmark, user: UserIcon };

interface Niche { id: string; slug: string; name: string; price_cents: number; icon: string | null; is_active: boolean; sort_order: number }

function ValoresAdmin() {
  const [niches, setNiches] = useState<Niche[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("niches").select("*").order("sort_order");
    setNiches((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const updatePrice = (id: string, cents: number) => {
    setNiches((arr) => arr.map((n) => n.id === id ? { ...n, price_cents: cents } : n));
  };

  const save = async (n: Niche) => {
    setSavingId(n.id);
    await supabase.from("niches").update({ price_cents: n.price_cents, name: n.name, is_active: n.is_active }).eq("id", n.id);
    setSavingId(null);
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este nicho?")) return;
    await supabase.from("niches").delete().eq("id", id);
    load();
  };

  const addNiche = async () => {
    const name = prompt("Nome do novo nicho:");
    if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await supabase.from("niches").insert({ name, slug, price_cents: 20, sort_order: niches.length + 1, icon: "gem" });
    load();
  };

  return (
    <PageShell title="Valores por Nicho" subtitle="Defina o preço por mensagem em cada nicho (em centavos de R$).">
      <div className="flex justify-end mb-4">
        <button onClick={addNiche} className="inline-flex items-center gap-2 rounded-lg bg-gold-metal px-4 py-2 text-sm font-semibold hover:scale-[1.02] transition-transform">
          <Plus className="h-4 w-4" /> Novo nicho
        </button>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-[oklch(0.75_0.13_75)]" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {niches.map((n) => {
            const Icon = ICONS[n.icon ?? "gem"] ?? Gem;
            return (
              <div key={n.id} className="card-premium p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg bg-[oklch(0.78_0.13_75_/_0.12)] flex items-center justify-center">
                    <Icon className="h-5 w-5 text-[oklch(0.85_0.14_75)]" />
                  </div>
                  <button onClick={() => remove(n.id)} className="p-1.5 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <input
                  value={n.name}
                  onChange={(e) => setNiches((arr) => arr.map((x) => x.id === n.id ? { ...x, name: e.target.value } : x))}
                  className="w-full bg-transparent text-lg font-semibold focus:outline-none focus:border-b focus:border-[oklch(0.55_0.1_60)] mb-2"
                />
                <label className="block">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Preço por mensagem</span>
                  <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-input border border-border px-3 py-2">
                    <span className="text-xs text-muted-foreground">R$</span>
                    <input
                      type="number" step="0.01" min={0}
                      value={(n.price_cents / 100).toFixed(2)}
                      onChange={(e) => updatePrice(n.id, Math.round(Number(e.target.value) * 100))}
                      className="flex-1 bg-transparent font-display text-2xl text-gold-gradient focus:outline-none"
                    />
                  </div>
                </label>
                <button
                  onClick={() => save(n)} disabled={savingId === n.id}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-md bg-gold-metal px-3 py-2 text-xs font-semibold disabled:opacity-60"
                >
                  {savingId === n.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-center text-muted-foreground">
        Valores por mensagem em reais. Você pode definir preços especiais por cliente em <strong>Usuários</strong>.
      </p>
    </PageShell>
  );
}
