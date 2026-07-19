import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AppSidebar, MobileTopBar } from "@/components/app-sidebar";
import { listCommissions, updateCommissionStatus } from "@/lib/partners.functions";

export const Route = createFileRoute("/_authenticated/comissoes")({
  head: () => ({ meta: [{ title: "Comissões — zpclik" }] }),
  component: ComissoesPage,
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

export default function ComissoesPage() {
  const runList = useServerFn(listCommissions);
  const runUpdate = useServerFn(updateCommissionStatus);
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await runList({ data: { status: status || undefined } });
      setRows(r.commissions ?? []);
    } finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, [status]);

  const totals = useMemo(() => {
    const t = { gross: 0, net: 0, commission: 0, paid: 0 };
    for (const r of rows) {
      t.gross += Number(r.gross_cents ?? 0);
      t.net += Number(r.net_cents ?? 0);
      t.commission += Number(r.commission_cents ?? 0);
      if (r.status === "paid") t.paid += Number(r.commission_cents ?? 0);
    }
    return t;
  }, [rows]);

  const changeStatus = async (id: string, next: "approved" | "paid" | "canceled" | "reversed") => {
    let paid_ref: string | undefined;
    if (next === "paid") paid_ref = prompt("Referência do pagamento (ex: E2E PIX):") || undefined;
    await runUpdate({ data: { id, status: next, paid_ref } });
    reload();
  };

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileTopBar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl">
          <header className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground">Comissões</h1>
            <p className="text-sm text-muted-foreground">Histórico de comissões geradas por pagamento confirmado.</p>
          </header>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Card label="Bruto" value={fmtBRL(totals.gross)} />
            <Card label="Líquido" value={fmtBRL(totals.net)} />
            <Card label="Comissão total" value={fmtBRL(totals.commission)} />
            <Card label="Comissão paga" value={fmtBRL(totals.paid)} />
          </div>

          <div className="mb-3 flex gap-2 items-center">
            <label className="text-xs text-muted-foreground">Status:</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-[oklch(0.2_0.012_60)] border border-[oklch(0.32_0.04_80/_0.25)] rounded px-2 py-1 text-sm text-foreground">
              <option value="">Todos</option>
              <option value="pending">Pendente</option>
              <option value="approved">Aprovada</option>
              <option value="paid">Paga</option>
              <option value="canceled">Cancelada</option>
              <option value="reversed">Estornada</option>
            </select>
          </div>

          <div className="rounded-xl border border-[oklch(0.32_0.04_80/_0.25)] overflow-x-auto bg-card">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-[oklch(0.2_0.012_60)] text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Data</th>
                  <th className="text-left px-3 py-2 font-medium">Parceiro</th>
                  <th className="text-left px-3 py-2 font-medium">Assinante</th>
                  <th className="text-right px-3 py-2 font-medium">Bruto</th>
                  <th className="text-right px-3 py-2 font-medium">Líquido</th>
                  <th className="text-right px-3 py-2 font-medium">%</th>
                  <th className="text-right px-3 py-2 font-medium">Comissão</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>}
                {!loading && rows.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Sem comissões ainda.</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[oklch(0.32_0.04_80/_0.15)]">
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                    <td className="px-3 py-2">{r.partners?.name ?? "—"}<div className="text-[10px] text-muted-foreground font-mono">{r.partners?.public_token}</div></td>
                    <td className="px-3 py-2">{r.link_subscribers?.name ?? r.link_subscribers?.email ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{fmtBRL(r.gross_cents)}</td>
                    <td className="px-3 py-2 text-right">{fmtBRL(r.net_cents)}</td>
                    <td className="px-3 py-2 text-right">{(r.commission_bps / 100).toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right font-semibold text-[#f0c95a]">{fmtBRL(r.commission_cents)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                        r.status === "paid" ? "bg-emerald-500/15 text-emerald-400" :
                        r.status === "approved" ? "bg-blue-500/15 text-blue-400" :
                        r.status === "canceled" || r.status === "reversed" ? "bg-red-500/15 text-red-400" :
                        "bg-yellow-500/15 text-yellow-400"
                      }`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-xs">
                      {r.status === "pending" && <button onClick={() => changeStatus(r.id, "approved")} className="text-blue-400 hover:underline mr-2">Aprovar</button>}
                      {(r.status === "pending" || r.status === "approved") && <button onClick={() => changeStatus(r.id, "paid")} className="text-emerald-400 hover:underline mr-2">Pagar</button>}
                      {r.status !== "canceled" && r.status !== "reversed" && r.status !== "paid" && <button onClick={() => changeStatus(r.id, "canceled")} className="text-red-400 hover:underline">Cancelar</button>}
                      {r.status === "paid" && <button onClick={() => changeStatus(r.id, "reversed")} className="text-red-400 hover:underline">Estornar</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[oklch(0.32_0.04_80/_0.25)] bg-card p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-lg text-foreground font-semibold">{value}</p>
    </div>
  );
}