import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Copy, Download, ExternalLink, FileText, Image as ImageIcon, Film,
  FileSpreadsheet, Phone, Link as LinkIcon, MessageCircle, Package, User,
  CheckCircle2, XCircle, Repeat, Zap,
} from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { useServerFn } from "@tanstack/react-start";
import { dispatchInfobipCampaign } from "@/lib/infobip.functions";

type Tab = "resumo" | "mensagem" | "midia" | "leads" | "links" | "entregas";

type FullCampaign = {
  id: string;
  name: string | null;
  link: string | null;
  message: string | null;
  channel: string | null;
  send_count: number | null;
  unit_price_cents: number | null;
  debit_cents: number | null;
  hygiene_total: number | null;
  hygiene_valid: number | null;
  hygiene_invalid: number | null;
  hygiene_duplicates: number | null;
  delivered_count: number | null;
  failed_count: number | null;
  status: string;
  payment_status: string;
  paid_at: string | null;
  paid_method: string | null;
  scheduled_at: string | null;
  created_at: string;
  client_display_name: string | null;
  profile_photo_url: string | null;
  template_data: Record<string, any> | null;
  infobip_bulk_id: string | null;
  infobip_template_id: string | null;
  profiles?: { email: string | null; full_name: string | null; phone: string | null } | null;
  niches?: { name: string | null } | null;
};

type FileRow = { id: string; kind: string; filename: string; storage_path: string; mime: string | null; size_bytes: number | null };
type Delivery = { id: string; phone: string; status: string; status_detail: string | null; sent_at: string; delivered_at: string | null; failed_at: string | null };

const COPY = (text: string, msg = "Copiado") => { navigator.clipboard.writeText(text); toast.success(msg); };

async function signedUrl(path: string, expiresInSec = 600) {
  const { data } = await supabase.storage.from("campaign-files").createSignedUrl(path, expiresInSec);
  return data?.signedUrl ?? null;
}

async function downloadAsBlob(path: string): Promise<Blob | null> {
  const { data } = await supabase.storage.from("campaign-files").download(path);
  return data ?? null;
}

