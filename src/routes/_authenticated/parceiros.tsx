import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppSidebar, MobileTopBar } from "@/components/app-sidebar";
import {
  listPartners, createPartner, updatePartner, rotatePartnerToken,
  getPartnerDashboard,
} from "@/lib/partners.functions";
import { Copy, Plus, RefreshCw, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/parceiros")({
  head: () => ({ meta: [{ title: "Parceiros — zpclik" }] }),
  component: ParceirosPage,
});

type Partner = {
  id: string; name: string; type: string; public_token: string;
  email: string | null; phone: string | null; tax_id: string | null;
  pix_key: string | null; pix_key_type: string | null;
  default_commission_bps: number; status: string; notes: string | null;
};

const PARTNER_TYPES = [
  { v: "affiliate", l: "Afiliado" },
  { v: "manager", l: "Manager" },
  { v: "white_label", l: "White Label" },
  { v: "reseller", l: "Revendedor" },
  { v: "agency", l: "Agência" },
];

function fmtBRL(cents: number) {
  return (Number(cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ParceirosPage() {
  const runList = useServerFn(listPartners);
  const runCreate = useServerFn(createPartner);
  const runUpdate = useServerFn(updatePartner);
  const runRotate = useServerFn(rotatePartnerToken);
  const runDashboard = useServerFn(getPartnerDashboard);

  const [rows, setRows] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<Partner | null | "new">(null);
  const [dash, setDash] = useState<any>(null);
  const [dashOpen, setDashOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await runList();
      setRows((r.partners ?? []) as Partner[]);
    } finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, []);

  const openDashboard = async (id: string) => {
    setDashOpen(true);
    setDash(null);
    const d = await runDashboard({ data: { partnerId: id } });
    setDash(d);
  };

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileTopBar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl">
          <header className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Parceiros</h1>
              <p className="text-sm text-muted-foreground">Managers, afiliados, agências, white labels.</p>
            </div>
            <button onClick={() => setShowForm("new")} className="inline-flex items-center gap-2 bg-gold-metal text-[#1a1408] px-4 py-2 rounded-lg text-sm font-semibold">
              <Plus className="h-4 w-4" /> Novo parceiro
            </button>
          </header>

          <div className="rounded-xl border border-[oklch(0.32_0.04_80/_0.25)] overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead className="bg-[oklch(0.2_0.012_60)] text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Nome</th>
                  <th className="text-left px-3 py-2 font-medium">Tipo</th>
                  <th className="text-left px-3 py-2 font-medium">Token</th>
                  <th className="text-right px-3 py-2 font-medium">%</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>}
                {!loading && rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum parceiro cadastrado ainda.</td></tr>}
                {rows.map((p) => (
                  <tr key={p.id} className="border-t border-[oklch(0.32_0.04_80/_0.15)] hover:bg-[oklch(0.2_0.012_60/_0.5)]">
                    <td className="px-3 py-2 font-medium text-foreground">{p.name}</td>
                    <td className="px-3 py-2">{PARTNER_TYPES.find((t) => t.v === p.type)?.l ?? p.type}</td>
                    <td className="px-3 py-2 font-mono text-xs text-[#f0c95a]">
                      <span className="inline-flex items-center gap-1">
                        {p.public_token}
                        <button onClick={() => navigator.clipboard.writeText(`https://www.zpclik.site/?ref=${p.public_token}`)} className="hover:text-foreground" title="Copiar link com ?ref">
                          <Copy className="h-3 w-3" />
                        </button>
                        <button
                          onClick={async () => { if (!confirm("Gerar novo token? O antigo para de funcionar.")) return; await runRotate({ data: { id: p.id } }); reload(); }}
                          className="hover:text-foreground" title="Rotacionar token"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </button>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{(p.default_commission_bps / 100).toFixed(2)}%</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${p.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-500/15 text-slate-400"}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => openDashboard(p.id)} className="text-xs text-[#f0c95a] hover:underline mr-3">Métricas</button>
                      <button onClick={() => setShowForm(p)} className="text-xs text-muted-foreground hover:text-foreground">Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {showForm && (
        <PartnerFormModal
          initial={showForm === "new" ? null : showForm}
          onClose={() => setShowForm(null)}
          onSave={async (payload) => {
            if (showForm === "new") await runCreate({ data: payload as any });
            else await runUpdate({ data: { id: (showForm as Partner).id, ...payload } as any });
            setShowForm(null);
            reload();
          }}
        />
      )}

      {dashOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setDashOpen(false)}>
          <div className="bg-card border border-[oklch(0.32_0.04_80/_0.25)] rounded-xl max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Métricas do parceiro</h2>
              <button onClick={() => setDashOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            {!dash ? <p className="text-muted-foreground text-sm">Carregando…</p> : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Stat label="Visitas" value={dash.referrals_total} />
                <Stat label="Convertidos" value={dash.referrals_converted} />
                <Stat label="Assinantes" value={dash.subscribers_total} />
                <Stat label="Ativos" value={dash.subscribers_active} />
                <Stat label="Comissões (total)" value={fmtBRL(dash.commissions.reduce((a: number, c: any) => a + Number(c.commission_cents ?? 0), 0))} />
                <Stat label="Pagas" value={fmtBRL(dash.commissions.filter((c: any) => c.status === "paid").reduce((a: number, c: any) => a + Number(c.commission_cents ?? 0), 0))} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg bg-[oklch(0.2_0.012_60)] p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-lg text-foreground font-semibold">{value}</p>
    </div>
  );
}

function PartnerFormModal({ initial, onClose, onSave }: { initial: Partner | null; onClose: () => void; onSave: (p: any) => Promise<void> }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? "affiliate");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [taxId, setTaxId] = useState(initial?.tax_id ?? "");
  const [pixKey, setPixKey] = useState(initial?.pix_key ?? "");
  const [pixType, setPixType] = useState(initial?.pix_key_type ?? "");
  const [bps, setBps] = useState(String(initial?.default_commission_bps ?? 3000));
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setSaving(true);
    try {
      await onSave({
        name, type, email, phone,
        tax_id: taxId, pix_key: pixKey, pix_key_type: pixType,
        default_commission_bps: parseInt(bps || "0", 10) || 0,
        status, notes,
      });
    } catch (e: any) { setErr(e?.message ?? "Erro ao salvar."); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-card border border-[oklch(0.32_0.04_80/_0.25)] rounded-xl max-w-lg w-full p-6 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">{initial ? "Editar parceiro" : "Novo parceiro"}</h2>
          <button type="button" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <Field label="Nome"><input required value={name} onChange={(e) => setName(e.target.value)} className="input" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <select value={type} onChange={(e) => setType(e.target.value)} className="input">
              {PARTNER_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </Field>
          <Field label="% Comissão (basis points, 3000 = 30%)">
            <input type="number" min={0} max={10000} value={bps} onChange={(e) => setBps(e.target.value)} className="input" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="E-mail"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" /></Field>
          <Field label="Telefone"><input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" /></Field>
        </div>
        <Field label="CPF/CNPJ"><input value={taxId} onChange={(e) => setTaxId(e.target.value)} className="input" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Chave PIX"><input value={pixKey} onChange={(e) => setPixKey(e.target.value)} className="input" /></Field>
          <Field label="Tipo da chave">
            <select value={pixType} onChange={(e) => setPixType(e.target.value)} className="input">
              <option value="">—</option>
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
              <option value="email">E-mail</option>
              <option value="phone">Telefone</option>
              <option value="random">Aleatória</option>
            </select>
          </Field>
        </div>
        {initial && (
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
              <option value="active">Ativo</option>
              <option value="paused">Pausado</option>
              <option value="banned">Banido</option>
            </select>
          </Field>
        )}
        <Field label="Notas"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={2} /></Field>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold bg-gold-metal text-[#1a1408] disabled:opacity-60">{saving ? "Salvando…" : "Salvar"}</button>
        </div>
        <style>{`.input{width:100%;background:oklch(0.2 0.012 60);border:1px solid oklch(0.32 0.04 80 / 0.25);color:#fff;border-radius:8px;padding:8px 10px;font-size:14px}`}</style>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}