import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Lock, ShieldCheck, UploadCloud, X } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { useAuth } from "@/hooks/use-auth";
import { classifyPhones, downloadCsv, readLeadFile, type LeadHygieneResult } from "@/lib/lead-hygiene";

export const Route = createFileRoute("/_authenticated/higienizacao")({
  head: () => ({ meta: [{ title: "Higienização — HS Assessoria" }] }),
  component: HigienizacaoPage,
});

function HigienizacaoPage() {
  const { hasPermission, loading } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stats, setStats] = useState<LeadHygieneResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const allowed = hasPermission("use_hygiene_tool");


  const statusLabel = useMemo(() => {
    if (!stats) return "Aguardando arquivo";
    if (stats.valid.length === 0) return "Nenhum número válido encontrado";
    return "Lista higienizada e pronta para exportar";
  }, [stats]);

  const handleFile = async (nextFile: File | null) => {
    setFile(nextFile);
    setStats(null);
    if (!nextFile) return;
    setProcessing(true);
    try {
      const text = await readLeadFile(nextFile);
      setStats(classifyPhones(text));
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <PageShell title="Higienização" subtitle="Valide listas sem criar uma campanha.">
        <div className="card-premium p-8 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto h-5 w-5 animate-spin mb-2" /> Carregando permissões...
        </div>
      </PageShell>
    );
  }

  if (!allowed) {
    return (
      <PageShell title="Higienização" subtitle="Valide listas sem criar uma campanha.">
        <div className="card-premium p-8 text-center">
          <Lock className="mx-auto h-8 w-8 text-[oklch(0.84_0.14_80)] mb-3" />
          <h3 className="font-display text-xl">Acesso restrito</h3>
          <p className="mt-2 text-sm text-muted-foreground">Peça ao administrador para liberar esta ferramenta no seu cadastro.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Higienização" subtitle="Valide, remova duplicados e exporte listas sem abrir pedido de campanha.">
      <section className="card-premium p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Lista avulsa</p>
            <h3 className="mt-2 font-display text-xl">Higienizar contatos</h3>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-[oklch(0.84_0.14_80)]" /> {statusLabel}
          </span>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt,.xlsx,.xls"
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
        />

        {!file ? (
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-border bg-input/40 py-14 flex flex-col items-center gap-2 hover:border-[oklch(0.75_0.13_75)] transition-colors"
          >
            <UploadCloud className="h-8 w-8 text-[oklch(0.84_0.14_80)]" />
            <p className="text-sm font-medium">Clique para enviar a lista</p>
            <p className="text-xs text-muted-foreground">CSV, TXT, XLS ou XLSX com números por linha ou por coluna</p>
          </button>
        ) : (
          <div className="rounded-xl border border-border bg-secondary/25 p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-lg bg-bronze-metal flex items-center justify-center shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            {processing ? (
              <Loader2 className="h-5 w-5 animate-spin text-[oklch(0.84_0.14_80)]" />
            ) : (
              <button onClick={() => handleFile(null)} className="p-2 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <Stat label="Total lido" value={stats.total} />
              <Stat label="Válidos" value={stats.valid.length} tone="gold" />
              <Stat label="Inválidos" value={stats.invalid.length} tone="warn" />
              <Stat label="Duplicados" value={stats.duplicates} />
            </div>

            <div className="rounded-xl border border-[oklch(0.7_0.12_75_/_0.45)] bg-[oklch(0.34_0.06_70_/_0.2)] p-4 flex items-center gap-4">
              <Lock className="h-5 w-5 text-[oklch(0.84_0.14_80)]" />
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Quantidade final higienizada</p>
                <p className="text-2xl font-bold text-[oklch(0.86_0.14_80)]">{stats.valid.length.toLocaleString("pt-BR")}</p>
              </div>
              <p className="hidden sm:block text-[11px] text-muted-foreground">duplicados e inválidos removidos</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                disabled={stats.valid.length === 0}
                onClick={() => downloadCsv("leads-validos.csv", ["numero", ...stats.valid])}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gold-metal px-4 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" /> Exportar válidos
              </button>
              <button
                disabled={stats.invalid.length === 0}
                onClick={() => downloadCsv("leads-invalidos.csv", ["numero", ...stats.invalid])}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-4 py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" /> Exportar inválidos
              </button>
            </div>
          </>
        )}
      </section>
    </PageShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "gold" | "warn" }) {
  const cls = tone === "gold" ? "text-[oklch(0.86_0.14_80)]" : tone === "warn" ? "text-[oklch(0.78_0.18_55)]" : "text-foreground";
  return (
    <div className="rounded-lg bg-input p-4">
      <p className={`text-2xl font-bold ${cls}`}>{value.toLocaleString("pt-BR")}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}