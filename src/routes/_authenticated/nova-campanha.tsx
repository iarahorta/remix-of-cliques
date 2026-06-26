import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, X, ChevronRight, ChevronLeft, Sparkles, UploadCloud, FileSpreadsheet,
  Image as ImageIcon, CheckCircle2, Rocket, MessageCircle, Loader2,
  Send, HelpCircle, Download, Lock, ShieldCheck, UserCircle2, Shuffle, Trash2,
  Repeat, Search, Clock,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useAuth } from "@/hooks/use-auth";
import { classifyPhones, downloadCsv, readLeadFile, type LeadHygieneResult } from "@/lib/lead-hygiene";

export const Route = createFileRoute("/_authenticated/nova-campanha")({
  head: () => ({
    meta: [
      { title: "Nova Campanha — HS Assessoria" },
      { name: "description", content: "Crie um novo pedido de disparo em massa." },
    ],
  }),
  component: NovaCampanhaPage,
});

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isValidUrl(value: string) {
  try {
    const url = new URL(normalizeUrl(value));
    return ["http:", "https:"].includes(url.protocol) && url.hostname.includes(".");
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────────

type Campaign = {
  id: string;
  name: string | null;
  link: string | null;
  send_count: number | null;
  status: string | null;
  debit_cents: number | null;
  created_at: string;
};

function NovaCampanhaPage() {
  const [open, setOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [preset, setPreset] = useState<WizardPreset | null>(null);
  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("campaigns")
      .select("id, name, link, send_count, status, debit_cents, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setPreset(null); setOpen(true); };
  const handlePickRepeat = (p: WizardPreset) => {
    setPreset(p);
    setRepeatOpen(false);
    setOpen(true);
  };

  return (
    <PageShell title="Comprar Disparo" subtitle="Gerencie e crie novos pedidos de disparo em massa.">
      <div className="flex flex-wrap justify-end gap-2 mb-6">
        <button
          onClick={() => setRepeatOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/60 px-4 sm:px-5 py-3 text-sm font-semibold text-[oklch(0.84_0.14_80)] hover:bg-secondary transition-colors"
        >
          <Repeat className="h-4 w-4" /> Repetir campanha
        </button>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-xl bg-gold-metal px-4 sm:px-6 py-3 text-sm font-semibold hover:scale-[1.02] transition-transform"
        >
          <Plus className="h-4 w-4" /> Novo Pedido de Disparo
        </button>
      </div>

      <div className="card-premium p-6">
        {loading ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin mb-2" /> Carregando pedidos...
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto h-14 w-14 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
              <Send className="h-6 w-6 text-[oklch(0.75_0.13_75)]" />
            </div>
            <h3 className="font-display text-xl mb-1">Nenhum pedido ainda</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Clique em <strong className="text-foreground">Novo Pedido de Disparo</strong> para criar sua primeira campanha.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((c) => (
              <div key={c.id} className="py-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{c.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.link ?? "Sem link"}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{c.send_count ?? 0} envios</p>
                  <p className="text-xs text-muted-foreground">
                    R$ {((c.debit_cents ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wider rounded-full px-2 py-1 bg-secondary text-muted-foreground">
                  {c.status ?? "pendente"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <NewOrderWizard
        open={open}
        preset={preset}
        onOpenChange={(v) => { setOpen(v); if (!v) setPreset(null); }}
        onCreated={load}
      />
      <RepeatPicker open={repeatOpen} onOpenChange={setRepeatOpen} onPick={handlePickRepeat} />
    </PageShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Wizard
// ──────────────────────────────────────────────────────────────────────────────

interface VariableSpec { key: string; label: string; placeholder?: string; optional?: boolean }
interface Template { id: string; name: string; content: string; variables: VariableSpec[] }

interface WizardPreset {
  sourceCampaignId: string;
  sourceCampaignName: string;
  clientName: string;
  isRotatingLink: boolean;
  link: string;
  rotationLinks: string[];
  tplId: string | null;
  varValues: Record<string, string>;
  media: { storagePath: string; filename: string; mime: string | null; sizeBytes: number | null } | null;
}

const STEPS = [
  { n: 1, label: "Informações básicas", sub: "Dados principais do pedido" },
  { n: 2, label: "Arquivos", sub: "Anexar arquivos necessários" },
  { n: 3, label: "Configurações", sub: "Template e ações" },
  { n: 4, label: "Revisão", sub: "Revise e envie seu pedido" },
];

function NewOrderWizard({
  open, onOpenChange, onCreated, preset,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void; preset?: WizardPreset | null }) {
  const { user, isAdmin } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step 1
  const [clientName, setClientName] = useState("");
  const [link, setLink] = useState("");
  const [isRotatingLink, setIsRotatingLink] = useState(false);
  const [rotationLinks, setRotationLinks] = useState<string[]>(["", ""]);
  const [niches, setNiches] = useState<Array<{ id: string; name: string }>>([]);
  const [nicheId, setNicheId] = useState<string | null>(null);


  // Step 2 — leads / mídia
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [leadsFile, setLeadsFile] = useState<File | null>(null);
  const [leadsStats, setLeadsStats] = useState<LeadHygieneResult | null>(null);
  const [hygieneConfirmed, setHygieneConfirmed] = useState(false);
  const [reusedMedia, setReusedMedia] = useState<WizardPreset["media"]>(null);
  const [reuseMedia, setReuseMedia] = useState(true);

  // Step 3
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplId, setTplId] = useState<string | null>(null);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  // Step 3 — Infobip dispatch
  const [waTemplates, setWaTemplates] = useState<Array<{ id: string; name: string; language: string }>>([]);
  const [waTemplateId, setWaTemplateId] = useState<string | null>(null);
  const [dispatchMode, setDispatchMode] = useState<"immediate" | "scheduled">("immediate");
  const [scheduledAt, setScheduledAt] = useState<string>(""); // local datetime string

  // Profile photo
  const [defaultPhotoUrl, setDefaultPhotoUrl] = useState<string | null>(null);
  const [canCustomizePhoto, setCanCustomizePhoto] = useState(false);
  const [customPhotoFile, setCustomPhotoFile] = useState<File | null>(null);
  const [customPhotoPreview, setCustomPhotoPreview] = useState<string | null>(null);

  const sendCount = leadsStats?.valid.length ?? 0;
  const activePhotoUrl = customPhotoPreview ?? defaultPhotoUrl;
  const normalizedSingleLink = normalizeUrl(link);
  const cleanRotationLinks = rotationLinks.map(normalizeUrl).filter(Boolean);
  const finalLink = isRotatingLink ? cleanRotationLinks.join("\n") : normalizedSingleLink;

  // Step 3 — agendamento (cliente escolhe data/hora)
  const [scheduleDate, setScheduleDate] = useState<string>(""); // YYYY-MM-DD
  const [scheduleTime, setScheduleTime] = useState<string>(""); // HH:mm
  const [busySlots, setBusySlots] = useState<Date[]>([]);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const reset = () => {
    setStep(1); setSubmitting(false); setSubmitError(null); setClientName(""); setLink("");
    setIsRotatingLink(false); setRotationLinks(["", ""]);
    setNicheId(null);
    setMediaFile(null); setLeadsFile(null); setLeadsStats(null); setHygieneConfirmed(false);
    setTplId(null); setVarValues({});
    setCustomPhotoFile(null); setCustomPhotoPreview(null);
    setReusedMedia(null); setReuseMedia(true);
    setWaTemplateId(null); setDispatchMode("immediate"); setScheduledAt("");
    setScheduleDate(""); setScheduleTime(""); setScheduleError(null);
  };


  // Apply preset on open
  useEffect(() => {
    if (!open || !preset) return;
    setClientName(preset.clientName);
    setLink(preset.link);
    setIsRotatingLink(preset.isRotatingLink);
    setRotationLinks(preset.rotationLinks.length >= 2 ? preset.rotationLinks : ["", ""]);
    setTplId(preset.tplId);
    setVarValues(preset.varValues);
    setReusedMedia(preset.media);
    setReuseMedia(!!preset.media);
    setStep(2); // jump straight to file upload
  }, [open, preset]);


  useEffect(() => {
    if (!open) return;
    supabase
      .from("message_templates")
      .select("id, name, content, variables")
      .eq("is_fixed", true).eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        const list = (data as any[] ?? []) as Template[];
        setTemplates(list);
        if (list.length && !tplId) setTplId(list[0].id);
      });
    // default photo
    supabase.from("app_settings").select("value").eq("key", "default_campaign_photo").maybeSingle()
      .then(({ data }) => setDefaultPhotoUrl(((data?.value as any)?.url) ?? null));
    // user permission
    if (user) {
      supabase.from("user_permissions" as any).select("permission").eq("user_id", user.id).eq("permission", "customize_profile_photo").maybeSingle()
        .then(({ data }) => setCanCustomizePhoto(!!data));
    }
    // Approved Infobip templates (for auto-dispatch)
    supabase.from("wa_templates").select("id, name, language").eq("status", "APPROVED").order("name")
      .then(({ data }) => setWaTemplates((data as any) ?? []));
    // Nichos disponíveis
    supabase.from("niches").select("id, name").eq("is_active", true).order("sort_order")
      .then(({ data }) => setNiches((data as any) ?? []));

    // Horários já ocupados (próximas semanas) para validar conflito
    supabase.from("campaigns").select("scheduled_at").gte("scheduled_at", new Date().toISOString())
      .not("scheduled_at", "is", null)
      .then(({ data }) => setBusySlots(((data as any) ?? []).map((r: any) => new Date(r.scheduled_at))));
  }, [open, user]);

  // Validação do agendamento: mínimo 30 min de antecedência e 30 min de distância de outras
  const scheduledDateTime = useMemo(() => {
    if (!scheduleDate || !scheduleTime) return null;
    const d = new Date(`${scheduleDate}T${scheduleTime}:00`);
    return isNaN(d.getTime()) ? null : d;
  }, [scheduleDate, scheduleTime]);

  useEffect(() => {
    if (!scheduledDateTime) { setScheduleError(null); return; }
    const minStart = Date.now() + 30 * 60 * 1000;
    if (scheduledDateTime.getTime() < minStart) {
      setScheduleError("Escolha um horário com pelo menos 30 minutos de antecedência.");
      return;
    }
    const conflict = busySlots.find((d) => Math.abs(d.getTime() - scheduledDateTime.getTime()) < 30 * 60 * 1000);
    if (conflict) {
      setScheduleError(`Já existe um pedido às ${conflict.toLocaleString("pt-BR")}. Mantenha 30 min de diferença.`);
      return;
    }
    setScheduleError(null);
  }, [scheduledDateTime, busySlots]);

  const activeTpl = templates.find((t) => t.id === tplId) ?? null;

  // Parse leads when file changes
  useEffect(() => {
    setHygieneConfirmed(false);
    if (!leadsFile) { setLeadsStats(null); return; }
    readLeadFile(leadsFile).then((txt) => setLeadsStats(classifyPhones(txt)));
  }, [leadsFile]);

  // Custom photo preview
  useEffect(() => {
    if (!customPhotoFile) { setCustomPhotoPreview(null); return; }
    const url = URL.createObjectURL(customPhotoFile);
    setCustomPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [customPhotoFile]);

  const canNext = useMemo(() => {
    if (step === 1) {
      const hasName = clientName.trim().length > 0;
      if (!hasName) return false;
      if (!nicheId) return false;
      if (!isRotatingLink) return isValidUrl(link);
      return cleanRotationLinks.length >= 2 && cleanRotationLinks.every(isValidUrl);
    }

    if (step === 2) return !!leadsStats && leadsStats.valid.length > 0 && hygieneConfirmed;
    if (step === 3) {
      if (!activeTpl) return false;
      if (!scheduledDateTime || scheduleError) return false;
      return true;
    }
    return true;
  }, [step, clientName, nicheId, link, isRotatingLink, cleanRotationLinks, leadsStats, hygieneConfirmed, activeTpl, scheduledDateTime, scheduleError]);

  const renderedMessage = useMemo(() => {
    if (!activeTpl) return "";
    let out = activeTpl.content;
    activeTpl.variables?.forEach((v) => {
      const val = varValues[v.key] ?? "";
      // tolera chave de fechamento simples ({{1}) ou dupla ({{1}})
      const re = new RegExp(`\\{\\{\\s*${v.key}\\s*\\}\\}?`, "g");
      out = out.replace(re, val);
    });
    return out;
  }, [activeTpl, varValues]);

  const submit = async () => {
    if (!activeTpl || !user || !leadsStats) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let photoUrl: string | null = defaultPhotoUrl;
      let photoSource = "default";

      // upload custom photo if provided & allowed
      if (customPhotoFile && (isAdmin || canCustomizePhoto)) {
        const ext = customPhotoFile.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const up = await supabase.storage.from("campaign-profile-photos").upload(path, customPhotoFile, { upsert: true });
        if (!up.error) {
          const { data: signed } = await supabase.storage.from("campaign-profile-photos").createSignedUrl(path, 60 * 60 * 24 * 365);
          photoUrl = signed?.signedUrl ?? null;
          photoSource = "custom";
        }
      }

      const { data: inserted, error: insErr } = await supabase.from("campaigns").insert({
        user_id: user.id,
        name: clientName,
        niche_id: nicheId,

        link: finalLink,
        send_count: Number(sendCount),
        unit_price_cents: 0,
        debit_cents: 0,
        template_id: activeTpl.id,
        template_data: { ...varValues, link_mode: isRotatingLink ? "rotation" : "single", links: isRotatingLink ? cleanRotationLinks : [normalizedSingleLink] } as any,
        message: renderedMessage,
        status: scheduledDateTime ? "scheduled" : "draft",
        scheduled_at: scheduledDateTime ? scheduledDateTime.toISOString() : null,
        auto_dispatch: false,
        infobip_template_id: waTemplateId,
        channel: waTemplateId ? "infobip" : "manual",
        hygiene_total: leadsStats.total,
        hygiene_valid: leadsStats.valid.length,
        hygiene_invalid: leadsStats.invalid.length,
        hygiene_duplicates: leadsStats.duplicates,
        profile_photo_url: photoUrl,
        profile_photo_source: photoSource,
      } as any).select("id").single();

      if (insErr || !inserted) throw insErr;
      const campaignId = (inserted as any).id as string;

      // Upload files into campaign-files bucket + register rows
      const uploads: Array<Promise<unknown>> = [];
      const addFile = async (kind: "media" | "contacts", file: File | Blob, filename: string, mime?: string) => {
        const path = `${campaignId}/${kind}/${Date.now()}-${filename}`;
        const up = await supabase.storage.from("campaign-files").upload(path, file, { upsert: true, contentType: mime });
        if (up.error) return;
        await supabase.from("campaign_files").insert({
          campaign_id: campaignId, kind, storage_path: path,
          filename, size_bytes: (file as File).size ?? null, mime: mime ?? null, uploaded_by: user.id,
        } as any);
      };

      if (mediaFile) {
        uploads.push(addFile("media", mediaFile, mediaFile.name, mediaFile.type));
      } else if (reuseMedia && reusedMedia) {
        // Reuse media from previous campaign: copy in storage
        const srcPath = reusedMedia.storagePath;
        const dstPath = `${campaignId}/media/${Date.now()}-${reusedMedia.filename}`;
        uploads.push((async () => {
          const cp = await supabase.storage.from("campaign-files").copy(srcPath, dstPath);
          if (cp.error) return;
          await supabase.from("campaign_files").insert({
            campaign_id: campaignId, kind: "media", storage_path: dstPath,
            filename: reusedMedia.filename, size_bytes: reusedMedia.sizeBytes,
            mime: reusedMedia.mime, uploaded_by: user.id,
          } as any);
        })());
      }
      if (leadsFile) uploads.push(addFile("contacts", leadsFile, `original-${leadsFile.name}`, leadsFile.type));
      // valid leads CSV (cleaned)
      const validCsv = new Blob([["numero", ...leadsStats.valid].join("\n")], { type: "text/csv" });
      uploads.push(addFile("contacts", validCsv, "leads-validos.csv", "text/csv"));
      // invalid leads CSV (for reference)
      if (leadsStats.invalid.length) {
        const invalidCsv = new Blob([["numero", ...leadsStats.invalid].join("\n")], { type: "text/csv" });
        uploads.push(addFile("contacts", invalidCsv, "leads-invalidos.csv", "text/csv"));
      }
      await Promise.all(uploads);

      onCreated();
      onOpenChange(false);
      reset();
    } catch (error: any) {
      setSubmitError(error?.message ?? "Não foi possível enviar o pedido. Confira os dados e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-5xl p-0 gap-0 bg-card border-border overflow-hidden">
        <div className="p-6 border-b border-border flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl">Novo Pedido de Disparo</h2>
            <p className="text-sm text-muted-foreground mt-1">Preencha as informações abaixo para criar seu pedido.</p>
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            <HelpCircle className="h-3.5 w-3.5" /> Ajuda
          </button>
        </div>

        {/* Stepper */}
        <div className="px-6 pt-5">
          <div className="rounded-xl border border-border bg-secondary/30 p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {STEPS.map((s) => {
              const done = step > s.n; const active = step === s.n;
              return (
                <div key={s.n} className="flex items-start gap-3">
                  <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    done ? "bg-gold-metal"
                    : active ? "border-2 border-[oklch(0.78_0.13_75)] text-[oklch(0.84_0.14_80)]"
                    : "border border-border text-muted-foreground"
                  }`}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : s.n}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${active ? "text-[oklch(0.84_0.14_80)]" : done ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{s.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6 max-h-[60vh] overflow-y-auto">
          {step === 1 && (
            <section className="card-premium p-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-xl bg-[oklch(0.32_0.07_70_/_0.35)] flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-[oklch(0.84_0.14_80)]" />
                </div>
                <div>
                  <h3 className="font-semibold">Informações básicas</h3>
                  <p className="text-xs text-muted-foreground">Dados principais do seu pedido de disparo</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Seu nome / Empresa" hint={`${clientName.length}/60`}>
                  <input
                    maxLength={60} value={clientName} onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex: Lucas"
                    className="w-full bg-input border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </Field>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">Link</span>
                    <button
                      type="button"
                      onClick={() => setIsRotatingLink((v) => !v)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${isRotatingLink ? "bg-gold-metal" : "border border-border bg-secondary/60 text-muted-foreground hover:text-foreground"}`}
                    >
                      <Shuffle className="h-3.5 w-3.5" /> Rotação
                    </button>
                  </div>
                  {!isRotatingLink ? (
                    <input
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      onBlur={() => setLink(normalizeUrl(link))}
                      placeholder="instagram.com.br ou https://exemplo.com"
                      className="w-full bg-input border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  ) : (
                    <div className="space-y-2">
                      {rotationLinks.map((url, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            value={url}
                            onChange={(e) => setRotationLinks(rotationLinks.map((item, i) => i === index ? e.target.value : item))}
                            onBlur={() => setRotationLinks(rotationLinks.map((item, i) => i === index ? normalizeUrl(item) : item))}
                            placeholder={`Link ${index + 1}`}
                            className="flex-1 bg-input border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                          {rotationLinks.length > 2 && (
                            <button
                              type="button"
                              onClick={() => setRotationLinks(rotationLinks.filter((_, i) => i !== index))}
                              className="rounded-lg border border-border bg-secondary/50 px-3 text-muted-foreground hover:text-destructive"
                              aria-label="Remover link"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setRotationLinks([...rotationLinks, ""])}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs font-medium text-[oklch(0.84_0.14_80)] hover:bg-secondary"
                      >
                        <Plus className="h-3.5 w-3.5" /> Adicionar mais links
                      </button>
                      <p className="text-[11px] text-muted-foreground">Use pelo menos 2 links para rotacionar.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <Field label="Nicho da campanha" hint="Selecione o segmento principal do disparo">
                  {niches.length === 0 ? (
                    <p className="text-xs text-muted-foreground rounded-lg border border-border bg-input/40 px-4 py-3">
                      Nenhum nicho disponível. Peça ao administrador para cadastrar em Admin → Valores.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {niches.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => setNicheId(n.id)}
                          className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${nicheId === n.id ? "bg-gold-metal" : "border border-border bg-secondary/60 text-muted-foreground hover:text-foreground"}`}
                        >
                          {n.name}
                        </button>
                      ))}
                    </div>
                  )}
                </Field>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                A <strong className="text-foreground">quantidade de envios</strong> será calculada automaticamente na próxima etapa, após a higienização da sua lista.
              </p>

            </section>
          )}

          {step === 2 && (
            <section className="card-premium p-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-[oklch(0.32_0.07_70_/_0.35)] flex items-center justify-center">
                  <UploadCloud className="h-5 w-5 text-[oklch(0.84_0.14_80)]" />
                </div>
                <div>
                  <h3 className="font-semibold">Arquivos</h3>
                  <p className="text-xs text-muted-foreground">Anexe os arquivos necessários para o disparo</p>
                </div>
              </div>

              {preset && (
                <div className="rounded-xl border border-[oklch(0.7_0.12_75_/_0.45)] bg-[oklch(0.34_0.06_70_/_0.18)] p-3 flex items-start gap-3 text-xs">
                  <Repeat className="h-4 w-4 text-[oklch(0.84_0.14_80)] shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">Repetindo: {preset.sourceCampaignName}</p>
                    <p className="text-muted-foreground mt-0.5">
                      Cliente, link, template e variáveis já foram preenchidos. Você só precisa anexar a nova lista de leads
                      {reusedMedia ? " — a mídia anterior será reutilizada automaticamente." : "."}
                    </p>
                  </div>
                </div>
              )}

              {reusedMedia && !mediaFile && (
                <div className="rounded-xl border border-border bg-input/50 p-3 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-bronze-metal flex items-center justify-center shrink-0">
                    <ImageIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Mídia reutilizada</p>
                    <p className="text-sm truncate">{reusedMedia.filename}</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reuseMedia}
                      onChange={(e) => setReuseMedia(e.target.checked)}
                      className="accent-[oklch(0.78_0.13_75)]"
                    />
                    Usar
                  </label>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <FileDrop
                  icon={<ImageIcon className="h-5 w-5 text-[oklch(0.84_0.14_80)]" />}
                  title="Mídia (Vídeo/Imagem) — Opcional"
                  subtitle="Arquivo de imagem ou vídeo"
                  accept="image/*,video/*"
                  formats="JPG, PNG, MP4, MOV (máx. 50MB)"
                  maxSizeMB={50}
                  file={mediaFile}
                  onFile={setMediaFile}
                />
                <FileDrop
                  icon={<FileSpreadsheet className="h-5 w-5 text-[oklch(0.84_0.14_80)]" />}
                  title="Leads"
                  subtitle="Lista de contatos para o disparo"
                  accept=".csv,.txt,.xlsx,.xls"
                  formats="CSV, TXT, XLS, XLSX (máx. 10MB)"
                  maxSizeMB={10}
                  file={leadsFile}
                  onFile={setLeadsFile}
                />
              </div>

              {leadsStats && (
                <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[oklch(0.84_0.14_80)]" />
                    <span className="text-sm font-semibold">Higienização da lista</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground ml-2">55+DDD+número · duplicados removidos</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    <Stat label="Total" value={leadsStats.total} tone="muted" />
                    <Stat label="Válidos" value={leadsStats.valid.length} tone="ok" />
                    <Stat label="Inválidos" value={leadsStats.invalid.length} tone="warn" />
                    <Stat label="Duplicados" value={leadsStats.duplicates} tone="muted" />
                  </div>

                  {/* Auto-filled, locked send count */}
                  <div className="rounded-lg border border-[oklch(0.7_0.12_75_/_0.45)] bg-[oklch(0.34_0.06_70_/_0.24)] p-4 flex items-center gap-4">
                    <Lock className="h-5 w-5 text-[oklch(0.84_0.14_80)] shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Quantidade de envios (higienizada)</p>
                      <p className="text-2xl font-bold text-[oklch(0.86_0.14_80)]">{sendCount.toLocaleString("pt-BR")}</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground hidden sm:block">
                      preenchido automaticamente
                    </span>
                  </div>

                  {leadsStats.invalid.length > 0 && (
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <details className="text-xs flex-1 min-w-0">
                        <summary className="cursor-pointer text-[oklch(0.85_0.18_75)] hover:underline">
                          Ver {leadsStats.invalid.length} número(s) inválido(s)
                        </summary>
                        <div className="mt-2 max-h-32 overflow-y-auto rounded-lg bg-input p-2 font-mono space-y-0.5">
                          {leadsStats.invalid.slice(0, 100).map((n, i) => (
                            <div key={i} className="text-muted-foreground">{n}</div>
                          ))}
                          {leadsStats.invalid.length > 100 && (
                            <div className="text-[10px] text-muted-foreground/70 pt-1">+ {leadsStats.invalid.length - 100} ocultos — exporte o CSV completo</div>
                          )}
                        </div>
                      </details>
                      <button
                        onClick={() => downloadCsv("leads-invalidos.csv", ["numero", ...leadsStats.invalid])}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs font-medium hover:bg-secondary"
                      >
                        <Download className="h-3.5 w-3.5" /> Exportar inválidos (.csv)
                      </button>
                    </div>
                  )}

                  <label className="flex items-start gap-3 rounded-lg border border-border bg-input/50 p-3 cursor-pointer">
                    <input
                      type="checkbox" checked={hygieneConfirmed}
                      onChange={(e) => setHygieneConfirmed(e.target.checked)}
                      className="mt-1 accent-[oklch(0.78_0.13_75)]"
                    />
                    <div className="text-xs">
                      <p className="font-semibold text-foreground flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-[oklch(0.84_0.14_80)]" />
                        Confirmo a higienização da lista
                      </p>
                      <p className="text-muted-foreground mt-0.5">
                        Confirmo que <strong>{sendCount.toLocaleString("pt-BR")}</strong> número(s) válido(s) serão disparados — duplicados e inválidos foram removidos.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {!leadsStats && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Envie um arquivo .csv ou .txt com os números (um por linha ou separados por vírgula). Vamos higienizar automaticamente.
                </p>
              )}
            </section>
          )}

          {step === 3 && (
            <section className="grid lg:grid-cols-[340px_1fr] gap-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* WhatsApp Preview */}
              <div className="flex flex-col items-center">
                <div className="w-full max-w-[320px] rounded-[2rem] border border-border bg-[#0b0b0b] p-2 shadow-xl">
                  <div className="rounded-[1.6rem] overflow-hidden bg-[oklch(0.14_0.01_60)]">
                    <div className="bg-[oklch(0.19_0.02_65)] px-4 py-3 flex items-center gap-3">
                      <ChevronLeft className="h-4 w-4 text-white/70" />
                      <div className="h-8 w-8 rounded-full bg-white/20 overflow-hidden flex items-center justify-center">
                        {activePhotoUrl
                          ? <img src={activePhotoUrl} alt="" className="h-full w-full object-cover" />
                          : <UserCircle2 className="h-6 w-6 text-white/60" />}
                      </div>
                      <div className="leading-tight">
                        <p className="text-sm text-white font-medium">{clientName || "Cliente"}</p>
                        <p className="text-[10px] text-white/70">online</p>
                      </div>
                    </div>
                    <div className="p-3 min-h-[340px] space-y-2">
                      <div className="inline-block max-w-[90%] rounded-2xl bg-[oklch(0.3_0.05_70)] text-foreground text-sm p-3 whitespace-pre-wrap break-words">
                        {renderedMessage || "Preencha as variáveis ao lado para visualizar..."}
                        {link && (
                          <div className="mt-2 pt-2 border-t border-white/15 text-[oklch(0.86_0.14_80)] text-xs flex items-center gap-1">
                            🔗 CLIQUE AQUI
                          </div>
                        )}
                        <div className="text-right text-[9px] text-white/60 mt-1">12:34 ✓✓</div>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" /> Pré-visualização do WhatsApp
                </p>
              </div>

              {/* Template fields */}
              <div className="space-y-4">
                {templates.length > 1 && (
                  <div className="card-premium p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Template fixo</p>
                    <div className="flex flex-wrap gap-2">
                      {templates.map((t) => (
                        <button key={t.id} onClick={() => { setTplId(t.id); setVarValues({}); }}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            tplId === t.id ? "bg-gold-metal" : "bg-secondary text-muted-foreground hover:text-foreground"
                          }`}>
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="card-premium p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-[oklch(0.32_0.07_70_/_0.35)] flex items-center justify-center">
                      <MessageCircle className="h-5 w-5 text-[oklch(0.84_0.14_80)]" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Monte a mensagem</h3>
                      <p className="text-xs text-muted-foreground">Template pré-aprovado — preencha cada variável</p>
                    </div>
                  </div>

                  {!activeTpl ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum template fixo disponível. Peça ao administrador para configurar em Admin → Templates.
                    </p>
                  ) : (
                    <>
                      <div className="rounded-lg bg-input border border-border p-3 font-mono text-xs whitespace-pre-wrap mb-5 text-muted-foreground">
                        {activeTpl.content}
                      </div>

                      <div className="space-y-4">
                        {(activeTpl.variables ?? []).map((v) => (
                          <div key={v.key}>
                            <label className="block text-sm font-medium mb-1.5">
                              <span className="font-mono text-[oklch(0.84_0.14_80)]">{`{{${v.key}}}`}</span>
                              {" "}— {v.label}
                              {v.optional && <span className="ml-2 text-xs text-muted-foreground">(opcional)</span>}
                            </label>
                            <input
                              value={varValues[v.key] ?? ""}
                              onChange={(e) => setVarValues({ ...varValues, [v.key]: e.target.value })}
                              placeholder={v.placeholder ? `Ex: ${v.placeholder}` : ""}
                              className="w-full bg-input border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Foto de perfil — apenas admin ou usuário autorizado */}
                {(isAdmin || canCustomizePhoto) && (
                  <div className="card-premium p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-xl bg-[oklch(0.32_0.07_70_/_0.35)] flex items-center justify-center">
                        <UserCircle2 className="h-5 w-5 text-[oklch(0.84_0.14_80)]" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold">Foto de perfil da campanha</h3>
                        <p className="text-xs text-muted-foreground">
                          Você tem permissão para usar uma foto personalizada.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-full bg-secondary overflow-hidden flex items-center justify-center shrink-0">
                        {activePhotoUrl
                          ? <img src={activePhotoUrl} alt="" className="h-full w-full object-cover" />
                          : <UserCircle2 className="h-10 w-10 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <label className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs font-medium hover:bg-secondary cursor-pointer">
                            <UploadCloud className="h-3.5 w-3.5" /> Enviar foto personalizada
                            <input type="file" accept="image/*" className="hidden"
                              onChange={(e) => setCustomPhotoFile(e.target.files?.[0] ?? null)} />
                          </label>
                          {customPhotoFile && (
                            <button onClick={() => setCustomPhotoFile(null)}
                              className="text-xs text-muted-foreground hover:text-foreground">Remover</button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Agendamento — cliente escolhe data e hora */}
                <div className="card-premium p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-[oklch(0.32_0.07_70_/_0.35)] flex items-center justify-center">
                      <Clock className="h-5 w-5 text-[oklch(0.84_0.14_80)]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold">Data e hora do disparo</h3>
                      <p className="text-xs text-muted-foreground">
                        Mínimo de 30 min de antecedência. Cada pedido precisa ter ao menos 30 min de diferença dos demais.
                      </p>
                    </div>
                  </div>

                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between gap-3 bg-input border border-border rounded-lg px-4 py-3 text-sm hover:border-[oklch(0.78_0.18_55_/_0.5)] transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-[oklch(0.84_0.14_80)]" />
                          {scheduledDateTime ? (
                            <span className="font-medium">{scheduledDateTime.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          ) : (
                            <span className="text-muted-foreground">Escolher data e horário</span>
                          )}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                      <div className="flex flex-col sm:flex-row">
                        <div className="p-2 border-b sm:border-b-0 sm:border-r border-border">
                          <Calendar
                            mode="single"
                            selected={scheduleDate ? new Date(`${scheduleDate}T00:00:00`) : undefined}
                            onSelect={(d) => {
                              if (!d) return;
                              const yyyy = d.getFullYear();
                              const mm = String(d.getMonth() + 1).padStart(2, "0");
                              const dd = String(d.getDate()).padStart(2, "0");
                              setScheduleDate(`${yyyy}-${mm}-${dd}`);
                            }}
                            disabled={(d) => {
                              const today = new Date(); today.setHours(0, 0, 0, 0);
                              return d < today;
                            }}
                            className="pointer-events-auto"
                          />
                        </div>
                        <div className="p-3 sm:w-[280px] max-h-[360px] overflow-y-auto">
                          <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span>Horários · 30 min cada</span>
                          </div>
                          {!scheduleDate ? (
                            <p className="text-xs text-muted-foreground">Selecione uma data primeiro.</p>
                          ) : (
                            <div className="grid grid-cols-3 gap-2">
                              {Array.from({ length: 30 }).map((_, idx) => {
                                const h = 7 + Math.floor(idx / 2);
                                const m = (idx % 2) * 30;
                                const hh = String(h).padStart(2, "0");
                                const mm = String(m).padStart(2, "0");
                                const slotTime = `${hh}:${mm}`;
                                const slotDate = new Date(`${scheduleDate}T${slotTime}:00`);
                                const minStart = Date.now() + 30 * 60 * 1000;
                                const tooSoon = slotDate.getTime() < minStart;
                                const occupied = busySlots.some((b) => Math.abs(b.getTime() - slotDate.getTime()) < 30 * 60 * 1000);
                                const selected = scheduleTime === slotTime;
                                const disabled = tooSoon || occupied;
                                return (
                                  <button
                                    key={slotTime}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => setScheduleTime(slotTime)}
                                    title={occupied ? "Ocupado" : tooSoon ? "Muito próximo" : "Disponível"}
                                    className={
                                      "rounded-md py-1.5 text-xs font-semibold border transition-colors " +
                                      (selected
                                        ? "border-[oklch(0.84_0.14_80)] bg-[oklch(0.84_0.14_80)] text-[oklch(0.2_0.02_70)]"
                                        : disabled
                                        ? "border-border bg-muted/30 text-muted-foreground/50 cursor-not-allowed line-through"
                                        : "border-emerald-700/50 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/40")
                                    }
                                  >
                                    {slotTime}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Disponível</span>
                            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/40" /> Ocupado</span>
                            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[oklch(0.84_0.14_80)]" /> Selecionado</span>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {scheduleError && (
                    <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/15 p-3 text-xs text-destructive">
                      {scheduleError}
                    </p>
                  )}
                  {scheduledDateTime && !scheduleError && (
                    <p className="mt-3 rounded-lg border border-[oklch(0.6_0.12_75_/_0.45)] bg-[oklch(0.34_0.06_70_/_0.18)] p-3 text-xs text-[oklch(0.86_0.14_80)]">
                      ✓ Horário disponível: {scheduledDateTime.toLocaleString("pt-BR")}
                    </p>
                  )}


                  <p className="mt-4 rounded-lg border border-[oklch(0.78_0.18_55_/_0.45)] bg-[oklch(0.34_0.1_55_/_0.18)] p-3 text-xs font-semibold text-[oklch(0.88_0.16_70)] uppercase tracking-wider">
                    ⚠️ Atenção: começa a contar o prazo para envio após o pagamento!
                  </p>
                </div>

              </div>
            </section>
          )}


          {step === 4 && (
            <section className="card-premium p-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <h3 className="font-display text-xl flex items-center gap-2">
                <Rocket className="h-5 w-5 text-[oklch(0.84_0.14_80)]" /> Revisão final
              </h3>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Row label="Cliente" value={clientName} />
                <Row label="Nicho" value={niches.find((n) => n.id === nicheId)?.name ?? "—"} />

                <Row label="Link" value={isRotatingLink ? `${cleanRotationLinks.length} links em rotação` : normalizedSingleLink} />
                <Row label="Envios" value={`${sendCount}`} />
                <Row label="Mídia" value={mediaFile?.name ?? "Nenhuma"} />
                <Row label="Template" value={activeTpl?.name ?? "—"} />
                <Row label="Foto de perfil" value={customPhotoFile ? "Personalizada" : "Padrão"} />
                <Row label="Template WhatsApp" value={waTemplates.find((t) => t.id === waTemplateId)?.name ?? "Admin escolhe na hora"} />
                <Row label="Agendado para" value={scheduledDateTime ? scheduledDateTime.toLocaleString("pt-BR") : "—"} />
                <Row label="Disparo" value="Manual após pagamento" />
              </dl>

              <p className="rounded-lg border border-[oklch(0.78_0.18_55_/_0.45)] bg-[oklch(0.34_0.1_55_/_0.18)] p-3 text-xs font-semibold text-[oklch(0.88_0.16_70)] uppercase tracking-wider">
                ⚠️ Atenção: começa a contar o prazo para envio após o pagamento!
              </p>


              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-[oklch(0.84_0.14_80)]" /> Resultado da higienização
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  <Stat label="Total" value={leadsStats?.total ?? 0} tone="muted" />
                  <Stat label="Válidos" value={leadsStats?.valid.length ?? 0} tone="ok" />
                  <Stat label="Inválidos" value={leadsStats?.invalid.length ?? 0} tone="warn" />
                  <Stat label="Duplicados" value={leadsStats?.duplicates ?? 0} tone="muted" />
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Mensagem final</p>
                <div className="rounded-lg bg-input border border-border p-4 text-sm whitespace-pre-wrap">
                  {renderedMessage}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border space-y-3">
          {submitError && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/15 p-3 text-xs text-destructive">
              {submitError}
            </p>
          )}
          <div className="flex items-center justify-between">
            <button
              onClick={() => (step === 1 ? onOpenChange(false) : setStep(step - 1))}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" /> {step === 1 ? "Cancelar" : "Voltar"}
            </button>
            <p className="text-xs text-muted-foreground">
              Etapa <strong className="text-foreground">{step}</strong> de {STEPS.length}
            </p>
            {step < STEPS.length ? (
              <button
                disabled={!canNext}
                onClick={() => setStep(step + 1)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gold-metal px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-transform hover:scale-[1.02]"
              >
                Continuar <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                disabled={submitting}
                onClick={submit}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gold-metal px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <Rocket className="h-4 w-4" /> Enviar pedido
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Small UI helpers
// ──────────────────────────────────────────────────────────────────────────────

function Field({ label, children, hint, className = "" }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "ok" | "warn" | "muted" }) {
  const cls =
    tone === "ok" ? "text-[oklch(0.86_0.14_80)]"
    : tone === "warn" ? "text-[oklch(0.78_0.18_55)]"
    : "text-foreground";
  return (
    <div className="rounded-lg bg-input p-3">
      <p className={`text-2xl font-bold ${cls}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-foreground mt-0.5 truncate">{value || "—"}</dd>
    </div>
  );
}

function FileDrop({
  icon, title, subtitle, accept, formats, file, onFile, maxSizeMB,
}: {
  icon: React.ReactNode; title: string; subtitle: string; accept: string; formats: string;
  file: File | null; onFile: (f: File | null) => void; maxSizeMB?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handlePick = (f: File | null) => {
    setError(null);
    if (!f) { onFile(null); return; }
    if (maxSizeMB && f.size > maxSizeMB * 1024 * 1024) {
      setError(`Arquivo muito grande (${(f.size / 1024 / 1024).toFixed(1)}MB). Máx. ${maxSizeMB}MB.`);
      return;
    }
    onFile(f);
  };

  const sizeLabel = file
    ? file.size > 1024 * 1024
      ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
      : `${(file.size / 1024).toFixed(1)} KB`
    : "";
  const isImage = file?.type.startsWith("image/");
  const isVideo = file?.type.startsWith("video/");

  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-3 sm:p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-9 w-9 rounded-lg bg-[oklch(0.32_0.07_70_/_0.35)] flex items-center justify-center shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <input
        ref={ref} type="file" accept={accept} className="hidden"
        onChange={(e) => handlePick(e.target.files?.[0] ?? null)}
      />
      {!file ? (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handlePick(e.dataTransfer.files?.[0] ?? null);
          }}
          className={`w-full rounded-xl border-2 border-dashed py-7 sm:py-10 px-3 flex flex-col items-center gap-1.5 transition-colors ${
            dragOver
              ? "border-[oklch(0.84_0.14_80)] bg-[oklch(0.34_0.06_70_/_0.2)]"
              : "border-border bg-input/40 hover:border-[oklch(0.75_0.13_75)]"
          }`}
        >
          <UploadCloud className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">Toque para enviar</p>
          <p className="text-[11px] text-muted-foreground hidden sm:block">ou arraste o arquivo aqui</p>
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-input p-2.5 sm:p-3">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-md overflow-hidden bg-bronze-metal flex items-center justify-center shrink-0">
            {isImage && preview ? (
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : isVideo ? (
              <ImageIcon className="h-5 w-5" />
            ) : (
              <FileSpreadsheet className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm truncate">{file.name}</p>
            <p className="text-[11px] text-muted-foreground">{sizeLabel}</p>
            <button
              type="button"
              onClick={() => ref.current?.click()}
              className="mt-1 text-[11px] text-[oklch(0.84_0.14_80)] hover:underline"
            >
              Trocar arquivo
            </button>
          </div>
          <button
            type="button"
            onClick={() => { handlePick(null); if (ref.current) ref.current.value = ""; }}
            aria-label="Remover arquivo"
            className="p-2 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {error ? (
        <p className="mt-2 text-[11px] text-[oklch(0.78_0.18_30)] text-center">{error}</p>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground text-center">Formatos: {formats}</p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Repeat campaign picker
// ──────────────────────────────────────────────────────────────────────────────

type RepeatRow = {
  id: string;
  name: string | null;
  link: string | null;
  template_id: string | null;
  template_data: any;
  send_count: number | null;
  created_at: string;
};

function RepeatPicker({
  open, onOpenChange, onPick,
}: { open: boolean; onOpenChange: (v: boolean) => void; onPick: (p: WizardPreset) => void }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<RepeatRow[]>([]);
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("id, name, link, template_id, template_data, send_count, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      setRows((data as any) ?? []);
      const { data: tpl } = await supabase.from("message_templates").select("id, name");
      const map: Record<string, string> = {};
      ((tpl as any[]) ?? []).forEach((t) => { map[t.id] = t.name; });
      setTemplates(map);
      setLoading(false);
    })();
  }, [open, user]);

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (r.name ?? "").toLowerCase().includes(s) || (r.link ?? "").toLowerCase().includes(s);
  });

  const pick = async (row: RepeatRow) => {
    setBusyId(row.id);
    try {
      const td = (row.template_data ?? {}) as any;
      const isRotation = td.link_mode === "rotation";
      const links: string[] = Array.isArray(td.links) ? td.links.filter(Boolean) : [];
      const singleLink = !isRotation ? (links[0] ?? row.link ?? "") : "";
      const rotationLinks = isRotation
        ? (links.length >= 2 ? links : ["", ""])
        : ["", ""];

      const varValues: Record<string, string> = {};
      Object.entries(td).forEach(([k, v]) => {
        if (k === "link_mode" || k === "links") return;
        if (typeof v === "string") varValues[k] = v;
      });

      const { data: mediaRow } = await supabase
        .from("campaign_files")
        .select("storage_path, filename, mime, size_bytes")
        .eq("campaign_id", row.id)
        .eq("kind", "media")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const preset: WizardPreset = {
        sourceCampaignId: row.id,
        sourceCampaignName: row.name ?? "Campanha anterior",
        clientName: row.name ?? "",
        isRotatingLink: isRotation,
        link: singleLink,
        rotationLinks,
        tplId: row.template_id,
        varValues,
        media: mediaRow ? {
          storagePath: (mediaRow as any).storage_path,
          filename: (mediaRow as any).filename,
          mime: (mediaRow as any).mime ?? null,
          sizeBytes: (mediaRow as any).size_bytes ?? null,
        } : null,
      };
      onPick(preset);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 bg-card border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-display text-xl flex items-center gap-2">
            <Repeat className="h-5 w-5 text-[oklch(0.84_0.14_80)]" /> Repetir uma campanha
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Escolha uma campanha anterior — os dados e o template são reutilizados. Você só anexa a nova lista de leads.
          </p>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome ou link..."
              className="w-full bg-input border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Loader2 className="mx-auto h-5 w-5 animate-spin mb-2" /> Carregando suas campanhas...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 px-6">
              <div className="mx-auto h-12 w-12 rounded-full bg-secondary/50 flex items-center justify-center mb-3">
                <Repeat className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {rows.length === 0 ? "Você ainda não tem campanhas para repetir." : "Nenhum resultado para a busca."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((r) => {
                const tplName = r.template_id ? templates[r.template_id] : null;
                const date = new Date(r.created_at).toLocaleDateString("pt-BR");
                return (
                  <li key={r.id}>
                    <button
                      disabled={busyId !== null}
                      onClick={() => pick(r)}
                      className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-secondary/40 transition-colors disabled:opacity-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{r.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.link ?? "Sem link"}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                          <Clock className="h-3 w-3" /> {date}
                          {tplName && <span>· {tplName}</span>}
                          {r.send_count ? <span>· {r.send_count} envios</span> : null}
                        </p>
                      </div>
                      {busyId === r.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[oklch(0.84_0.14_80)]" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