export function CampaignDetailModal({ id, open, onOpenChange }: { id: string | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const dispatchFn = useServerFn(dispatchInfobipCampaign);
  const [tab, setTab] = useState<Tab>("resumo");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FullCampaign | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [busyZip, setBusyZip] = useState(false);
  const [busyDispatch, setBusyDispatch] = useState(false);

  useEffect(() => {
    if (!id || !open) return;
    setLoading(true); setTab("resumo");
    (async () => {
      const [{ data: c }, { data: f }, { data: d }] = await Promise.all([
        supabase.from("campaigns").select("*").eq("id", id).maybeSingle(),
        supabase.from("campaign_files").select("id, kind, filename, storage_path, mime, size_bytes").eq("campaign_id", id),
        supabase.from("campaign_deliveries" as any).select("id, phone, status, status_detail, sent_at, delivered_at, failed_at").eq("campaign_id", id).limit(500),
      ]);
      let full: any = c;
      if (c) {
        const [pr, nr] = await Promise.all([
          c.user_id ? supabase.from("profiles").select("email, full_name, phone").eq("id", c.user_id).maybeSingle() : Promise.resolve({ data: null } as any),
          c.niche_id ? supabase.from("niches").select("name").eq("id", c.niche_id).maybeSingle() : Promise.resolve({ data: null } as any),
        ]);
        full = { ...c, profiles: pr.data ?? null, niches: nr.data ?? null };
      }
      setData(full as any);
      setFiles((f as any) ?? []);
      setDeliveries((d as any) ?? []);
      const media = ((f as any) ?? []).find((x: FileRow) => x.kind === "media");
      if (media) setMediaUrl(await signedUrl(media.storage_path));
      else setMediaUrl(null);
      setLoading(false);
    })();
  }, [id, open]);

  const { mediaFile, photoFile, leadsOriginal, leadsValid, leadsInvalid, leadsDuplicates } = useMemo(() => {
    return {
      mediaFile: files.find((x) => x.kind === "media"),
      photoFile: files.find((x) => x.kind === "photo" || x.kind === "profile"),
      leadsOriginal: files.find((x) => x.filename.startsWith("original-")),
      leadsValid: files.find((x) => x.filename === "leads-validos.csv"),
      leadsInvalid: files.find((x) => x.filename === "leads-invalidos.csv"),
      leadsDuplicates: files.find((x) => x.filename === "leads-duplicados.csv"),
    };
  }, [files]);

  const exportTxt = () => {
    if (!data) return;
    const lines = [
      `=== PEDIDO ${data.id} ===`,
      `Cliente: ${data.client_display_name ?? data.profiles?.full_name ?? data.profiles?.email ?? "—"}`,
      `Email: ${data.profiles?.email ?? "—"}`,
      `Telefone: ${data.profiles?.phone ?? "—"}`,
      `Nicho: ${data.niches?.name ?? "—"}`,
      `Canal: ${data.channel ?? "manual"}`,
      `Status: ${data.status} | Pagamento: ${data.payment_status}`,
      `Criado: ${new Date(data.created_at).toLocaleString("pt-BR")}`,
      `Envios: ${data.send_count ?? 0} (válidos: ${data.hygiene_valid ?? 0}, inválidos: ${data.hygiene_invalid ?? 0}, duplicados removidos: ${data.hygiene_duplicates ?? 0})`,
      `Preço unitário: R$ ${((data.unit_price_cents ?? 0) / 100).toFixed(2)}`,
      `Total: R$ ${((data.debit_cents ?? 0) / 100).toFixed(2)}`,
      `\n--- MENSAGEM ---\n${data.message ?? ""}`,
      `\n--- VARIÁVEIS ---`,
      ...Object.entries(data.template_data ?? {}).map(([k, v]) => `{{${k}}} = ${v}`),
      `\n--- LINKS ---\n${data.link ?? ""}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    triggerDownload(blob, `pedido-${data.id}.txt`);
  };

  const exportJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify({ campaign: data, files: files.map((f) => ({ ...f })), deliveries }, null, 2)], { type: "application/json" });
    triggerDownload(blob, `pedido-${data.id}.json`);
  };

  const exportZip = async () => {
    if (!data) return;
    setBusyZip(true);
    try {
      const zip = new JSZip();
      // Pedido.txt content
      const txt: string[] = [
        `Pedido ${data.id}`,
        `Cliente: ${data.client_display_name ?? data.profiles?.full_name ?? "—"}`,
        `Status: ${data.status} | Pagamento: ${data.payment_status}`,
        `Envios: ${data.send_count ?? 0}`,
        ``, `Mensagem:`, data.message ?? "",
        ``, `Links:`, data.link ?? "",
      ];
      zip.file("pedido.txt", txt.join("\n"));
      zip.file("pedido.json", JSON.stringify(data, null, 2));
      for (const f of files) {
        const blob = await downloadAsBlob(f.storage_path);
        if (blob) zip.file(`arquivos/${f.kind}-${f.filename}`, blob);
      }
      const out = await zip.generateAsync({ type: "blob" });
      triggerDownload(out, `pedido-${data.id}.zip`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusyZip(false); }
  };

  const dispatchInfobip = async () => {
    if (!data) return;
    if (!confirm("Disparar este pedido via Infobip agora?")) return;
    setBusyDispatch(true);
    try {
      const r: any = await dispatchFn({ data: { campaign_id: data.id } });
      toast.success(`Enviado: ${r.sent} mensagens (bulkId ${r.bulkId ?? "—"})`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusyDispatch(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 gap-0 bg-card border-border overflow-hidden">
        <div className="p-5 border-b border-border flex items-start gap-3">
          <div className="h-12 w-12 rounded-full bg-secondary overflow-hidden shrink-0 flex items-center justify-center">
            {data?.profile_photo_url ? <img src={data.profile_photo_url} className="h-full w-full object-cover" alt="" />
              : <User className="h-6 w-6 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-xl truncate">
              Pedido — {data?.client_display_name ?? data?.profiles?.full_name ?? data?.profiles?.email ?? "—"}
            </h3>
            <p className="text-xs text-muted-foreground">{data ? new Date(data.created_at).toLocaleString("pt-BR") : "..."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionBtn onClick={exportTxt}><FileText className="h-3.5 w-3.5" /> .txt</ActionBtn>
            <ActionBtn onClick={exportJson}><FileText className="h-3.5 w-3.5" /> .json</ActionBtn>
            <ActionBtn onClick={exportZip} disabled={busyZip}>
              {busyZip ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />} .zip
            </ActionBtn>
            <ActionBtn onClick={dispatchInfobip} disabled={busyDispatch} variant="primary">
              {busyDispatch ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Disparar Infobip
            </ActionBtn>
          </div>
        </div>

        <div className="border-b border-border px-5">
          <div className="flex gap-1 overflow-x-auto">
            {([
              ["resumo", "Resumo"], ["mensagem", "Mensagem"], ["midia", "Mídia & Foto"],
              ["leads", "Lista de Leads"], ["links", "Links"], ["entregas", "Entregas"],
            ] as [Tab, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-3 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  tab === k ? "border-[oklch(0.6_0.12_75)] text-[oklch(0.86_0.14_80)]" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {loading || !data ? (
            <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : tab === "resumo" ? (
            <ResumoTab data={data} />
          ) : tab === "mensagem" ? (
            <MensagemTab data={data} />
          ) : tab === "midia" ? (
            <MidiaTab data={data} mediaFile={mediaFile} photoFile={photoFile} mediaUrl={mediaUrl} />
          ) : tab === "leads" ? (
            <LeadsTab data={data} valid={leadsValid} invalid={leadsInvalid} original={leadsOriginal} duplicates={leadsDuplicates} />
          ) : tab === "links" ? (
            <LinksTab data={data} />
          ) : (
            <EntregasTab deliveries={deliveries} data={data} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── tabs ─────────────

function ResumoTab({ data }: { data: FullCampaign }) {
  const cost = ((data.debit_cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const unit = ((data.unit_price_cents ?? 0) / 100).toFixed(2).replace(".", ",");
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
      <Field label="Cliente" value={data.client_display_name ?? data.profiles?.full_name ?? "—"} />
      <Field label="E-mail" value={data.profiles?.email ?? "—"} />
      <Field label="Telefone" value={data.profiles?.phone ?? "—"} />
      <Field label="Nicho" value={data.niches?.name ?? "—"} />
      <Field label="Canal" value={data.channel ?? "manual"} />
      <Field label="Status" value={data.status} />
      <Field label="Pagamento" value={`${data.payment_status}${data.paid_method ? ` (${data.paid_method})` : ""}`} />
      <Field label="Criado em" value={new Date(data.created_at).toLocaleString("pt-BR")} />
      <Field label="Envios" value={String(data.send_count ?? 0)} />
      <Field label="Preço unit." value={`R$ ${unit}`} />
      <Field label="Total cobrado" value={cost} />
      <Field label="ID do pedido" value={data.id} mono />
      {data.infobip_bulk_id && <Field label="Bulk Infobip" value={data.infobip_bulk_id} mono />}
    </div>
  );
}

function MensagemTab({ data }: { data: FullCampaign }) {
  const vars = Object.entries(data.template_data ?? {}).filter(([k]) => /^\d+$/.test(k));
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ActionBtn onClick={() => COPY(data.message ?? "", "Mensagem copiada")}>
          <Copy className="h-3.5 w-3.5" /> Copiar mensagem
        </ActionBtn>
      </div>
      <textarea readOnly value={data.message ?? ""}
        className="w-full min-h-[200px] rounded-lg bg-input border border-border p-3 text-sm font-mono" />
      {vars.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Variáveis preenchidas</p>
          <div className="space-y-1.5">
            {vars.map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-sm">
                <code className="rounded bg-secondary px-2 py-0.5 text-xs">{`{{${k}}}`}</code>
                <span className="flex-1 truncate">{String(v ?? "")}</span>
                <button onClick={() => COPY(String(v ?? ""))} className="p-1 rounded hover:bg-secondary"><Copy className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MidiaTab({ data, mediaFile, photoFile, mediaUrl }: { data: FullCampaign; mediaFile?: FileRow; photoFile?: FileRow; mediaUrl: string | null }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card title="Mídia da campanha">
        {mediaFile ? (
          <>
            {mediaUrl && (mediaFile.mime?.startsWith("image/")
              ? <img src={mediaUrl} className="w-full max-h-64 object-contain rounded-lg border border-border" alt="" />
              : mediaFile.mime?.startsWith("video/")
              ? <video src={mediaUrl} controls className="w-full max-h-64 rounded-lg border border-border" />
              : <div className="p-6 text-center text-muted-foreground text-sm"><Film className="mx-auto h-8 w-8 mb-2" />{mediaFile.filename}</div>)}
            <p className="text-xs text-muted-foreground mt-2 truncate">{mediaFile.filename}</p>
            <div className="flex gap-2 mt-2">
              <FileBtn file={mediaFile} kind="download" />
              <FileBtn file={mediaFile} kind="open" />
            </div>
          </>
        ) : <p className="text-sm text-muted-foreground">Sem mídia anexada.</p>}
      </Card>
      <Card title="Foto de perfil do disparo">
        {data.profile_photo_url ? (
          <img src={data.profile_photo_url} alt="" className="w-32 h-32 rounded-full object-cover mx-auto border border-border" />
        ) : <p className="text-sm text-muted-foreground">Padrão da plataforma.</p>}
        {photoFile && (
          <div className="flex gap-2 mt-3 justify-center">
            <FileBtn file={photoFile} kind="download" />
          </div>
        )}
      </Card>
    </div>
  );
}

function LeadsTab({ data, valid, invalid, original, duplicates }: { data: FullCampaign; valid?: FileRow; invalid?: FileRow; original?: FileRow; duplicates?: FileRow }) {
  const [validNumbers, setValidNumbers] = useState<string[] | null>(null);
  const [loadingNumbers, setLoadingNumbers] = useState(false);

  const loadValidNumbers = async () => {
    if (!valid) return;
    setLoadingNumbers(true);
    try {
      const blob = await downloadAsBlob(valid.storage_path);
      if (blob) {
        const text = await blob.text();
        setValidNumbers(text.split(/\r?\n/).slice(1).filter(Boolean));
      }
    } finally { setLoadingNumbers(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total" value={data.hygiene_total ?? 0} />
        <Stat label="Válidos" value={data.hygiene_valid ?? 0} tone="green" />
        <Stat label="Inválidos" value={data.hygiene_invalid ?? 0} tone="red" />
        <Stat label="Duplicados removidos" value={data.hygiene_duplicates ?? 0} tone="muted" />
      </div>

      <Card title="Downloads">
        <div className="flex flex-wrap gap-2">
          {original && <FileBtn file={original} kind="download" label="Original" />}
          {valid && <FileBtn file={valid} kind="download" label="Válidos .csv (Infobip)" />}
          {valid && <CsvAsTxtBtn file={valid} />}
          {invalid && <FileBtn file={invalid} kind="download" label="Inválidos .csv" />}
          {duplicates && <FileBtn file={duplicates} kind="download" label="Duplicados .csv" />}
        </div>
      </Card>

      <Card title="Pré-visualizar válidos">
        {validNumbers === null ? (
          <button onClick={loadValidNumbers} disabled={loadingNumbers || !valid}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs hover:bg-secondary disabled:opacity-50">
            {loadingNumbers ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />} Carregar números
          </button>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-input p-3 text-xs font-mono space-y-0.5">
            {validNumbers.slice(0, 200).map((n, i) => <div key={i}>{n}</div>)}
            {validNumbers.length > 200 && <p className="text-muted-foreground text-center pt-2">+ {validNumbers.length - 200} restantes (use o download)</p>}
          </div>
        )}
      </Card>
    </div>
  );
}

function LinksTab({ data }: { data: FullCampaign }) {
  const links = (data.link ?? "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  return (
    <div className="space-y-2">
      {links.length === 0 ? <p className="text-sm text-muted-foreground">Sem links.</p> : links.map((l, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-input p-3">
          <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <code className="text-xs flex-1 truncate">{l}</code>
          <button onClick={() => COPY(l)} className="p-1.5 rounded hover:bg-secondary"><Copy className="h-3.5 w-3.5" /></button>
          <a href={l} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-secondary"><ExternalLink className="h-3.5 w-3.5" /></a>
        </div>
      ))}
    </div>
  );
}

function EntregasTab({ deliveries, data }: { deliveries: Delivery[]; data: FullCampaign }) {
  const exportCsv = () => {
    const rows = [["phone", "status", "detail", "sent_at", "delivered_at", "failed_at"]];
    deliveries.forEach((d) => rows.push([d.phone, d.status, d.status_detail ?? "", d.sent_at, d.delivered_at ?? "", d.failed_at ?? ""]));
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    triggerDownload(new Blob([csv], { type: "text/csv" }), `entregas-${data.id}.csv`);
  };
  if (deliveries.length === 0) {
    return <p className="text-sm text-muted-foreground">
      Nenhuma entrega registrada. {data.channel === "infobip" ? "Aguardando webhook da Infobip." : "Esta campanha é manual."}
    </p>;
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Entregues: <strong className="text-foreground">{data.delivered_count ?? 0}</strong> |
          Falhas: <strong className="text-foreground">{data.failed_count ?? 0}</strong>
        </div>
        <ActionBtn onClick={exportCsv}><Download className="h-3.5 w-3.5" /> Exportar .csv</ActionBtn>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-secondary/60 sticky top-0">
              <tr><th className="text-left p-2">Telefone</th><th className="text-left p-2">Status</th><th className="text-left p-2">Enviado</th><th className="text-left p-2">Entregue</th></tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="p-2 font-mono">{d.phone}</td>
                  <td className="p-2">
                    {d.status === "delivered" ? <span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle2 className="h-3 w-3" />{d.status}</span>
                      : d.status === "failed" ? <span className="inline-flex items-center gap-1 text-destructive"><XCircle className="h-3 w-3" />{d.status}</span>
                      : <span className="text-muted-foreground">{d.status}</span>}
                  </td>
                  <td className="p-2 text-muted-foreground">{new Date(d.sent_at).toLocaleString("pt-BR")}</td>
                  <td className="p-2 text-muted-foreground">{d.delivered_at ? new Date(d.delivered_at).toLocaleString("pt-BR") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ───────────── small ui ─────────────

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-input/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <span className={`flex-1 truncate text-sm ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
        <button onClick={() => COPY(value)} className="p-1 rounded hover:bg-secondary"><Copy className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "green" | "red" | "muted" }) {
  const color = tone === "green" ? "text-emerald-400" : tone === "red" ? "text-destructive" : tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-input/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString("pt-BR")}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">{title}</p>
      {children}
    </div>
  );
}

