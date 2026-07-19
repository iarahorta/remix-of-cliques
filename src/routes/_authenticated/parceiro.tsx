import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { getMyPartnerOverview, listMyPartnerCommissions } from "@/lib/partner-portal.functions";

export const Route = createFileRoute("/_authenticated/parceiro")({
  head: () => ({ meta: [{ title: "Portal do Parceiro — zpclik" }] }),
  component: PartnerPortalPage,
});

function fmtBRL(cents: number) {
  return (Number(cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente", approved: "Aprovada", paid: "Paga",
  canceled: "Cancelada", reversed: "Estornada",
};
const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  approved: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  canceled: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  reversed: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

function Card({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-[oklch(0.32_0.04_80/_0.25)] bg-card p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

function csvEscape(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function PartnerPortalPage() {
  const runOverview = useServerFn(getMyPartnerOverview);
  const runCommissions = useServerFn(listMyPartnerCommissions);
  const [overview, setOverview] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const [o, c] = await Promise.all([
        runOverview({}),
        runCommissions({ data: { status: status || undefined } }),
      ]);
      setOverview(o);
      setRows(c.commissions ?? []);
    } finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, [status]);

  const filtered = useMemo(() => rows, [rows]);

  const exportCsv = () => {
    const header = ["Data","Assinante","Email","Bruto (R$)","Taxa gateway (R$)","Líquido (R$)","%","Comissão (R$)","Status","Pago em","Referência"];
    const lines = [header.join(";")];
    for (const r of filtered) {
      const sub = (r as any).link_subscribers ?? {};
      lines.push([
        fmtDate(r.created_at),
        csvEscape(sub.name ?? ""),
        csvEscape(sub.email ?? ""),
        (Number(r.gross_cents ?? 0)/100).toFixed(2).replace(".", ","),
        (Number(r.gateway_fee_cents ?? 0)/100).toFixed(2).replace(".", ","),
        (Number(r.net_cents ?? 0)/100).toFixed(2).replace(".", ","),
        (Number(r.commission_bps ?? 0)/100).toFixed(2).replace(".", ","),
        (Number(r.commission_cents ?? 0)/100).toFixed(2).replace(".", ","),
        STATUS_LABEL[r.status] ?? r.status,
        fmtDate(r.paid_at),
        csvEscape(r.paid_ref ?? ""),
      ].join(";"));
    }
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `comissoes-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const p = overview?.partner;
  const referralLink = p?.public_token ? `https://www.zpclik.site/?ref=${p.public_token}` : null;

  if (loading && !overview) {
    return <main className="flex-1 p-6"><p className="text-muted-foreground">Carregando…</p></main>;
  }

  if (!p) {
    return (
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-3xl">
        <h1 className="text-2xl font-semibold text-foreground">Portal do Parceiro</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Sua conta ainda não está vinculada a um parceiro. Fale com o administrador do zpclik para associar seu e-mail ao cadastro de parceiro.
        </p>
      </main>
    );
  }

  const t = overview.totals;

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full">
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#f0c95a]">Portal do Parceiro</p>
          <h1 className="text-2xl font-semibold text-foreground">{p.name}</h1>
          <p className="text-sm text-muted-foreground">
            Comissão padrão: {(Number(p.default_commission_bps ?? 0)/100).toFixed(2)}%
          </p>
        </div>
        {referralLink && (
          <div className="rounded-lg border border-[oklch(0.32_0.04_80/_0.25)] bg-card px-3 py-2 text-xs">
            <p className="text-muted-foreground mb-1">Seu link de indicação</p>
            <div className="flex items-center gap-2">
              <code className="text-foreground break-all">{referralLink}</code>
              <button
                onClick={() => navigator.clipboard.writeText(referralLink)}
                className="shrink-0 px-2 py-1 rounded bg-gold-metal text-[#1a1408] font-semibold"
              >Copiar</button>
            </div>
          </div>
        )}
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card label="Assinantes ativos" value={String(overview.subscribers_active)} />
        <Card label="Total de clientes" value={String(overview.subscribers.length)} />
        <Card label="Cliques atribuídos" value={String(overview.referrals_total)} />
        <Card label="Conversões" value={String(overview.referrals_converted)} />
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card label="Receita bruta" value={fmtBRL(t.gross)} />
        <Card label="Receita líquida" value={fmtBRL(t.net)} />
        <Card label="Comissões pendentes" value={fmtBRL(t.pending + t.approved)} tone="text-amber-300" />
        <Card label="Comissões pagas" value={fmtBRL(t.paid)} tone="text-emerald-300" />
      </section>

      <div className="mb-3 flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 items-center">
          <label className="text-xs text-muted-foreground">Status:</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-[oklch(0.2_0.012_60)] border border-[oklch(0.32_0.04_80/_0.25)] rounded px-2 py-1 text-sm text-foreground"
          >
            <option value="">Todos</option>
            <option value="pending">Pendente</option>
            <option value="approved">Aprovada</option>
            <option value="paid">Paga</option>
            <option value="canceled">Cancelada</option>
            <option value="reversed">Estornada</option>
          </select>
        </div>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="px-3 py-1.5 rounded bg-gold-metal text-[#1a1408] font-semibold text-sm disabled:opacity-50"
        >
          Exportar CSV
        </button>
      </div>

      <div className="rounded-xl border border-[oklch(0.32_0.04_80/_0.25)] overflow-x-auto bg-card">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-[oklch(0.2_0.012_60)] text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Data</th>
              <th className="text-left px-3 py-2 font-medium">Assinante</th>
              <th className="text-right px-3 py-2 font-medium">Bruto</th>
              <th className="text-right px-3 py-2 font-medium">Líquido</th>
              <th className="text-right px-3 py-2 font-medium">%</th>
              <th className="text-right px-3 py-2 font-medium">Comissão</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium">Pago em</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma comissão encontrada.</td></tr>
            )}
            {filtered.map((r: any) => {
              const sub = r.link_subscribers ?? {};
              return (
                <tr key={r.id} className="border-t border-[oklch(0.32_0.04_80/_0.15)]">
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  <td className="px-3 py-2 text-foreground">
                    <div>{sub.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{sub.email ?? ""}</div>
                  </td>
                  <td className="px-3 py-2 text-right text-foreground">{fmtBRL(r.gross_cents)}</td>
                  <td className="px-3 py-2 text-right text-foreground">{fmtBRL(r.net_cents)}</td>
                  <td className="px-3 py-2 text-right text-foreground">{(Number(r.commission_bps ?? 0)/100).toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right font-semibold text-foreground">{fmtBRL(r.commission_cents)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${STATUS_STYLE[r.status] ?? ""}`}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{fmtDate(r.paid_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
