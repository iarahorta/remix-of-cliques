import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { createSubscriberProfile } from "@/lib/link-subscribers.functions";
import { Loader2, Link2, BarChart3, ShieldCheck, Zap } from "lucide-react";

export const Route = createFileRoute("/clientes/")({
  head: () => ({
    meta: [
      { title: "Encurtador de Links por Assinatura — zpclik" },
      {
        name: "description",
        content:
          "Encurte links, acompanhe cliques reais (sem robôs) e gerencie tudo num painel simples. R$ 19,90/mês.",
      },
    ],
  }),
  component: ClientesLanding,
});

function ClientesLanding() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  const createProfile = useServerFn(createSubscriberProfile);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/clientes/dashboard" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      if (mode === "signup") {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/clientes/dashboard`,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        if (signUpData.user) {
          try {
            await createProfile({ data: { name, email, phone } });
          } catch (e: any) {
            console.error("Erro ao criar perfil do assinante:", e);
          }
        }
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setMsg({ kind: "ok", text: "Cadastro criado! Faça login para entrar." });
          setMode("signin");
          return;
        }
        navigate({ to: "/clientes/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/clientes/dashboard" });
      }
    } catch (err: any) {
      const m = (err?.message ?? "").toLowerCase();
      let txt = err?.message ?? "Erro inesperado.";
      if (m.includes("invalid login")) txt = "E-mail ou senha incorretos.";
      else if (m.includes("email not confirmed")) txt = "Confirme seu e-mail antes de entrar.";
      else if (m.includes("already registered") || m.includes("user already"))
        txt = "Este e-mail já está cadastrado. Tente entrar.";
      setMsg({ kind: "error", text: txt });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-12 lg:py-20 grid lg:grid-cols-2 gap-12 items-start">
        <div>
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 font-semibold">
            <Link2 className="h-4 w-4" /> zpclik
          </div>
          <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
            Encurtador de Links por Assinatura
          </h1>
          <p className="mt-4 text-slate-600 text-base sm:text-lg leading-relaxed">
            Crie links curtos em segundos, compartilhe onde quiser e acompanhe apenas os
            <strong> cliques reais </strong> — filtramos automaticamente robôs e crawlers.
          </p>
          <div className="mt-8 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-slate-900">R$ 19,90</span>
            <span className="text-slate-500">/mês</span>
          </div>

          <ul className="mt-8 space-y-3 text-sm text-slate-700">
            <li className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-[#0b3d91] shrink-0 mt-0.5" />
              Links curtos ilimitados no domínio www.zpclik.site
            </li>
            <li className="flex items-start gap-3">
              <BarChart3 className="h-5 w-5 text-[#0b3d91] shrink-0 mt-0.5" />
              Métricas de cliques reais, por dia e por localização
            </li>
            <li className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-[#0b3d91] shrink-0 mt-0.5" />
              Tráfego de bots filtrado automaticamente
            </li>
          </ul>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 lg:p-8">
          <div className="flex bg-slate-100 rounded-lg p-1 mb-5">
            <button
              type="button"
              onClick={() => { setMode("signup"); setMsg(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >Assinar</button>
            <button
              type="button"
              onClick={() => { setMode("signin"); setMsg(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === "signin" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >Entrar</button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <>
                <TextField label="Nome completo" value={name} onChange={setName} required />
                <TextField label="Telefone / WhatsApp" value={phone} onChange={setPhone} required placeholder="(00) 00000-0000" />
              </>
            )}
            <TextField type="email" label="E-mail" value={email} onChange={setEmail} required placeholder="seu@email.com" />
            <TextField type="password" label="Senha" value={password} onChange={setPassword} required minLength={6} placeholder="Mínimo 6 caracteres" />

            {msg && (
              <div className={`rounded-lg p-3 text-sm border ${msg.kind === "error" ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                {msg.text}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0b3d91] hover:bg-[#0a3582] text-white px-6 py-2.5 text-sm font-semibold transition disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signup" ? "Criar minha conta" : "Entrar"}
            </button>

            {mode === "signup" && (
              <p className="text-xs text-slate-500 text-center">
                Após criar a conta, envie o pagamento via PIX para liberar o acesso.
              </p>
            )}
          </form>

          <div className="mt-4 text-center">
            <Link to="/" className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-4">
              Voltar para a página inicial
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function TextField({
  label, value, onChange, type = "text", required, placeholder, minLength,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string; minLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-slate-500">{label}</span>
      <input
        required={required}
        type={type}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-lg bg-white border border-slate-300 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-[#0b3d91] focus:ring-2 focus:ring-sky-100"
      />
    </label>
  );
}
