import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  getMySubscription,
  createSubscriberLink,
  createSubscriberRotatingLink,
  listMySubscriberLinks,
  getMyLinkMetrics,
  updateSubscriberLinkTarget,
  updateSubscriberLinkRotation,
  convertSubscriberLinkToSingle,
  deleteMySubscriberLink,
} from "@/lib/link-subscribers.functions";
import { cancelSubscriberBilling } from "@/lib/billing.functions";
import {
  createAsgardPixCharge,
  getAsgardChargeStatus,
} from "@/lib/asgard-billing.functions";
import {
  Loader2, Copy, Check, ExternalLink, BarChart3, X, LogOut, Link2, AlertTriangle, Pencil, Plus, Trash2, Shuffle, HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import logoAsset from "@/assets/zpclik-logo.png.asset.json";

export const Route = createFileRoute("/clientes/dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Meu Painel — zpclik" }, { name: "robots", content: "noindex,nofollow" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/clientes" });
  },
  component: ClientesDashboard,
});

interface Sub {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  status: string;
  current_period_end: string | null;
  last_payment_at: string | null;
  plan_price_cents: number;
}

interface RotationUrl { url: string; weight: number; sort_order: number }
interface MyLink {
  id: string;
  slug: string;
  target_url: string | null;
  label: string | null;
  click_count: number;
  status: string;
  created_at: string;
  last_clicked_at: string | null;
  is_rotating: boolean;
  rotation_mode: "round_robin" | "random" | "weighted" | "sticky";
  short_link_urls: RotationUrl[];
}

type RotationMode = "round_robin" | "random" | "weighted" | "sticky";
const ROTATION_LABELS: Record<RotationMode, string> = {
  round_robin: "Revezar um por um (1 → 2 → 3 → 1)",
  random: "Sortear aleatoriamente",
  weighted: "Distribuir por peso (%)",
  sticky: "Sempre o 1º destino",
};

const ROTATION_HELP: Record<RotationMode, string> = {
  round_robin:
    "Com 3 números cadastrados: clique 1 vai pro 1º, clique 2 pro 2º, clique 3 pro 3º, clique 4 volta pro 1º. Ideal para dividir atendimento igualmente.",
  random:
    "Cada clique sorteia um destino. Com 3 números, cada um fica com cerca de 33% de chance. Bom para testes ou distribuição natural.",
  weighted:
    "Você define pesos para cada destino. Se colocar 70 no 1º e 30 no 2º, aproximadamente 70% dos cliques vão para o 1º e 30% para o 2º. A soma dos pesos não precisa ser 100.",
  sticky:
    "Todos os cliques caem no primeiro destino da lista. Se ele for bloqueado, basta trocar o 1º lugar aqui no painel — o link curto continua o mesmo.",
};

const ROTATION_EXAMPLES: Record<RotationMode, string> = {
  round_robin: "Ex.: revezar 10 números de WhatsApp para não sobrecarregar um atendente.",
  random: "Ex.: mandar leads para 5 vendedores sem ordem definida.",
  weighted: "Ex.: 70% dos cliques para o vendedor sênior e 30% para o estagiário.",
  sticky: "Ex.: usar um link em uma campanha e trocar o destino sem reimprimir material.",
};

function InlineTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block align-middle ml-1">
      <button
        type="button"
        aria-label="Ajuda"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="rounded-full p-0.5 text-muted-foreground/70 hover:text-amber-500 focus:outline-none"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 sm:w-64 rounded-lg bg-secondary px-3 py-2 text-xs text-white shadow-lg z-50">
          {text}
          <span className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-secondary" />
        </span>
      )}
    </span>
  );
}

const PIX_KEY = "iarachorta@gmail.com";

function getProviderQrImageSrc(qrcode: string | null | undefined): string | null {
  const value = (qrcode ?? "").trim();
  if (!value) return null;
  if (value.startsWith("data:image/") || value.startsWith("blob:") || value.startsWith("http")) return value;
  if (value.startsWith("<svg")) return `data:image/svg+xml;utf8,${encodeURIComponent(value)}`;
  if (value.startsWith("000201") || value.toLowerCase().includes("br.gov.bcb.pix")) return null;
  if (/^[A-Za-z0-9+/=\s]+$/.test(value) && value.length > 120) {
    return `data:image/png;base64,${value.replace(/\s+/g, "")}`;
  }
  return null;
}

function getPixPayloadForQr(copyPaste: string | null | undefined, qrcode: string | null | undefined): string | null {
  const copy = (copyPaste ?? "").trim();
  if (copy) return copy;
  const qr = (qrcode ?? "").trim();
  if (qr.startsWith("000201") || qr.toLowerCase().includes("br.gov.bcb.pix")) return qr;
  return null;
}

function normalizePhone(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D+/g, "");
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return null;
}

function buildWaUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function parseWaUrl(url: string | null): { phone: string; message: string } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname !== "wa.me") return null;
    const phone = u.pathname.replace(/^\/+/, "");
    const message = u.searchParams.get("text") ?? "";
    return { phone, message };
  } catch { return null; }
}

type RotRow = { kind: "url" | "whatsapp"; url: string; phone: string; message: string; weight: number };

function emptyRotRow(kind: RotRow["kind"] = "url"): RotRow {
  return { kind, url: "", phone: "", message: "", weight: 1 };
}

function rowToFinalUrl(row: RotRow): { ok: true; url: string } | { ok: false; reason: string } {
  if (row.kind === "whatsapp") {
    const p = normalizePhone(row.phone);
    if (!p) return { ok: false, reason: "Número de WhatsApp inválido — use DDD + número" };
    return { ok: true, url: buildWaUrl(p, row.message) };
  }
  const t = row.url.trim();
  if (!t) return { ok: false, reason: "URL vazia" };
  return { ok: true, url: t };
}

function urlToRow(u: string, weight: number): RotRow {
  const wa = parseWaUrl(u);
  if (wa) return { kind: "whatsapp", url: "", phone: wa.phone, message: wa.message, weight };
  return { kind: "url", url: u, phone: "", message: "", weight };
}

