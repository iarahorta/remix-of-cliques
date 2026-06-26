import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wallet, Copy, Check, QrCode } from "lucide-react";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/recarga")({
  head: () => ({ meta: [{ title: "Recarga — HS Assessoria" }] }),
  component: Recarga,
});

const SUGGESTION = 10000;

function Recarga() {
  const [amount, setAmount] = useState<number | "">("");
  const [generated, setGenerated] = useState<{ code: string; amount: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const value = typeof amount === "number" ? amount : 0;

  const generate = () => {
    if (!value || value < 10) return;
    const code = `00020126${Math.floor(Math.random() * 1e16).toString().padStart(16, "0")}5204000053039865802BR5910HSASSESSORIA6009SAOPAULO62070503***6304${Math.floor(Math.random() * 9999).toString().padStart(4, "0")}`;
    setGenerated({ code, amount: value });
    setCopied(false);
  };

  const copy = async () => {
    if (!generated) return;
    await navigator.clipboard.writeText(generated.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <PageShell title="Recarga" subtitle="Adicione saldo em reais para usar conforme o nicho.">
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card-premium p-8 lg:col-span-3">
          <div className="flex items-center gap-3 mb-6">
            <Wallet className="h-5 w-5 text-[oklch(0.75_0.13_75)]" />
            <h3 className="font-display text-xl">Valor da recarga</h3>
          </div>

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Quanto deseja adicionar?</span>
            <div className="mt-2 flex items-center gap-3 rounded-xl bg-input border border-border px-5 py-4 focus-within:ring-2 focus-within:ring-ring">
              <span className="font-display text-2xl text-[oklch(0.75_0.13_75)]">R$</span>
              <input
                type="number" min={10} step="0.01" value={amount}
                onChange={(e) => setAmount(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                placeholder="0,00"
                className="flex-1 bg-transparent font-display text-3xl focus:outline-none placeholder:text-muted-foreground/40"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Sugestão: <button type="button" onClick={() => setAmount(SUGGESTION)} className="text-[oklch(0.75_0.13_75)] hover:underline">R$ {SUGGESTION.toLocaleString("pt-BR")},00</button> — o valor mínimo é R$ 10,00.
            </p>
          </label>

          <button
            onClick={generate} disabled={!value || value < 10}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gold-metal px-6 py-3.5 text-base font-semibold hover:scale-[1.01] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <QrCode className="h-5 w-5" /> Gerar Pix
          </button>
        </section>

        <section className="card-premium p-8 lg:col-span-2">
          <h3 className="font-display text-xl">Pagamento Pix</h3>
          {!generated ? (
            <div className="mt-6 text-center py-10 border-2 border-dashed border-border rounded-xl">
              <QrCode className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">Gere um Pix para ver o QR Code aqui.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="bg-white rounded-xl p-4 flex items-center justify-center">
                <img alt="QR Code" className="w-48 h-48" src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(generated.code)}`} />
              </div>
              <p className="text-center font-display text-2xl text-gold-gradient">
                {(generated.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Pix copia e cola</p>
                <div className="rounded-lg bg-input border border-border p-3 font-mono text-xs break-all max-h-24 overflow-y-auto">
                  {generated.code}
                </div>
                <button onClick={copy} className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary/60 px-4 py-2 text-xs font-medium hover:bg-secondary">
                  {copied ? <><Check className="h-3.5 w-3.5" /> Copiado!</> : <><Copy className="h-3.5 w-3.5" /> Copiar código</>}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
