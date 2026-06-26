import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Lock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Redefinir senha — HS Assessoria" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase recovery link drops tokens in the URL hash; the client picks them up automatically.
    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => {
      sub.data.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pwd.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    if (pwd !== confirm) return setError("As senhas não coincidem.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setLoading(false);
    if (error) return setError(error.message);
    setDone(true);
    setTimeout(() => navigate({ to: "/painel" }), 1500);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-background">
      <div className="w-full max-w-md card-premium p-6 md:p-8">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-5 w-5 text-[oklch(0.78_0.14_75)]" />
          <h1 className="text-xl font-semibold">Definir nova senha</h1>
        </div>

        {done ? (
          <div className="flex items-center gap-2 text-sm text-emerald-500">
            <CheckCircle2 className="h-4 w-4" /> Senha atualizada! Redirecionando…
          </div>
        ) : !ready ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Validando link de redefinição…
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nova senha</label>
              <input
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                className="w-full mt-1 rounded-lg bg-input border border-border px-3 py-2.5 text-sm"
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Confirmar senha</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full mt-1 rounded-lg bg-input border border-border px-3 py-2.5 text-sm"
                autoComplete="new-password"
                required
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gold-metal px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar nova senha
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
