import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import {
  listSubscribersAdmin,
  markSubscriberPaidAdmin,
  suspendSubscriberAdmin,
} from "@/lib/link-subscribers.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/assinantes")({
  head: () => ({ meta: [{ title: "Assinantes — cliques" }] }),
  component: Assinantes,
});

interface Subscriber {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  current_period_end: string | null;
  last_payment_at: string | null;
  plan_price_cents: number;
  payment_method: string | null;
  created_at: string;
}

function statusBadge(status: string, end: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  const expired = status === "active" && end && end < today;
  if (expired) {
    return <span className="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-800">Vencido</span>;
  }
  const map: Record<string, { label: string; cls: string }> = {
    pending_payment: { label: "Pendente pagamento", cls: "bg-yellow-100 text-yellow-800" },
    active: { label: "Ativo", cls: "bg-emerald-100 text-emerald-800" },
    suspended: { label: "Suspenso", cls: "bg-red-100 text-red-800" },
  };
  const m = map[status] ?? { label: status, cls: "bg-slate-100 text-slate-700" };
  return <span className={`px-2 py-0.5 text-xs rounded ${m.cls}`}>{m.label}</span>;
}

function Assinantes() {
  const [rows, setRows] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const listFn = useServerFn(listSubscribersAdmin);
  const markPaid = useServerFn(markSubscriberPaidAdmin);
  const suspend = useServerFn(suspendSubscriberAdmin);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const r: any = await listFn({});
      setRows(r.subscribers ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleMarkPaid = async (id: string) => {
    setBusy(id);
    try {
      await markPaid({ data: { subscriberId: id } });
      toast.success("Assinante marcado como pago (+30 dias)");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou");
    } finally { setBusy(null); }
  };

  const handleSuspend = async (id: string) => {
    setBusy(id);
    try {
      await suspend({ data: { subscriberId: id } });
      toast.success("Assinante suspenso");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou");
    } finally { setBusy(null); }
  };

  return (
    <PageShell title="Assinantes" icon={<Users className="h-5 w-5" />}>
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">{err}</div>
      )}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-slate-500">Nenhum assinante cadastrado ainda.</div>
      ) : (
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Nome</th>
                <th className="text-left px-4 py-3">E-mail</th>
                <th className="text-left px-4 py-3">Telefone</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Válido até</th>
                <th className="text-left px-4 py-3">Último pagamento</th>
                <th className="text-right px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">{r.name ?? "—"}</td>
                  <td className="px-4 py-3">{r.email ?? "—"}</td>
                  <td className="px-4 py-3">{r.phone ?? "—"}</td>
                  <td className="px-4 py-3">{statusBadge(r.status, r.current_period_end)}</td>
                  <td className="px-4 py-3">{r.current_period_end ?? "—"}</td>
                  <td className="px-4 py-3">{r.last_payment_at ? new Date(r.last_payment_at).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        disabled={busy === r.id}
                        onClick={() => handleMarkPaid(r.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2.5 py-1.5 disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Marcar pago
                      </button>
                      <button
                        disabled={busy === r.id}
                        onClick={() => handleSuspend(r.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs px-2.5 py-1.5 disabled:opacity-60"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Suspender
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
