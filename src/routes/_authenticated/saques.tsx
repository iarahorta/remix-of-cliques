import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listPayoutsAdmin, updatePayoutStatus } from "@/lib/partners.functions";

export const Route = createFileRoute("/_authenticated/saques")({
  head: () => ({ meta: [{ title: "Saques — zpclik" }] }),
  component: SaquesPage,
});

function fmtBRL(cents: number) {
  return (Number(cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

const STATUS_LABEL: Record<string, string> = { requested: "Solicitado", pending: "Solicitado", paid: "Pago", canceled: "Cancelado" };
const STATUS_STYLE: Record<string, string> = {
  requested: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  canceled: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

export default function SaquesPage() {
  const runList = useServerFn(listPayoutsAdmin);
  const runUpdate = useServerFn(updatePayoutStatus);
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await runList({ data: { status: status || undefined } });
      setRows(r.payouts ?? []);
    } finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, [status]);

  const markPaid = async (id: string) => {
    const paid_ref = prompt("Referência do pagamento (E2E PIX):") || undefined;
    if (paid_ref === undefined) return;
    await runUpdate({ data: { id, status: "paid", paid_ref } });
    reload();
  };
  const cancel = async (id: string) => {
    if (!confirm("Cancelar este saque? As comissões voltarão a ficar disponíveis.")) return;
    const notes = prompt("Motivo (opcional):") ?? undefined;
    await runUpdate({ data: { id, status: "canceled", notes } });
    reload();
  };

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Saques de Parceiros</h1>
        <p className="text-sm text-muted-foreground">Solicitações de saque. Ao marcar como pago, as comissões vinculadas viram "Paga".</p>
      </header>

      <div className="mb-3 flex gap-2 items-center">
        <label className="text-xs text-muted-foreground">Status:</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-[oklch(0.2_0.012_60)] border border-[oklch(0.32_0.04_80/_0.25)] rounded px-2 py-1 text-sm text-foreground">
          <option value="">Todos</option>
          <option value="requested">Solicitado</option>
          <option value="paid">Pago</option>
          <option value="canceled">Cancelado</option>
        </select>
      </div>

      <div className="rounded-xl border border-[oklch(0.32_0.04_80/_0.25)] overflow-x-auto bg-card">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-[oklch(0.2_0.012_60)] text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Solicitado</th>
              <th className="text-left px-3 py-2 font-medium">Parceiro</th>
              <th className="text-left px-3 py-2 font-medium">PIX</th>
              <th className="text-right px-3 py-2 font-medium">Valor</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium">Pago em</th>
              <th className="text-left px-3 py-2 font-medium">Referência</th>
              <th className="text-right px-3 py-2 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Carregando…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum saque encontrado.</td></tr>
            )}
            {rows.map((r: any) => {
              const isOpen = r.status === "requested" || r.status === "pending";
              const p = r.partners ?? {};
              return (
                <tr key={r.id} className="border-t border-[oklch(0.32_0.04_80/_0.15)]">
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  <td className="px-3 py-2 text-foreground">
                    <div>{p.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{p.email ?? ""}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-foreground">
                    <div>{p.pix_key_type ?? "—"}</div>
                    <div className="text-muted-foreground break-all">{p.pix_key ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-foreground">{fmtBRL(r.total_cents)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${STATUS_STYLE[r.status] ?? ""}`}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{fmtDate(r.paid_at)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.paid_ref ?? "—"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {isOpen ? (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => markPaid(r.id)} className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs">Marcar pago</button>
                        <button onClick={() => cancel(r.id)} className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs">Cancelar</button>
                      </div>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
