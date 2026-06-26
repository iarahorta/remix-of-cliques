import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/hs-logo.png.asset.json";
import { Loader2, Mail, Lock, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — HS Assessoria" },
      { name: "description", content: "Acesse sua conta HS Assessoria para gerenciar campanhas de disparo." },
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
      if (data.session) navigate({ to: "/painel" });
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
        // Auto-confirm is enabled — tenta logar imediatamente
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setMsg({ kind: "ok", text: "Cadastro criado! Faça login para entrar." });
          setMode("signin");
        } else {
          navigate({ to: "/painel" });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/painel" });
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
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 text-center">
          <img
            src={logoAsset.url}
            alt="HS Assessoria"
            className="w-28 h-28 object-contain drop-shadow-[0_6px_24px_rgba(200,150,80,0.45)]"
          />
          <div className="mt-4 flex flex-col items-center leading-none">
            <span className="font-display text-5xl tracking-[0.2em] text-gold-gradient font-semibold">HS</span>
            <span className="mt-2 font-display text-base tracking-[0.42em] text-gold-gradient/90 font-medium">ASSESSORIA</span>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Plataforma de disparos em massa</p>
        </div>

        <div className="card-premium p-8">
          <div className="flex bg-secondary/40 rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => { setMode("signin"); setMsg(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === "signin" ? "bg-gold-metal" : "text-muted-foreground"}`}
            >Entrar</button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setMsg(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === "signup" ? "bg-gold-metal" : "text-muted-foreground"}`}
            >Criar conta</button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <Field icon={<UserIcon className="h-4 w-4" />} label="Nome completo">
                <input
                  required value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent text-sm focus:outline-none"
                  placeholder="Ex: Iara Chorta"
                />
              </Field>
            )}
            <Field icon={<Mail className="h-4 w-4" />} label="E-mail">
              <input
                required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent text-sm focus:outline-none"
                placeholder="seu@email.com"
              />
            </Field>
            <Field icon={<Lock className="h-4 w-4" />} label="Senha">
              <input
                required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent text-sm focus:outline-none"
                placeholder="Mínimo 6 caracteres"
              />
            </Field>

            {msg && (
              <div className={`rounded-lg p-3 text-sm ${msg.kind === "error" ? "bg-destructive/15 text-destructive border border-destructive/30" : "bg-[oklch(0.78_0.13_75_/_0.1)] text-[oklch(0.85_0.14_75)] border border-[oklch(0.75_0.13_75_/_0.3)]"}`}>
                {msg.text}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gold-metal px-6 py-3 text-sm font-semibold hover:scale-[1.01] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
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
              className="mt-4 w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Esqueci minha senha
            </button>
          )}

          {mode === "signup" && (
            <p className="mt-4 text-xs text-muted-foreground text-center">
              Sua conta é ativada na hora — sem precisar confirmar e-mail.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1.5 flex items-center gap-3 rounded-lg bg-input border border-border px-4 py-3 focus-within:ring-2 focus-within:ring-ring">
        <span className="text-[oklch(0.7_0.12_70)]">{icon}</span>
        {children}
      </div>
    </label>
  );
}