function ActionBtn({ children, onClick, disabled, variant }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; variant?: "primary" }) {
  const cls = variant === "primary"
    ? "bg-gold-metal hover:scale-[1.02]"
    : "border border-border bg-secondary/60 hover:bg-secondary";
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${cls}`}>
      {children}
    </button>
  );
}

function FileBtn({ file, kind, label }: { file: FileRow; kind: "download" | "open"; label?: string }) {
  const Icon = file.mime?.startsWith("image/") ? ImageIcon : file.mime?.startsWith("video/") ? Film : FileSpreadsheet;
  const handle = async () => {
    const url = await signedUrl(file.storage_path);
    if (!url) return toast.error("Falha ao gerar link");
    if (kind === "open") window.open(url, "_blank");
    else { const a = document.createElement("a"); a.href = url; a.download = file.filename; document.body.appendChild(a); a.click(); a.remove(); }
  };
  return (
    <button onClick={handle}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs hover:bg-secondary">
      {kind === "open" ? <ExternalLink className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
      {label ?? file.filename}
    </button>
  );
}

function CsvAsTxtBtn({ file }: { file: FileRow }) {
  const handle = async () => {
    const blob = await downloadAsBlob(file.storage_path);
    if (!blob) return toast.error("Falha");
    const text = await blob.text();
    const lines = text.split(/\r?\n/).slice(1).filter(Boolean).join("\n");
    triggerDownload(new Blob([lines], { type: "text/plain" }), file.filename.replace(/\.csv$/, ".txt"));
  };
  return (
    <button onClick={handle}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs hover:bg-secondary">
      <Download className="h-3.5 w-3.5" /> Válidos .txt
    </button>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
