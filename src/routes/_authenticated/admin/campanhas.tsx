import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Download, UploadCloud, UserCircle2, FileSpreadsheet, ImageIcon, FileText, Lock as LockIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/campanhas")({
  head: () => ({ meta: [{ title: "Todas as Campanhas — Admin HS Assessoria" }] }),
  component: TodasCampanhasPage,
});

type Row = {
  id: string;
  name: string | null;
  link: string | null;
  send_count: number | null;
  status: string | null;
  debit_cents: number | null;
  created_at: string;
  user_id: string;
  hygiene_total: number | null;
  hygiene_valid: number | null;
  hygiene_invalid: number | null;
  hygiene_duplicates: number | null;
  profile_photo_url: string | null;
  profiles?: { email: string; full_name: string | null } | null;
};

type FileRow = { id: string; kind: string; filename: string; storage_path: string; mime: string | null };

function TodasCampanhasPage() {
  const { isAdmin, hasPermission } = useAuth();
  const canSeeAll = isAdmin || hasPermission("view_all_campaigns");
  const canDownloadFiles = isAdmin || hasPermission("download_campaign_files");

  const [rows, setRows] = useState<Row[]>([]);
  const [files, setFiles] = useState<Record<string, FileRow[]>>({});
  const [loading, setLoading] = useState(true);

  // Default photo setting (admin only)
  const [defaultPhotoUrl, setDefaultPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("campaigns")
      .select("id, name, link, send_count, status, debit_cents, created_at, user_id, hygiene_total, hygiene_valid, hygiene_invalid, hygiene_duplicates, profile_photo_url")
      .order("created_at", { ascending: false })
      .limit(100);
    const list = ((data as any) ?? []) as Row[];

    if (list.length) {
      const userIds = Array.from(new Set(list.map((r) => r.user_id).filter(Boolean)));
      const ids = list.map((r) => r.id);
      const [pr, fr] = await Promise.all([
        userIds.length ? supabase.from("profiles").select("id, email, full_name").in("id", userIds) : Promise.resolve({ data: [] } as any),
        supabase.from("campaign_files").select("id, campaign_id, kind, filename, storage_path, mime").in("campaign_id", ids),
      ]);
      const pmap: Record<string, any> = {};
      ((pr.data as any[]) ?? []).forEach((p) => { pmap[p.id] = p; });
      const enriched = list.map((r) => ({ ...r, profiles: pmap[r.user_id] ?? null }));
      setRows(enriched as any);
      const grouped: Record<string, FileRow[]> = {};
      ((fr.data as any) ?? []).forEach((f: any) => {
        (grouped[f.campaign_id] = grouped[f.campaign_id] ?? []).push(f);
      });
      setFiles(grouped);
    } else {
      setRows([]);
    }
    setLoading(false);
  };

  const loadSettings = async () => {
    const { data } = await supabase.from("app_settings").select("value").eq("key", "default_campaign_photo").maybeSingle();
    setDefaultPhotoUrl(((data?.value as any)?.url) ?? null);
  };

  useEffect(() => { load(); loadSettings(); }, []);

  const downloadFile = async (f: FileRow) => {
    const { data, error } = await supabase.storage.from("campaign-files").createSignedUrl(f.storage_path, 60);
    if (error || !data?.signedUrl) return;
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = f.filename;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const uploadDefaultPhoto = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `defaults/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("campaign-profile-photos").upload(path, file, { upsert: true });
      if (up.error) return;
      const { data: signed } = await supabase.storage.from("campaign-profile-photos").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      const url = signed?.signedUrl ?? null;
      await supabase.from("app_settings").update({ value: { url } as any, updated_at: new Date().toISOString() } as any).eq("key", "default_campaign_photo");
      setDefaultPhotoUrl(url);
    } finally {
      setUploading(false);
    }
  };

  if (!canSeeAll) {
    return (
      <PageShell title="Todas as Campanhas" subtitle="Acesso restrito.">
        <div className="card-premium p-6 text-sm text-muted-foreground">Sem permissão para ver as campanhas de outros clientes.</div>
      </PageShell>
    );
  }


  return (
    <PageShell title="Todas as Campanhas" subtitle="Baixe templates, listas e mídias dos clientes para disparo.">
      {isAdmin && (
        <div className="card-premium p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-secondary overflow-hidden flex items-center justify-center shrink-0">
              {defaultPhotoUrl
                ? <img src={defaultPhotoUrl} alt="" className="h-full w-full object-cover" />
                : <UserCircle2 className="h-10 w-10 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Foto de perfil padrão das campanhas</p>
              <p className="text-xs text-muted-foreground">Aplicada a todos os clientes — clientes com permissão podem enviar uma foto personalizada.</p>
            </div>
            <label className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs font-medium hover:bg-secondary cursor-pointer">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
              {defaultPhotoUrl ? "Trocar foto" : "Enviar foto"}
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDefaultPhoto(f); }} />
            </label>
          </div>
        </div>
      )}

      <div className="card-premium p-6">
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin mb-2" /> Carregando campanhas...
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Nenhuma campanha ainda.</p>
        ) : (
          <div className="space-y-4">
            {rows.map((c) => {
              const cf = files[c.id] ?? [];
              return (
                <div key={c.id} className="rounded-xl border border-border bg-secondary/20 p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{c.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.profiles?.email ?? "cliente"} · {new Date(c.created_at).toLocaleString("pt-BR")}
                      </p>
                      {c.link && <p className="text-xs text-muted-foreground truncate mt-1">{c.link}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">{c.send_count ?? 0} envios</p>
                      <p className="text-xs text-muted-foreground">
                        R$ {((c.debit_cents ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                      <span className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-secondary text-muted-foreground inline-block mt-1">
                        {c.status ?? "—"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-center text-xs">
                    <Mini label="Total" value={c.hygiene_total ?? 0} />
                    <Mini label="Válidos" value={c.hygiene_valid ?? 0} tone="ok" />
                    <Mini label="Inválidos" value={c.hygiene_invalid ?? 0} tone="warn" />
                    <Mini label="Duplicados" value={c.hygiene_duplicates ?? 0} />
                  </div>

                  {cf.length > 0 && canDownloadFiles && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {cf.map((f) => (
                        <button key={f.id} onClick={() => downloadFile(f)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-input px-3 py-1.5 text-xs hover:bg-secondary">
                          {f.kind === "media"
                            ? <ImageIcon className="h-3.5 w-3.5 text-[oklch(0.84_0.14_80)]" />
                            : f.kind === "report"
                            ? <FileText className="h-3.5 w-3.5 text-[oklch(0.78_0.18_75)]" />
                            : <FileSpreadsheet className="h-3.5 w-3.5 text-[oklch(0.84_0.14_80)]" />}
                          {f.filename}
                          <Download className="h-3 w-3 ml-1 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )}
                  {cf.length > 0 && !canDownloadFiles && (
                    <p className="text-[11px] text-muted-foreground mt-3">
                      <LockIcon className="inline h-3 w-3 mr-1" /> Sem permissão para baixar os arquivos desta campanha.
                    </p>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageShell>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  const cls = tone === "ok" ? "text-[oklch(0.86_0.14_80)]" : tone === "warn" ? "text-[oklch(0.78_0.18_55)]" : "text-foreground";
  return (
    <div className="rounded-lg bg-input p-2">
      <p className={`text-lg font-bold ${cls}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