function ClientesDashboard() {
  const navigate = useNavigate();
  const [sub, setSub] = useState<Sub | null>(null);
  const [links, setLinks] = useState<MyLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [mode, setMode] = useState<"normal" | "whatsapp" | "rotating">("normal");
  const [targetUrl, setTargetUrl] = useState("");
  const [waPhone, setWaPhone] = useState("");
  const [waMsg, setWaMsg] = useState("");
  const [label, setLabel] = useState("");
  const [rotMode, setRotMode] = useState<RotationMode>("round_robin");
  const [rotUrls, setRotUrls] = useState<RotRow[]>([
    emptyRotRow("whatsapp"), emptyRotRow("whatsapp"),
  ]);
  const [creating, setCreating] = useState(false);

  const [copied, setCopied] = useState<string | null>(null);
  const [metricsFor, setMetricsFor] = useState<MyLink | null>(null);
  const [editingFor, setEditingFor] = useState<MyLink | null>(null);

  const getSub = useServerFn(getMySubscription);
  const listLinks = useServerFn(listMySubscriberLinks);
  const createLink = useServerFn(createSubscriberLink);
  const createRotating = useServerFn(createSubscriberRotatingLink);
  const cancelBilling = useServerFn(cancelSubscriberBilling);
  const [billingLoading, setBillingLoading] = useState(false);
  const createPix = useServerFn(createAsgardPixCharge);
  const checkPix = useServerFn(getAsgardChargeStatus);
  const [pixModal, setPixModal] = useState<{ orderId: string; copyPaste: string | null; qrcode: string | null; amount: number } | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [pixChecking, setPixChecking] = useState(false);
  const [pixQrDataUrl, setPixQrDataUrl] = useState<string | null>(null);
  // Timer de expiração do PIX (5 min a partir da criação).
  const [pixCreatedAt, setPixCreatedAt] = useState<number | null>(null);
  const [pixExpiresInSec, setPixExpiresInSec] = useState<number>(5 * 60);
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!pixModal) return;
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [pixModal]);
  const pixSecondsLeft = pixCreatedAt
    ? Math.max(0, Math.ceil((pixCreatedAt + pixExpiresInSec * 1000 - nowTs) / 1000))
    : 0;
  const pixExpired = pixCreatedAt !== null && pixSecondsLeft === 0;

  // Modal de exclusão de link
  const deleteLinkFn = useServerFn(deleteMySubscriberLink);
  const [deletingFor, setDeletingFor] = useState<MyLink | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (!pixModal) { setPixQrDataUrl(null); return; }
    const payload = getPixPayloadForQr(pixModal.copyPaste, pixModal.qrcode);
    if (!payload) { setPixQrDataUrl(null); return; }
    let cancelled = false;
    QRCode.toDataURL(payload, { width: 320, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => { if (!cancelled) setPixQrDataUrl(url); })
      .catch(() => { if (!cancelled) setPixQrDataUrl(null); });
    return () => { cancelled = true; };
  }, [pixModal]);

  const active = useMemo(() => {
    if (!sub) return false;
    // Comparação em TZ Brasília — evita marcar "vencido" 3h antes por causa do UTC.
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const okStatus = sub.status === "active" || sub.status === "trialing";
    return okStatus && !!sub.current_period_end && sub.current_period_end >= today;
  }, [sub]);

  // Teste grátis: usuário em `trialing` com período ainda vigente.
  const trialing = useMemo(() => {
    if (!sub || sub.status !== "trialing" || !sub.current_period_end) return false;
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    return sub.current_period_end >= today;
  }, [sub]);

  // Contagem de links por tipo — usado pra exibir limites do teste grátis.
  const trialUsage = useMemo(() => {
    let normal = 0, wa = 0, rot = 0;
    for (const l of links) {
      if (l.is_rotating) rot++;
      else if ((l.target_url ?? "").startsWith("https://wa.me/")) wa++;
      else normal++;
    }
    return { normal, whatsapp: wa, rotating: rot };
  }, [links]);

  // Alertas de vencimento / bloqueio por atraso
  const { daysUntilEnd, daysOverdue, expiringSoon, locked } = useMemo(() => {
    if (!sub?.current_period_end) {
      return { daysUntilEnd: null as number | null, daysOverdue: 0, expiringSoon: false, locked: sub?.status !== "active" };
    }
    const MS = 24 * 60 * 60 * 1000;
    // Ambos os lados em TZ Brasília (ISO YYYY-MM-DD).
    const todayIso = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const today = new Date(todayIso + "T00:00:00");
    const end = new Date(sub.current_period_end + "T00:00:00");
    const diffDays = Math.floor((end.getTime() - today.getTime()) / MS);
    const overdue = diffDays < 0 ? -diffDays : 0;
    return {
      daysUntilEnd: diffDays,
      daysOverdue: overdue,
      expiringSoon: diffDays >= 0 && diffDays <= 3 && sub.status === "active",
      locked: overdue > 3 || sub.status === "suspended",
    };
  }, [sub]);

  // PIX sem CPF (política V1.0 — menos fricção pra pagar).
  const requestPix = async (): Promise<any | null> => {
    return await createPix();
  };

  const openInvoiceAuto = async () => {
    setBillingLoading(true);
    try {
      console.log("[assinar] click — solicitando PIX…");
      const r: any = await requestPix();
      console.log("[assinar] resposta PIX", r);
      if (r?.orderId) {
        setPixModal({
          orderId: String(r.orderId),
          copyPaste: r.copyPaste ?? null,
          qrcode: r.qrcode ?? null,
          amount: Number(r.amount ?? 19.9),
        });
        setPixCreatedAt(r.createdAt ? new Date(r.createdAt).getTime() : Date.now());
        setPixExpiresInSec(Number(r.expiresInSec) > 0 ? Number(r.expiresInSec) : 5 * 60);
        setNowTs(Date.now());
        setPixCopied(false);
      } else if (r !== null) {
        toast.error("Não foi possível gerar o PIX agora — tente de novo em instantes.");
      }
    } catch (e: any) {
      console.error("[assinar] falhou", e);
      const msg = typeof e === "string"
        ? e
        : (e?.message || e?.error || (e ? JSON.stringify(e).slice(0, 200) : "") || "Falha ao gerar cobrança PIX. Tente novamente em instantes.");
      toast.error(msg);
    } finally {
      setBillingLoading(false);
    }
  };

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const s: any = await getSub({});
      setSub(s.subscription);
      const l: any = await listLinks({});
      setLinks(l.links ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Erro ao carregar");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const doCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active) return;
    setCreating(true);
    try {
      if (mode === "rotating") {
        const urls: { url: string; weight: number }[] = [];
        for (const row of rotUrls) {
          const res = rowToFinalUrl(row);
          if (!res.ok) {
            if (row.kind === "whatsapp" || row.url.trim().length > 0) {
              toast.error(res.reason);
              setCreating(false); return;
            }
            continue;
          }
          urls.push({ url: res.url, weight: Math.max(0, Math.floor(row.weight)) });
        }
        if (urls.length < 2) {
          toast.error("Adicione pelo menos 2 destinos para rotação.");
          setCreating(false); return;
        }
        const r: any = await createRotating({ data: { label: label || null, rotation_mode: rotMode, urls } });
        toast.success(`Link rotativo criado: ${r.url}`);
        setRotUrls([emptyRotRow("whatsapp"), emptyRotRow("whatsapp")]);
        setRotMode("round_robin");
      } else {
        let finalUrl = targetUrl;
        if (mode === "whatsapp") {
          const phone = normalizePhone(waPhone);
          if (!phone) {
            toast.error("Número de WhatsApp inválido — use DDD + número");
            setCreating(false); return;
          }
          finalUrl = buildWaUrl(phone, waMsg);
        }
        const r: any = await createLink({ data: { target_url: finalUrl, label: label || null } });
        toast.success(`Link criado: ${r.url}`);
      }
      setTargetUrl(""); setLabel(""); setWaPhone(""); setWaMsg("");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou");
    } finally { setCreating(false); }
  };

  const copyLink = async (slug: string) => {
    const url = `https://www.zpclik.site/r/${slug}`;
    try { await navigator.clipboard.writeText(url); setCopied(slug); setTimeout(() => setCopied(null), 1500); } catch {}
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/clientes" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-[oklch(0.32_0.04_80/_0.25)] bg-[oklch(0.12_0.008_60/_0.85)] backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoAsset.url} alt="zpclik" className="h-9 w-9 rounded-lg object-cover ring-1 ring-[oklch(0.5_0.1_80/_0.4)]" />
            <span className="font-display text-lg tracking-wide">
              <span className="text-gold-gradient">zp</span>clik
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{sub?.email ?? sub?.name ?? ""}</span>
            <button onClick={signOut} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {err && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : (
          <>
            {/* Subscription status */}
            {(() => {
              const status = sub?.status ?? "pending_payment";
              const isActive = active;
              const isSuspended = status === "suspended";
              // Reaproveita o mesmo fluxo do bloqueio — configura orderId, timer 5min, etc.
              const openInvoice = openInvoiceAuto;
              const doCancel = async () => {
                if (!confirm("Cancelar sua assinatura? O acesso é interrompido.")) return;
                setBillingLoading(true);
                try {
                  await cancelBilling({});
                  toast.success("Assinatura cancelada");
                  await load();
                } catch (e: any) {
                  toast.error(e?.message ?? "Erro ao cancelar");
                } finally {
                  setBillingLoading(false);
                }
              };
              const boxCls = trialing
                ? "bg-sky-50 border-sky-200"
                : isActive
                ? "bg-emerald-50 border-emerald-200"
                : isSuspended
                  ? "bg-red-50 border-red-200"
                  : "bg-amber-50 border-amber-200";
              return (
                <section className={`rounded-2xl border p-6 ${boxCls}`}>
                  {trialing ? (
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold text-sky-900 flex items-center gap-2">
                          🎁 Teste grátis ativo
                          {daysUntilEnd !== null && (
                            <span className="text-xs font-normal text-sky-800">
                              {daysUntilEnd === 0 ? "expira hoje" : daysUntilEnd === 1 ? "expira amanhã" : `${daysUntilEnd} dias restantes`}
                            </span>
                          )}
                        </h2>
                        <p className="text-sm text-sky-900 mt-1">
                          Você pode criar <strong>1 link normal</strong>, <strong>1 link de WhatsApp</strong> e <strong>1 link rotativo</strong> (com até 5 destinos) enquanto testa.
                        </p>
                        <p className="text-xs text-sky-800/80 mt-1">
                          Usados: {trialUsage.normal}/1 normal · {trialUsage.whatsapp}/1 WhatsApp · {trialUsage.rotating}/1 rotativo
                        </p>
                        <button
                          onClick={openInvoice}
                          disabled={billingLoading}
                          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-sky-700 hover:bg-sky-800 disabled:opacity-60 text-white text-sm font-medium px-4 py-2"
                        >
                          {billingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                          Assinar agora — R$ 19,90/mês
                        </button>
                      </div>
                    </div>
                  ) : isActive ? (
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold text-emerald-900">
                          {expiringSoon ? "Sua assinatura vence em breve" : "Assinatura ativa"}
                        </h2>
                        <p className="text-sm text-emerald-800 mt-1">
                          Válida até <strong>{new Date(sub!.current_period_end! + "T00:00:00").toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</strong>
                          {expiringSoon && daysUntilEnd !== null && (
                            <> — {daysUntilEnd === 0 ? "vence hoje" : daysUntilEnd === 1 ? "vence amanhã" : `faltam ${daysUntilEnd} dias`}.</>
                          )}
                        </p>
                        {expiringSoon && (
                          <button
                            onClick={openInvoice}
                            disabled={billingLoading}
                            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-medium px-4 py-2"
                          >
                            {billingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                            Antecipar renovação — R$ 19,90
                          </button>
                        )}
                      </div>
                      <button
                        onClick={doCancel}
                        disabled={billingLoading}
                        className="text-xs text-emerald-900/70 hover:text-emerald-900 underline underline-offset-2 disabled:opacity-50"
                      >Cancelar assinatura</button>
                    </div>
                  ) : isSuspended ? (
                    <div>
                      <div className="flex items-center gap-2 text-red-900 font-semibold">
                        <AlertTriangle className="h-5 w-5" /> Assinatura suspensa
                      </div>
                      <p className="text-sm text-red-900 mt-2">
                        Reative pagando a próxima fatura — R$ 19,90/mês (PIX, cartão ou boleto).
                      </p>
                      <button
                        onClick={openInvoice}
                        disabled={billingLoading}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-700 hover:bg-red-800 disabled:opacity-60 text-white text-sm font-medium px-4 py-2"
                      >
                        {billingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                        Reativar por R$ 19,90
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 text-amber-900 font-semibold">
                        <AlertTriangle className="h-5 w-5" />
                        {daysOverdue > 0
                          ? `Assinatura vencida há ${daysOverdue} ${daysOverdue === 1 ? "dia" : "dias"}`
                          : "Sua assinatura precisa de pagamento"}
                      </div>
                      <p className="text-sm text-amber-900 mt-2">
                        {daysOverdue > 0
                          ? `Pague R$ 19,90 via PIX para reativar. Após 3 dias de atraso o painel é bloqueado.`
                          : "R$ 19,90/mês — pague via PIX pra ativar sua conta."}
                      </p>
                      <button
                        onClick={openInvoice}
                        disabled={billingLoading}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2"
                      >
                        {billingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                        Pagar R$ 19,90
                      </button>
                    </div>
                  )}
                </section>
              );
            })()}


            {/* Create form */}
            <section className="card-premium rounded-2xl p-6">
              <h2 className="font-semibold text-foreground">Criar novo link</h2>
              {!active && (
                <p className="text-xs text-amber-800 mt-1">
                  Formulário desabilitado — regularize o pagamento para criar novos links.
                </p>
              )}

              <div className="mt-4 inline-flex flex-wrap rounded-lg border border-border p-1 bg-background">
                <button
                  type="button"
                  disabled={!active}
                  onClick={() => setMode("normal")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md ${mode === "normal" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
                >Link normal</button>
                <button
                  type="button"
                  disabled={!active}
                  onClick={() => setMode("whatsapp")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md ${mode === "whatsapp" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
                >Link de WhatsApp</button>
                <button
                  type="button"
                  disabled={!active}
                  onClick={() => setMode("rotating")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1 ${mode === "rotating" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
                ><Shuffle className="h-3.5 w-3.5" /> Link rotativo</button>
              </div>

              <form onSubmit={doCreate} className="mt-4 space-y-3">
                {mode === "normal" && (
                  <div className="grid gap-3 sm:grid-cols-[1fr,220px,auto]">
                    <input
                      disabled={!active}
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      placeholder="https://sua-url-de-destino.com"
                      required
                      type="url"
                      className="rounded-lg border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 disabled:bg-secondary"
                    />
                    <input
                      disabled={!active}
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="Rótulo (opcional)"
                      className="rounded-lg border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 disabled:bg-secondary"
                    />
                    <button
                      type="submit" disabled={!active || creating}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold-metal text-[#12100a] hover:brightness-110 px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                    >
                      {creating && <Loader2 className="h-4 w-4 animate-spin" />} Criar link
                    </button>
                  </div>
                )}
                {mode === "whatsapp" && (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        disabled={!active}
                        value={waPhone}
                        onChange={(e) => setWaPhone(e.target.value)}
                        placeholder="Ex: 11 91234-5678"
                        required
                        type="tel"
                        className="rounded-lg border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 disabled:bg-secondary"
                      />
                      <input
                        disabled={!active}
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder="Rótulo (opcional)"
                        className="rounded-lg border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 disabled:bg-secondary"
                      />
                    </div>
                    <textarea
                      disabled={!active}
                      value={waMsg}
                      onChange={(e) => setWaMsg(e.target.value)}
                      placeholder="Mensagem pré-preenchida quando abrirem o link"
                      rows={3}
                      className="w-full rounded-lg border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 disabled:bg-secondary"
                    />
                    <button
                      type="submit" disabled={!active || creating}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold-metal text-[#12100a] hover:brightness-110 px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                    >
                      {creating && <Loader2 className="h-4 w-4 animate-spin" />} Criar link de WhatsApp
                    </button>
                  </div>
                )}
                {mode === "rotating" && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Um único link curto que aponta pra vários destinos. A cada clique, o sistema decide pra onde mandar seguindo a regra que você escolher abaixo — ótimo pra revezar números de WhatsApp ou dividir tráfego entre páginas.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium text-foreground/90 flex items-center">
                          Como o link deve revezar os destinos?
                          <InlineTooltip text="Escolha a regra que decide para qual destino cada clique vai. Você pode trocar a regra a qualquer momento sem mudar o link curto." />
                        </label>
                        <select
                          disabled={!active}
                          value={rotMode}
                          onChange={(e) => setRotMode(e.target.value as RotationMode)}
                          className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground disabled:bg-secondary"
                        >
                          {(Object.keys(ROTATION_LABELS) as RotationMode[]).map((m) => (
                            <option key={m} value={m}>{ROTATION_LABELS[m]}</option>
                          ))}
                        </select>
                        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{ROTATION_HELP[rotMode]}</p>
                        <p className="mt-1 text-[11px] leading-snug text-amber-600 font-medium">{ROTATION_EXAMPLES[rotMode]}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground/90">Rótulo (opcional)</label>
                        <input
                          disabled={!active}
                          value={label}
                          onChange={(e) => setLabel(e.target.value)}
                          placeholder="Ex: Campanha janeiro"
                          className="mt-1 w-full rounded-lg border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 disabled:bg-secondary"
                        />
                      </div>
                    </div>
                    <RotationRowsEditor
                      rows={rotUrls}
                      setRows={setRotUrls}
                      disabled={!active}
                      showWeight={rotMode === "weighted"}
                    />
                    <button
                      type="submit" disabled={!active || creating}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold-metal text-[#12100a] hover:brightness-110 px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                    >
                      {creating && <Loader2 className="h-4 w-4 animate-spin" />} Criar link rotativo
                    </button>
                  </div>
                )}
              </form>
            </section>

            {/* Links list */}
            <section className="card-premium rounded-2xl">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-foreground">Meus links</h2>
                <span className="text-xs text-muted-foreground">{links.length} {links.length === 1 ? "link" : "links"}</span>
              </div>
              {links.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">Nenhum link ainda.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {links.map((l) => {
                    const short = `www.zpclik.site/r/${l.slug}`;
                    return (
                      <li key={l.id} className="px-6 py-4 flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-foreground flex items-center gap-2">
                            {short}
                            {l.is_rotating && (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-primary bg-primary/10 rounded px-1.5 py-0.5">
                                <Shuffle className="h-3 w-3" /> {ROTATION_LABELS[l.rotation_mode] ?? l.rotation_mode}
                              </span>
                            )}
                          </div>
                          {l.is_rotating ? (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {l.label ? <span className="mr-2 text-foreground/90">[{l.label}]</span> : null}
                              → {l.short_link_urls?.length ?? 0} URLs em rotação
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground truncate max-w-md">
                              {l.label ? <span className="mr-2 text-foreground/90">[{l.label}]</span> : null}
                              → {l.target_url ?? "—"}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => copyLink(l.slug)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1"
                        >
                          {copied === l.slug ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                          Copiar
                        </button>
                        <a
                          href={`https://${short}`} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Abrir
                        </a>
                        <button
                          onClick={() => setEditingFor(l)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </button>
                        <button
                          onClick={() => setMetricsFor(l)}
                          className="inline-flex items-center gap-1 text-xs text-white bg-gold-metal hover:brightness-110 rounded px-2.5 py-1"
                        >
                          <BarChart3 className="h-3.5 w-3.5" /> Ver métricas
                        </button>
                        <button
                          onClick={() => { setDeletingFor(l); setDeleteConfirmText(""); }}
                          className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-white hover:bg-red-600 border border-red-200 rounded px-2 py-1"
                          title="Excluir link"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <p className="text-xs text-muted-foreground text-center">
              Apenas acessos reais são contabilizados — tráfego de robôs e crawlers é filtrado automaticamente.
              {" "}<a href="/" className="underline">Início</a>
            </p>
          </>
        )}
      </main>

      {metricsFor && (
        <MetricsModal link={metricsFor} onClose={() => setMetricsFor(null)} />
      )}
      {locked && !pixModal && !loading && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-2xl border-2 border-red-200">
            <div className="flex items-center gap-2 text-red-700 font-semibold">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg">Acesso bloqueado</h3>
            </div>
            <p className="text-sm text-foreground/90 mt-3">
              {sub?.status === "suspended"
                ? "Sua assinatura está suspensa."
                : `Sua assinatura está com ${daysOverdue} dias de atraso.`}
              {" "}Pra desbloquear o painel e voltar a usar seus links, gere e pague um PIX de R$ 19,90.
            </p>
            <button
              onClick={openInvoiceAuto}
              disabled={billingLoading}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-red-700 hover:bg-red-800 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5"
            >
              {billingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Gerar PIX de R$ 19,90
            </button>
            <button
              onClick={signOut}
              className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground py-1.5"
            >Sair</button>
          </div>
        </div>
      )}
      {pixModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPixModal(null)}>
          <div className="bg-card rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Pague R$ {pixModal.amount.toFixed(2).replace(".", ",")} via PIX</h3>
                <p className="text-xs text-muted-foreground mt-1">Sua assinatura é ativada automaticamente após a confirmação.</p>
              </div>
              <button onClick={() => setPixModal(null)} className="text-muted-foreground/70 hover:text-foreground/90 text-xl leading-none">×</button>
            </div>
            {(() => {
              const src = getProviderQrImageSrc(pixModal.qrcode) ?? pixQrDataUrl;
              return src ? (
                <div className="mt-4 flex justify-center">
                  <img src={src} alt="QR Code PIX" className="w-56 h-56 rounded-lg border border-border" />
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 text-center">
                  QR Code carregando. Se não aparecer, use o código copia-e-cola abaixo.
                </div>
              );
            })()}
            {pixModal.copyPaste && (
              <div className="mt-4">
                <label className="text-xs font-medium text-foreground/90">Código copia-e-cola</label>
                <textarea
                  readOnly
                  value={pixModal.copyPaste}
                  className="mt-1 w-full h-24 rounded-lg border border-border bg-background p-2 text-xs font-mono resize-none"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(pixModal.copyPaste!);
                      setPixCopied(true);
                      setTimeout(() => setPixCopied(false), 2500);
                    } catch { toast.error("Copie manualmente"); }
                  }}
                  className="mt-2 w-full rounded-lg bg-secondary hover:bg-secondary/80 text-white text-sm font-medium py-2"
                >{pixCopied ? "Copiado ✓" : "Copiar código PIX"}</button>
              </div>
            )}
            <button
              onClick={async () => {
                setPixChecking(true);
                try {
                  const r: any = await checkPix({ data: { orderId: pixModal.orderId } });
                  if (r?.status === "completed") {
                    toast.success("Pagamento confirmado! Assinatura ativada.");
                    setPixModal(null);
                    await load();
                  } else {
                    toast.message("Ainda não recebemos a confirmação. Assim que o PIX cair, sua assinatura é liberada automaticamente.");
                  }
                } catch (e: any) {
                  toast.error(e?.message ?? "Erro ao verificar");
                } finally { setPixChecking(false); }
              }}
              disabled={pixChecking || pixExpired}
              className="mt-3 w-full rounded-lg border border-border hover:bg-background text-foreground text-sm font-medium py-2 disabled:opacity-60"
            >{pixChecking ? "Verificando…" : "Já paguei — verificar agora"}</button>
            {pixExpired ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 text-center">
                <p className="font-semibold">Este PIX expirou.</p>
                <p className="mt-1">Feche esta janela e gere um novo PIX para pagar.</p>
                <button
                  onClick={async () => { setPixModal(null); setPixCreatedAt(null); await openInvoiceAuto(); }}
                  className="mt-2 w-full rounded-md bg-red-700 hover:bg-red-800 text-white text-xs font-semibold py-2"
                >Gerar novo PIX</button>
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-muted-foreground text-center">
                Este PIX expira em{" "}
                <strong className="font-mono">
                  {String(Math.floor(pixSecondsLeft / 60)).padStart(2, "0")}
                  :
                  {String(pixSecondsLeft % 60).padStart(2, "0")}
                </strong>
              </p>
            )}
          </div>
        </div>
      )}
      {editingFor && (
        <EditTargetModal
          link={editingFor}
          onClose={() => setEditingFor(null)}
          onSaved={async () => { setEditingFor(null); await load(); }}
        />
      )}
      {deletingFor && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => !deleteBusy && setDeletingFor(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6 border border-red-200">
            <div className="flex items-center gap-2 text-red-700 font-semibold">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-lg">Excluir link</h3>
            </div>
            <p className="text-sm text-foreground/90 mt-3">
              Você vai excluir <strong className="font-mono">www.zpclik.site/r/{deletingFor.slug}</strong>.
              O link para de redirecionar imediatamente e some da sua lista, mas o histórico de cliques é preservado.
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-3">
              O slug <strong>{deletingFor.slug}</strong> não poderá ser reutilizado depois — se precisar do mesmo destino, crie um link novo com outro slug.
            </p>
            <label className="mt-4 block text-xs font-medium text-foreground/90">
              Digite <span className="font-mono">EXCLUIR</span> para confirmar
            </label>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              autoFocus
              placeholder="EXCLUIR"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-mono text-foreground"
            />
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setDeletingFor(null)}
                className="text-xs px-3 py-2 rounded-md border border-border hover:bg-secondary text-foreground disabled:opacity-50"
              >Cancelar</button>
              <button
                type="button"
                disabled={deleteBusy || deleteConfirmText.trim() !== "EXCLUIR"}
                onClick={async () => {
                  if (!deletingFor) return;
                  setDeleteBusy(true);
                  try {
                    await deleteLinkFn({ data: { linkId: deletingFor.id } });
                    toast.success("Link excluído");
                    setDeletingFor(null);
                    setDeleteConfirmText("");
                    await load();
                  } catch (e: any) {
                    toast.error(e?.message ?? "Falha ao excluir");
                  } finally { setDeleteBusy(false); }
                }}
                className="text-xs px-3 py-2 rounded-md bg-red-700 hover:bg-red-800 text-white font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {deleteBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Excluir link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditTargetModal({
  link, onClose, onSaved,
}: { link: MyLink; onClose: () => void; onSaved: () => void }) {
  const wa = parseWaUrl(link.target_url);
  const initialTab: "single" | "rotating" = link.is_rotating ? "rotating" : "single";
  const [tab, setTab] = useState<"single" | "rotating">(initialTab);

  // single mode state
  const [isWa, setIsWa] = useState<boolean>(!!wa && !link.is_rotating);
  const [phone, setPhone] = useState(wa?.phone ?? "");
  const [msg, setMsg] = useState(wa?.message ?? "");
  const [url, setUrl] = useState(link.is_rotating ? "" : (link.target_url ?? ""));

  // rotating mode state
  const initialUrls: RotRow[] = link.is_rotating && link.short_link_urls?.length
    ? [...link.short_link_urls]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((u) => urlToRow(u.url, u.weight ?? 1))
    : [urlToRow(link.target_url ?? "", 1), emptyRotRow("whatsapp")];
  const [rotUrls, setRotUrls] = useState<RotRow[]>(initialUrls);
  const [rotMode, setRotMode] = useState<RotationMode>(link.rotation_mode ?? "round_robin");

  const [saving, setSaving] = useState(false);
  const updateSingle = useServerFn(updateSubscriberLinkTarget);
  const updateRotation = useServerFn(updateSubscriberLinkRotation);
  const convertSingle = useServerFn(convertSubscriberLinkToSingle);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (tab === "single") {
        let finalUrl = url;
        if (isWa) {
          const normalized = normalizePhone(phone);
          if (!normalized) { toast.error("Número de WhatsApp inválido"); setSaving(false); return; }
          finalUrl = buildWaUrl(normalized, msg);
        }
        if (link.is_rotating) {
          await convertSingle({ data: { linkId: link.id, target_url: finalUrl } });
        } else {
          await updateSingle({ data: { linkId: link.id, target_url: finalUrl } });
        }
        toast.success("Destino atualizado");
      } else {
        const urls: { url: string; weight: number }[] = [];
        for (const row of rotUrls) {
          const res = rowToFinalUrl(row);
          if (!res.ok) {
            if (row.kind === "whatsapp" || row.url.trim().length > 0) {
              toast.error(res.reason); setSaving(false); return;
            }
            continue;
          }
          urls.push({ url: res.url, weight: Math.max(0, Math.floor(row.weight)) });
        }
        if (urls.length < 2) { toast.error("Adicione pelo menos 2 destinos"); setSaving(false); return; }
        await updateRotation({ data: { linkId: link.id, rotation_mode: rotMode, urls } });
        toast.success("Rotação atualizada");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card">
          <h3 className="font-semibold text-foreground">Editar — www.zpclik.site/r/{link.slug}</h3>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-md text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <div className="inline-flex rounded-lg border border-border p-1 bg-background">
            <button
              type="button"
              onClick={() => setTab("single")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${tab === "single" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
            >Destino único</button>
            <button
              type="button"
              onClick={() => setTab("rotating")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1 ${tab === "rotating" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
            ><Shuffle className="h-3.5 w-3.5" /> Rotativo</button>
          </div>

          {tab === "single" ? (
            <>
              <div className="inline-flex rounded-lg border border-border p-1 bg-background">
                <button type="button" onClick={() => setIsWa(false)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md ${!isWa ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
                >URL livre</button>
                <button type="button" onClick={() => setIsWa(true)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md ${isWa ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
                >WhatsApp</button>
              </div>
              {isWa ? (
                <>
                  <div>
                    <label className="text-xs font-medium text-foreground/90">Número de WhatsApp (com DDD)</label>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ex: 11 91234-5678" type="tel" required
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70"/>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground/90">Mensagem</label>
                    <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3}
                      placeholder="Mensagem pré-preenchida (opcional)"
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70"/>
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-xs font-medium text-foreground/90">URL de destino</label>
                  <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" required
                    placeholder="https://sua-url-de-destino.com"
                    className="mt-1 w-full rounded-lg border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70"/>
                </div>
              )}
              {link.is_rotating && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  Salvar aqui converte o link rotativo em destino único — as URLs adicionais serão removidas.
                </p>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-foreground/90 flex items-center">
                  Como o link deve revezar os destinos?
                  <InlineTooltip text="Escolha a regra que decide para qual destino cada clique vai. Você pode trocar a regra a qualquer momento sem mudar o link curto." />
                </label>
                <select value={rotMode} onChange={(e) => setRotMode(e.target.value as RotationMode)}
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground">
                  {(Object.keys(ROTATION_LABELS) as RotationMode[]).map((m) => (
                    <option key={m} value={m}>{ROTATION_LABELS[m]}</option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{ROTATION_HELP[rotMode]}</p>
                <p className="mt-1 text-[11px] leading-snug text-amber-600 font-medium">{ROTATION_EXAMPLES[rotMode]}</p>
              </div>
              <RotationRowsEditor
                rows={rotUrls}
                setRows={setRotUrls}
                disabled={false}
                showWeight={rotMode === "weighted"}
              />
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-gold-metal text-[#12100a] hover:brightness-110 px-5 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RotationRowsEditor({
  rows, setRows, disabled, showWeight,
}: {
  rows: RotRow[];
  setRows: React.Dispatch<React.SetStateAction<RotRow[]>>;
  disabled: boolean;
  showWeight: boolean;
}) {
  const update = (idx: number, patch: Partial<RotRow>) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const remove = (idx: number) =>
    setRows((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      {rows.map((row, idx) => (
        <div key={idx} className="rounded-lg border border-border bg-background/50 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex rounded-md border border-border p-0.5 bg-card">
              <button
                type="button" disabled={disabled}
                onClick={() => update(idx, { kind: "whatsapp" })}
                className={`px-2.5 py-1 text-[11px] font-medium rounded ${row.kind === "whatsapp" ? "bg-emerald-600 text-white" : "text-muted-foreground"}`}
              >WhatsApp</button>
              <button
                type="button" disabled={disabled}
                onClick={() => update(idx, { kind: "url" })}
                className={`px-2.5 py-1 text-[11px] font-medium rounded ${row.kind === "url" ? "bg-gold-metal text-white" : "text-muted-foreground"}`}
              >URL</button>
            </div>
            <div className="flex items-center gap-2">
              {showWeight && (
                <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  Peso
                  <input
                    disabled={disabled}
                    value={row.weight}
                    onChange={(e) => update(idx, { weight: Number(e.target.value) || 0 })}
                    type="number" min={0} max={1000}
                    className="w-16 rounded-md border border-border px-2 py-1 text-xs disabled:bg-secondary"
                  />
                </label>
              )}
              <button
                type="button" disabled={disabled || rows.length <= 2}
                onClick={() => remove(idx)}
                className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-red-600 disabled:opacity-40"
                title="Remover"
              ><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>

          {row.kind === "whatsapp" ? (
            <div className="space-y-2">
              <input
                disabled={disabled}
                value={row.phone}
                onChange={(e) => update(idx, { phone: e.target.value })}
                placeholder={`Número ${idx + 1} — ex: 11 91234-5678`}
                type="tel"
                className="w-full rounded-md border border-border px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 disabled:bg-secondary"
              />
              <textarea
                disabled={disabled}
                value={row.message}
                onChange={(e) => update(idx, { message: e.target.value })}
                placeholder="Mensagem pré-preenchida (opcional)"
                rows={2}
                maxLength={500}
                className="w-full rounded-md border border-border px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 disabled:bg-secondary"
              />
            </div>
          ) : (
            <input
              disabled={disabled}
              value={row.url}
              onChange={(e) => update(idx, { url: e.target.value })}
              placeholder={`URL de destino ${idx + 1}`}
              type="url"
              className="w-full rounded-md border border-border px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 disabled:bg-secondary"
            />
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button" disabled={disabled || rows.length >= 20}
          onClick={() => setRows((prev) => [...prev, emptyRotRow("whatsapp")])}
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-40"
        ><Plus className="h-3.5 w-3.5" /> Adicionar número de WhatsApp</button>
        <button
          type="button" disabled={disabled || rows.length >= 20}
          onClick={() => setRows((prev) => [...prev, emptyRotRow("url")])}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:brightness-110 disabled:opacity-40"
        ><Plus className="h-3.5 w-3.5" /> Adicionar URL</button>
      </div>
    </div>
  );
}


function MetricsModal({ link, onClose }: { link: MyLink; onClose: () => void }) {
  type Row = { name: string; count: number };
  type Click = {
    id: string; created_at: string; ip: string | null;
    country: string | null; region: string | null; region_code: string | null; city: string | null;
    referer: string | null; referer_host: string;
    user_agent: string | null; device: string; browser: string; os: string;
    target_url: string | null;
  };
  const fmtLocal = (c: { city: string | null; region: string | null; region_code: string | null; country: string | null }): string => {
    const uf = (c.region_code && c.region_code.length <= 3) ? c.region_code.toUpperCase() : (c.region ?? "");
    if (c.city && uf) return `${c.city}/${uf}`;
    return [c.city, c.region, c.country].filter(Boolean).join(", ");
  };
  const [data, setData] = useState<{
    total: number; total_raw: number; bots_filtered: number; unique_ips: number;
    daily: { day: string; count: number }[];
    hourly: { hour: number; count: number }[];
    topCountries: Row[]; topRegions: Row[]; topCities: Row[];
    topReferers: Row[]; topDevices: Row[]; topBrowsers: Row[]; topOs: Row[]; topTargets: Row[];
    clicks: Click[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [q, setQ] = useState("");
  const getMetrics = useServerFn(getMyLinkMetrics);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const r: any = await getMetrics({ data: { shortLinkId: link.id, days } });
        setData(r);
      } catch (e: any) {
        setErr(e?.message ?? "Erro");
      } finally { setLoading(false); }
    })();
  }, [link.id, days]);

  const max = data ? Math.max(1, ...data.daily.map((d) => d.count)) : 1;
  const maxH = data ? Math.max(1, ...data.hourly.map((d) => d.count)) : 1;

  const filtered = data?.clicks.filter((c) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return [c.ip, c.country, c.region, c.region_code, c.city, c.device, c.browser, c.os, c.referer_host, c.target_url, c.user_agent]
      .some((v) => (v ?? "").toLowerCase().includes(s));
  }) ?? [];

  const exportCSV = () => {
    if (!data) return;
    const headers = ["data_utc","ip","pais","regiao","uf","cidade","local","dispositivo","navegador","so","referer","destino","user_agent"];
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = filtered.map((c) => [
      c.created_at, c.ip, c.country, c.region, c.region_code, c.city, fmtLocal(c), c.device, c.browser, c.os, c.referer_host, c.target_url, c.user_agent
    ].map(esc).join(","));
    const csv = "\uFEFF" + headers.join(",") + "\n" + lines.join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `zpclik-${link.slug}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-neutral-950 border border-yellow-500/20 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto text-neutral-100"
      >
        <div className="px-6 py-4 border-b border-yellow-500/20 flex items-center justify-between sticky top-0 bg-neutral-950/95 backdrop-blur z-10">
          <div>
            <h3 className="font-semibold text-lg bg-gradient-to-r from-yellow-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
              Analytics Premium — /r/{link.slug}
            </h3>
            <p className="text-xs text-neutral-400">Acessos reais · bots filtrados · dados completos por clique</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="text-xs bg-neutral-900 border border-yellow-500/20 rounded-md px-2 py-1.5 text-neutral-200"
            >
              <option value={1}>24h</option>
              <option value={7}>7 dias</option>
              <option value={30}>30 dias</option>
              <option value={90}>90 dias</option>
              <option value={365}>1 ano</option>
            </select>
            <button onClick={exportCSV} disabled={!data} className="text-xs px-3 py-1.5 rounded-md bg-yellow-500 hover:bg-yellow-400 text-black font-semibold disabled:opacity-40">
              Exportar CSV
            </button>
            <button onClick={onClose} className="p-2 hover:bg-neutral-800 rounded-md text-neutral-400">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center gap-2 text-neutral-400 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
          ) : err ? (
            <div className="text-sm text-red-400">{err}</div>
          ) : data ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPI
                  label="Cliques reais"
                  value={data.total}
                  hint={
                    data.bots_filtered > 0
                      ? `${data.bots_filtered} prévia(s)/robô(s) ignorado(s) · bruto: ${data.total_raw}`
                      : "Nenhuma prévia/robô detectada no período"
                  }
                />
                <KPI label="IPs únicos" value={data.unique_ips} />
                <KPI label="Países" value={data.topCountries.length} />
                <KPI label="Dispositivos" value={data.topDevices.length} />
              </div>

              <div>
                <h4 className="text-sm font-semibold text-yellow-300 mb-3">Cliques por dia</h4>
                <div className="flex items-end gap-1 h-32 bg-neutral-900/60 border border-yellow-500/10 rounded-xl p-3">
                  {data.daily.map((d) => (
                    <div key={d.day} title={`${d.day}: ${d.count}`} className="flex-1 flex flex-col justify-end">
                      <div className="w-full bg-gradient-to-t from-amber-600 to-yellow-300 rounded-t"
                        style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 2 : 0 }} />
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
                  <span>{data.daily[0]?.day}</span><span>{data.daily[data.daily.length - 1]?.day}</span>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-yellow-300 mb-3">Cliques por hora (UTC)</h4>
                <div className="flex items-end gap-1 h-24 bg-neutral-900/60 border border-yellow-500/10 rounded-xl p-3">
                  {data.hourly.map((h) => (
                    <div key={h.hour} title={`${h.hour}h: ${h.count}`} className="flex-1 flex flex-col justify-end">
                      <div className="w-full bg-yellow-500/70 rounded-t" style={{ height: `${(h.count / maxH) * 100}%`, minHeight: h.count > 0 ? 2 : 0 }} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                <StatList title="Top países" rows={data.topCountries} />
                <StatList title="Top cidades" rows={data.topCities} />
                <StatList title="Top regiões" rows={data.topRegions} />
                <StatList title="Top referrers" rows={data.topReferers} />
                <StatList title="Dispositivos" rows={data.topDevices} />
                <StatList title="Navegadores" rows={data.topBrowsers} />
                <StatList title="Sistemas" rows={data.topOs} />
                <StatList title="Destinos" rows={data.topTargets} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 gap-3">
                  <h4 className="text-sm font-semibold text-yellow-300">Cliques detalhados</h4>
                  <input
                    value={q} onChange={(e) => setQ(e.target.value)}
                    placeholder="Filtrar por IP, cidade, dispositivo, destino…"
                    className="text-xs bg-neutral-900 border border-yellow-500/20 rounded-md px-3 py-1.5 flex-1 max-w-xs text-neutral-100 placeholder:text-neutral-500"
                  />
                  <span className="text-xs text-neutral-500">{filtered.length} / {data.clicks.length}</span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-yellow-500/10">
                  <table className="w-full text-xs">
                    <thead className="bg-neutral-900 text-yellow-300/80 uppercase tracking-wider">
                      <tr>
                        <th className="text-left px-3 py-2">Data (UTC)</th>
                        <th className="text-left px-3 py-2">IP</th>
                        <th className="text-left px-3 py-2">Local</th>
                        <th className="text-left px-3 py-2">Dispositivo</th>
                        <th className="text-left px-3 py-2">Navegador / SO</th>
                        <th className="text-left px-3 py-2">Referrer</th>
                        <th className="text-left px-3 py-2">Destino</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, 500).map((c) => (
                        <tr key={c.id} className="border-t border-neutral-800 hover:bg-neutral-900/60">
                          <td className="px-3 py-1.5 text-neutral-300 whitespace-nowrap">{new Date(c.created_at).toLocaleString("pt-BR")}</td>
                          <td className="px-3 py-1.5 font-mono text-neutral-400">{c.ip ?? "—"}</td>
                          <td className="px-3 py-1.5 text-neutral-300">{fmtLocal(c) || "—"}</td>
                          <td className="px-3 py-1.5 text-neutral-300">{c.device}</td>
                          <td className="px-3 py-1.5 text-neutral-400">{c.browser} · {c.os}</td>
                          <td className="px-3 py-1.5 text-neutral-400">{c.referer_host}</td>
                          <td className="px-3 py-1.5 text-neutral-400 max-w-[220px] truncate" title={c.target_url ?? ""}>{c.target_url ?? "—"}</td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={7} className="text-center py-6 text-neutral-500">Nenhum clique nesse período.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-neutral-900 to-neutral-950 border border-yellow-500/20 p-4">
      <div className="text-[10px] uppercase tracking-wider text-neutral-400">{label}</div>
      <div className="mt-1 text-2xl font-bold bg-gradient-to-r from-yellow-200 to-amber-500 bg-clip-text text-transparent">{value}</div>
      {hint ? <div className="mt-1 text-[10px] text-neutral-500 leading-snug">{hint}</div> : null}
    </div>
  );
}

function StatList({ title, rows }: { title: string; rows: { name: string; count: number }[] }) {
  return (
    <div className="rounded-xl border border-yellow-500/10 bg-neutral-900/40 p-4">
      <h4 className="text-xs font-semibold text-yellow-300 mb-2 uppercase tracking-wider">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-xs text-neutral-500">Sem dados.</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {rows.map((r) => (
            <li key={r.name} className="flex justify-between text-neutral-300 gap-2">
              <span className="truncate">{r.name}</span>
              <span className="font-semibold text-yellow-300">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
