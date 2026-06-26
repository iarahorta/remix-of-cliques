import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, Lock, Sparkles, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — cliques" },
      { name: "description", content: "Acesse sua conta para gerenciar seus links." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/encurtador" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setMsg({ kind: "ok", text: "Cadastro criado! Faça login para entrar." });
          setMode("signin");
        } else {
          navigate({ to: "/encurtador" });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/encurtador" });
      }
    } catch (err: any) {
      const m = (err?.message ?? "").toLowerCase();
      let txt = err?.message ?? "Erro inesperado.";
      if (m.includes("invalid login")) txt = "E-mail ou senha incorretos.";
      else if (m.includes("email not confirmed")) txt = "Confirme seu e-mail antes de entrar.";
      else if (m.includes("already registered") || m.includes("user already")) txt = "Este e-mail já está cadastrado. Tente entrar.";
      setMsg({ kind: "error", text: txt });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="h-12 w-12 rounded-xl bg-[#0b3d91] text-white flex items-center justify-center shadow-sm">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">cliques</h1>
          <p className="mt-1 text-sm text-slate-500">Encurtador de links</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex bg-slate-100 rounded-lg p-1 mb-5">
            <button
              type="button"
              onClick={() => { setMode("signin"); setMsg(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === "signin" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >Entrar</button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setMsg(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >Criar conta</button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <Field icon={<UserIcon className="h-4 w-4" />} label="Nome completo">
                <input
                  required value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent text-sm focus:outline-none text-slate-800"
                  placeholder="Seu nome"
                />
              </Field>
            )}
            <Field icon={<Mail className="h-4 w-4" />} label="E-mail">
              <input
                required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent text-sm focus:outline-none text-slate-800"
                placeholder="seu@email.com"
              />
            </Field>
            <Field icon={<Lock className="h-4 w-4" />} label="Senha">
              <input
                required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent text-sm focus:outline-none text-slate-800"
                placeholder="Mínimo 6 caracteres"
              />
            </Field>

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
              {mode === "signin" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          {mode === "signin" && (
            <button
              type="button"
              onClick={async () => {
                if (!email) { setMsg({ kind: "error", text: "Digite seu e-mail acima para receber o link." }); return; }
                setLoading(true); setMsg(null);
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                setLoading(false);
                if (error) setMsg({ kind: "error", text: error.message });
                else setMsg({ kind: "ok", text: "Link de redefinição enviado para o seu e-mail." });
              }}
              className="mt-4 w-full text-xs text-slate-500 hover:text-slate-800 underline underline-offset-4"
            >
              Esqueci minha senha
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-slate-500">{label}</span>
      <div className="mt-1.5 flex items-center gap-3 rounded-lg bg-white border border-slate-300 px-3 py-2.5 focus-within:border-[#0b3d91] focus-within:ring-2 focus-within:ring-sky-100">
        <span className="text-slate-400">{icon}</span>
        {children}
      </div>
    </label>
  );
}
