import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, ChevronLeft, ChevronRight, Inbox, Loader2, Trash2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({
    meta: [
      { title: "Histórico e Relatórios — HS Assessoria" },
      { name: "description", content: "Histórico completo de campanhas com filtros e relatórios." },
    ],
  }),
  component: Historico,
});

type Row = {
  id: string;
  name: string;
  created_at: string;
  send_count: number;
  debit_cents: number | null;
  refund_cents: number | null;
  status: string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendado",
  processing: "Processando",
  completed: "Concluído",
  cancelled: "Cancelado",
  failed: "Falhou",
};

const statusStyle: Record<string, string> = {
  completed: "bg-[oklch(0.4_0.12_75_/_0.2)] text-[oklch(0.86_0.14_80)] border-[oklch(0.58_0.12_75_/_0.45)]",
  processing: "bg-[oklch(0.4_0.15_70_/_0.25)] text-[oklch(0.85_0.14_75)] border-[oklch(0.55_0.12_70_/_0.5)]",
  scheduled: "bg-[oklch(0.3_0.08_240_/_0.3)] text-[oklch(0.8_0.1_240)] border-[oklch(0.5_0.1_240_/_0.4)]",
  failed: "bg-[oklch(0.4_0.2_25_/_0.2)] text-[oklch(0.78_0.18_25)] border-[oklch(0.55_0.18_25_/_0.4)]",
  cancelled: "bg-destructive/20 text-destructive border-destructive/40",
  draft: "bg-muted/40 text-muted-foreground border-border",
};

const PAGE_SIZE = 10;

function Historico() {
  const { user, hasPermission } = useAuth();
  const seesAll = hasPermission("view_all_campaigns");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("Todos");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("campaigns")
        .select("id, name, created_at, send_count, debit_cents, refund_cents, status")
        .order("created_at", { ascending: false });
      if (!seesAll) q = q.eq("user_id", user.id);
      const { data } = await q;
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
  }, [user, seesAll]);

  const filtered = useMemo(() => {
    return rows.filter((r) =>
      (status === "Todos" || r.status === status) &&
      (r.name.toLowerCase().includes(query.toLowerCase()) || r.id.toLowerCase().includes(query.toLowerCase()))
    );
  }, [rows, query, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <PageShell title="Histórico & Relatórios" subtitle={seesAll ? "Histórico de todas as campanhas." : "Acompanhe a performance das suas campanhas."}>
      <section className="card-premium p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
          <div className="flex-1 flex items-center gap-3 rounded-lg bg-input border border-border px-4 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Buscar por nome ou ID..."
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
          </div>
          <select
            value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-lg bg-input border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {["Todos", "draft", "scheduled", "processing", "completed", "cancelled", "failed"].map((s) => (
              <option key={s} value={s} className="bg-card">{s === "Todos" ? "Todos" : STATUS_LABEL[s] ?? s}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-3 pr-4">ID</th>
                <th className="py-3 pr-4">Campanha</th>
                <th className="py-3 pr-4">Data</th>
                <th className="py-3 pr-4">Envios</th>
                <th className="py-3 pr-4">Custo</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></td></tr>
              ) : pageData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <Inbox className="mx-auto h-10 w-10 text-muted-foreground/40" />
                    <p className="mt-3 text-sm text-muted-foreground">Nenhuma campanha encontrada.</p>
                  </td>
                </tr>
              ) : pageData.map((r) => (
                <tr key={r.id} className="border-b border-border/40 hover:bg-secondary/40 transition-colors">
                  <td className="py-4 pr-4 font-mono text-xs text-[oklch(0.78_0.13_75)]">{r.id.slice(0, 8)}</td>
                  <td className="py-4 pr-4 font-medium">{r.name}</td>
                  <td className="py-4 pr-4 text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                  <td className="py-4 pr-4">{(r.send_count ?? 0).toLocaleString("pt-BR")}</td>
                  <td className="py-4 pr-4">{(((r.debit_cents ?? 0) - (r.refund_cents ?? 0)) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                  <td className="py-4 pr-4">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs border ${statusStyle[r.status] ?? statusStyle.draft}`}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="py-4">
                    {(r.status === "draft" || r.status === "scheduled") && (
                      <button
                        onClick={async () => {
                          if (!confirm(`Excluir campanha "${r.name}"? Esta ação não pode ser desfeita.`)) return;
                          const { error } = await supabase.from("campaigns").delete().eq("id", r.id);
                          if (error) { toast.error(error.message); return; }
                          setRows((prev) => prev.filter((x) => x.id !== r.id));
                          toast.success("Campanha excluída");
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/15"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-6">
          <p className="text-xs text-muted-foreground">
            Mostrando {pageData.length} de {filtered.length} resultados
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-2 rounded-md border border-border disabled:opacity-30 hover:bg-secondary"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm">{page} / {pages}</span>
            <button
              disabled={page === pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="p-2 rounded-md border border-border disabled:opacity-30 hover:bg-secondary"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
