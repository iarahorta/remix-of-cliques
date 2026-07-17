import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Lock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Redefinir senha — zpclik" }, { name: "robots", content: "noindex,nofollow" }] }),
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
    setTimeout(() => navigate({ to: "/encurtador" }), 1500);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-slate-50">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-6 md:p-8">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-5 w-5 text-[#0b3d91]" />
          <h1 className="text-xl font-semibold text-slate-900">Definir nova senha</h1>
        </div>

        {done ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> Senha atualizada! Redirecionando…
          </div>
        ) : !ready ? (
          <p className="text-sm text-slate-500 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Validando link de redefinição…
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Nova senha</label>
              <input
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                className="w-full mt-1 rounded-lg bg-white border border-slate-300 px-3 py-2.5 text-sm focus:border-[#0b3d91] focus:ring-2 focus:ring-sky-100 outline-none"
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Confirmar senha</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full mt-1 rounded-lg bg-white border border-slate-300 px-3 py-2.5 text-sm focus:border-[#0b3d91] focus:ring-2 focus:ring-sky-100 outline-none"
                autoComplete="new-password"
                required
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0b3d91] hover:bg-[#0a3582] text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
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
