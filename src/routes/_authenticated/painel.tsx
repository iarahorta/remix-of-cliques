import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Send, Wallet, Sparkles, ArrowUpRight, Clock, CheckCircle2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({ meta: [{ title: "Dashboard — HS Assessoria" }] }),
  component: Dashboard,
});

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Dashboard() {
  const [balance, setBalance] = useState<number | null>(null);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: b } = await supabase.from("credit_balances").select("balance_cents").eq("user_id", u.user.id).maybeSingle();
      setBalance(b?.balance_cents ?? 0);
      const { data: c } = await supabase.from("campaigns").select("id,name,status,send_count,created_at").order("created_at", { ascending: false }).limit(5);
      setRecent(c ?? []);
    })();
  }, []);

  return (
    <PageShell title="Dashboard" subtitle="Visão geral da sua conta e atividades recentes.">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card-premium p-6 lg:col-span-2 bg-gradient-to-br from-[oklch(0.18_0.02_60)] to-[oklch(0.13_0.02_50)] relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[oklch(0.7_0.13_70_/_0.12)] blur-3xl" />
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Saldo disponível</p>
          <p className="mt-3 font-display text-5xl text-gold-gradient font-semibold">
            {balance === null ? "—" : formatBRL(balance)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Créditos em reais para usar conforme o nicho.</p>
          <div className="mt-6 flex gap-3">
            <Link to="/recarga" className="inline-flex items-center gap-2 rounded-lg bg-gold-metal px-5 py-2.5 text-sm font-semibold hover:scale-[1.02] transition-transform">
              <Wallet className="h-4 w-4" /> Recarregar
            </Link>
            <Link to="/nova-campanha" className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-5 py-2.5 text-sm font-medium hover:bg-secondary">
              <Send className="h-4 w-4" /> Nova campanha
            </Link>
          </div>
        </div>

        <div className="card-premium p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Atalho</p>
          <h3 className="mt-2 font-display text-xl">Comece em segundos</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-start gap-2"><Sparkles className="h-4 w-4 mt-0.5 text-[oklch(0.75_0.13_75)]" /> Use templates fixos pré-aprovados.</li>
            <li className="flex items-start gap-2"><Sparkles className="h-4 w-4 mt-0.5 text-[oklch(0.75_0.13_75)]" /> Encurte e rotacione seus links.</li>
            <li className="flex items-start gap-2"><Sparkles className="h-4 w-4 mt-0.5 text-[oklch(0.75_0.13_75)]" /> Receba relatórios com estorno automático.</li>
          </ul>
        </div>
      </div>

      <section className="card-premium p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl">Campanhas recentes</h3>
          <Link to="/historico" className="text-xs text-[oklch(0.75_0.13_75)] inline-flex items-center gap-1 hover:underline">
            Ver tudo <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma campanha ainda. Crie sua primeira!</p>
        ) : (
          <div className="divide-y divide-border">
            {recent.map((c) => (
              <div key={c.id} className="py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{c.send_count} envios</span>
                  <StatusBadge status={c.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    draft: { label: "Rascunho", cls: "bg-muted text-muted-foreground", icon: Clock },
    scheduled: { label: "Agendado", cls: "bg-[oklch(0.4_0.1_70_/_0.3)] text-[oklch(0.85_0.14_75)]", icon: Clock },
    processing: { label: "Processando", cls: "bg-[oklch(0.4_0.15_60_/_0.3)] text-[oklch(0.85_0.14_75)]", icon: Clock },
    completed: { label: "Concluído", cls: "bg-[oklch(0.4_0.12_75_/_0.25)] text-[oklch(0.86_0.14_80)]", icon: CheckCircle2 },
    cancelled: { label: "Cancelado", cls: "bg-destructive/20 text-destructive", icon: Clock },
  };
  const m = map[status] ?? map.draft;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${m.cls}`}>
      <Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}
