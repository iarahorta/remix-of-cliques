import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CheckCircle2, XCircle, Copy, ShieldCheck, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import {
  getAsaasWebhookConfig,
  validateAsaasWebhookToken,
} from "@/lib/asaas-admin.functions";

export const Route = createFileRoute("/_authenticated/configuracoes/asaas")({
  head: () => ({ meta: [{ title: "Configurações Asaas — cliques" }] }),
  component: ConfiguracoesAsaas,
});

interface Cfg {
  hasToken: boolean;
  tokenPreview: string | null;
  hasApiKey: boolean;
  env: string;
  webhookUrl: string;
}

function ConfiguracoesAsaas() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; status?: number; rejectStatus?: number } | null>(null);

  const loadFn = useServerFn(getAsaasWebhookConfig);
  const validateFn = useServerFn(validateAsaasWebhookToken);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const c: any = await loadFn();
      setCfg(c);
    } catch (e: any) {
      setErr(e?.message ?? "Erro ao carregar");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleValidate = async () => {
    setValidating(true); setResult(null);
    try {
      const r: any = await validateFn();
      setResult(r);
      if (r.ok) toast.success("Autenticação Asaas validada");
      else toast.error("Falha na validação");
    } catch (e: any) {
      toast.error(e?.message ?? "Falhou");
    } finally { setValidating(false); }
  };

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    toast.success("Copiado");
  };

  return (
    <PageShell
      title="Configurações Asaas"
      subtitle="Gerencie o token de webhook e valide a integração de cobrança"
    >
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">{err}</div>
      )}
      {loading || !cfg ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <div className="space-y-4 max-w-2xl">
          {/* Status */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#0b3d91]" /> Status da integração
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Ambiente</dt>
                <dd className="font-medium text-slate-800">{cfg.env}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">ASAAS_API_KEY</dt>
                <dd className="font-medium">
                  {cfg.hasApiKey
                    ? <span className="text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5"/> configurada</span>
                    : <span className="text-red-700 inline-flex items-center gap-1"><XCircle className="h-3.5 w-3.5"/> ausente</span>}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">ASAAS_WEBHOOK_TOKEN</dt>
                <dd className="font-medium">
                  {cfg.hasToken
                    ? <span className="text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5"/> {cfg.tokenPreview}</span>
                    : <span className="text-red-700 inline-flex items-center gap-1"><XCircle className="h-3.5 w-3.5"/> ausente</span>}
                </dd>
              </div>
              <div className="flex justify-between gap-3 items-center">
                <dt className="text-slate-500 shrink-0">URL do webhook</dt>
                <dd className="font-mono text-xs text-slate-800 truncate flex items-center gap-1">
                  <span className="truncate">{cfg.webhookUrl}</span>
                  <button onClick={() => copy(cfg.webhookUrl)} className="p-1 rounded hover:bg-slate-100 shrink-0" aria-label="Copiar URL">
                    <Copy className="h-3.5 w-3.5 text-slate-500" />
                  </button>
                </dd>
              </div>
            </dl>
          </div>

          {/* Validar */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Validar autenticação
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Envia uma requisição de teste ao próprio endpoint <span className="font-mono">/api/public/webhooks/asaas</span>: verifica se o token atual retorna 200 e se um token inválido é rejeitado com 401.
            </p>
            <button
              onClick={handleValidate}
              disabled={validating || !cfg.hasToken}
              className="inline-flex items-center gap-2 rounded-md bg-[#0b3d91] hover:bg-[#0a367e] text-white text-sm px-3.5 py-2 disabled:opacity-60"
            >
              {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Validar agora
            </button>

            {result && (
              <div className={`mt-4 rounded-lg border p-3 text-sm ${
                result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
              }`}>
                <div className="flex items-start gap-2">
                  {result.ok
                    ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0"/>
                    : <XCircle className="h-4 w-4 mt-0.5 shrink-0"/>}
                  <div>
                    <p className="font-medium">{result.message}</p>
                    {typeof result.status === "number" && (
                      <p className="text-xs mt-1 opacity-80">
                        Token válido: HTTP <b>{result.status}</b> · Token inválido: HTTP <b>{result.rejectStatus}</b>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Atualizar token */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#0b3d91]" /> Atualizar token
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              O token é armazenado com segurança no backend e nunca fica exposto no navegador. Para trocá-lo:
            </p>
            <ol className="text-sm text-slate-700 list-decimal pl-5 space-y-1">
              <li>Copie o novo token do painel Asaas (aba de webhooks).</li>
              <li>Peça no chat do Lovable: <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">atualizar ASAAS_WEBHOOK_TOKEN</span></li>
              <li>Cole o valor no formulário seguro que aparecer.</li>
              <li>Volte aqui e clique em <b>Validar agora</b> para confirmar.</li>
            </ol>
            <p className="text-xs text-slate-500 mt-3">
              Também é possível manter o mesmo token: gere um valor forte, salve como secret aqui, e configure o mesmo valor no Asaas.
            </p>
          </div>
        </div>
      )}
    </PageShell>
  );
}
