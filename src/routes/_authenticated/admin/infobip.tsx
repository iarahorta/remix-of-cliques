import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageShell } from "@/components/page-shell";
import { Loader2, Plug, CheckCircle2, AlertCircle, Copy, KeyRound, Save, Zap } from "lucide-react";
import { toast } from "sonner";
import { getInfobipStatus, saveInfobipSettings, testInfobipConnection } from "@/lib/infobip.functions";

export const Route = createFileRoute("/_authenticated/admin/infobip")({
  head: () => ({ meta: [{ title: "Infobip — HS Assessoria" }] }),
  component: InfobipPage,
});

function InfobipPage() {
  const fetchStatus = useServerFn(getInfobipStatus);
  const fetchSave = useServerFn(saveInfobipSettings);
  const fetchTest = useServerFn(testInfobipConnection);

  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState("");
  const [sender, setSender] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | { ok: boolean; status?: number; senders?: string[]; body?: string }>(null);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/webhooks/infobip`
      : "/api/public/webhooks/infobip";

  useEffect(() => {
    fetchStatus()
      .then((s: any) => {
        setBaseUrl(s.base_url ?? "");
        setSender(s.default_sender ?? "");
        setHasApiKey(!!s.has_api_key);
      })
      .catch((e: any) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await fetchSave({ data: { base_url: baseUrl || null, default_sender: sender || null } });
      toast.success("Configurações salvas");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true); setTestResult(null);
    try {
      const r = await fetchTest({});
      setTestResult(r as any);
      if ((r as any).ok) toast.success("Conexão OK"); else toast.error(`Falhou: ${(r as any).status}`);
    } catch (e: any) { toast.error(e.message); }
    finally { setTesting(false); }
  };

  if (loading) {
    return <PageShell title="Infobip"><div className="card-premium p-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div></PageShell>;
  }

  const connected = !!baseUrl && hasApiKey;

  return (
    <PageShell title="Infobip" subtitle="Conexão WhatsApp Business via API.">
      <div className="space-y-6">
        <div className="card-premium p-5 border-[oklch(0.55_0.12_75_/_0.5)] bg-[oklch(0.25_0.05_70_/_0.3)]">
          <h3 className="font-display text-base mb-2">Como integrar (1 minuto)</h3>
          <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal pl-5">
            <li>No portal Infobip, vá em <b>Developers → API Keys</b> e gere uma chave com escopo <code>whatsapp</code>.</li>
            <li>Copie a <b>Base URL</b> que aparece no canto superior direito do portal (ex.: <code>xxxxx.api.infobip.com</code>).</li>
            <li>No painel Lovable, cole a Base URL aqui e adicione a chave em <b>Secrets</b> com o nome <code>INFOBIP_API_KEY</code>.</li>
            <li>Informe o número WhatsApp <b>Sender</b> aprovado (formato 55DDDNUMERO).</li>
            <li>Clique <b>Testar conexão</b> — se aparecer ✅ verde, vá em <b>WhatsApp Templates</b> e clique <b>Sincronizar</b>.</li>
          </ol>
          <p className="text-xs text-muted-foreground mt-3">
            Doc oficial: <a href="https://www.infobip.com/docs/api/channels/whatsapp" target="_blank" rel="noreferrer" className="underline text-[oklch(0.85_0.14_75)]">infobip.com/docs/api/channels/whatsapp</a>
          </p>
        </div>
        <div className="card-premium p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
              <Plug className="h-5 w-5 text-[oklch(0.84_0.14_80)]" />
            </div>
            <div>
              <h3 className="font-display text-xl">Conexão</h3>
              <p className="text-sm text-muted-foreground">Status atual da integração</p>
            </div>
            <div className="ml-auto">
              {connected ? (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-[oklch(0.85_0.14_140)]">
                  <CheckCircle2 className="h-4 w-4" /> Conectado
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-[oklch(0.85_0.16_75)]">
                  <AlertCircle className="h-4 w-4" /> Faltando credenciais
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <Field label="Base URL Infobip" placeholder="https://xxxxx.api.infobip.com" value={baseUrl} onChange={setBaseUrl} />
            <Field label="Sender padrão (número WhatsApp)" placeholder="5511999999999" value={sender} onChange={setSender} />

            <div className="flex items-center gap-2 rounded-lg border border-border bg-input/40 p-3 text-sm">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">API Key:</span>
              {hasApiKey
                ? <span className="font-medium text-[oklch(0.85_0.14_140)]">Configurada (Secrets)</span>
                : <span className="font-medium text-[oklch(0.85_0.16_75)]">Não configurada — adicione INFOBIP_API_KEY em Secrets</span>}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button onClick={save} disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-gold-metal px-4 py-2 text-sm font-semibold hover:scale-[1.02] transition disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
              </button>
              <button onClick={test} disabled={testing || !connected}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-50">
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Testar conexão
              </button>
            </div>

            {testResult && (
              <pre className="mt-3 whitespace-pre-wrap text-xs bg-input border border-border rounded-lg p-3">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            )}
          </div>
        </div>

        <div className="card-premium p-6">
          <h3 className="font-display text-xl mb-2">Webhook</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Cadastre esta URL no portal Infobip (Notify URL) para receber status de entrega e aprovação de templates:
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-input p-3">
            <code className="text-xs flex-1 truncate">{webhookUrl}</code>
            <button onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Copiado"); }}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary">
              <Copy className="h-3 w-3" /> Copiar
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            O segredo já está gerado em <code>INFOBIP_WEBHOOK_SECRET</code>. Envie-o no header
            <code className="mx-1">X-Webhook-Secret</code> ou como HMAC SHA256 em <code>X-Infobip-Signature</code>.
          </p>
        </div>
      </div>
    </PageShell>
  );
}

function Field({ label, placeholder, value, onChange }: { label: string; placeholder?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm focus:outline-none focus:border-[oklch(0.6_0.12_75)]" />
    </div>
  );
}
