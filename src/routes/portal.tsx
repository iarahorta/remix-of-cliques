import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  Lock, User, ShieldCheck, HelpCircle, Smartphone,
  MessageCircle, CheckCircle2, ChevronDown, Mail, Phone, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Portal do Cliente — Acesso Seguro" },
      { name: "description", content: "Portal do cliente para acesso a serviços e atendimento online." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  beforeLoad: ({ location }) => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (!host.includes("cliques.site") && host !== "localhost" && !host.includes("lovable")) {
        throw notFound();
      }
    }
    return { location };
  },
  component: Portal,
});

export function Portal() {
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setErr("Não foi possível validar seus dados. Tente novamente em instantes.");
    }, 1400);
  };

  const faqs = [
    { q: "É seguro acessar pelo portal?", a: "Sim. Todo o tráfego é criptografado e seus dados são protegidos do início ao fim da sessão." },
    { q: "Esqueci minha senha, e agora?", a: "Clique em 'Esqueci minha senha' na tela de login e siga as instruções enviadas por e-mail ou SMS." },
    { q: "Posso acessar pelo celular?", a: "Sim. O portal é totalmente responsivo e funciona bem em qualquer dispositivo." },
    { q: "Não recebi o token por SMS, o que faço?", a: "Aguarde até 2 minutos e clique em 'Reenviar token'. Verifique também se o número está correto." },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold tracking-tight text-slate-800">
            <div className="h-7 w-7 rounded-md bg-[#0b3d91] text-white flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
            Portal do Cliente
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <a href="#sobre" className="hover:text-[#0b3d91]">Sobre</a>
            <a href="#passos" className="hover:text-[#0b3d91]">Como funciona</a>
            <a href="#faq" className="hover:text-[#0b3d91]">FAQ</a>
            <a href="#contato" className="hover:text-[#0b3d91]">Contato</a>
          </nav>
          <div className="text-xs text-slate-500 hidden sm:flex items-center gap-1">
            <Lock className="h-3.5 w-3.5" /> Conexão segura
          </div>
        </div>
      </header>

      {/* Hero / Login */}
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 -z-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.10),transparent_60%),radial-gradient(ellipse_at_bottom_left,rgba(11,61,145,0.08),transparent_55%)]" />
        <div className="relative max-w-6xl mx-auto px-4 py-12 md:py-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-sky-50 text-[#0b3d91] border border-sky-100">
              <ShieldCheck className="h-3.5 w-3.5" /> Acesso seguro e verificado
            </span>
            <h1 className="mt-4 text-3xl md:text-5xl font-bold leading-tight text-slate-900 tracking-tight">
              Seu portal de atendimento <span className="text-[#0b3d91]">online</span>.
            </h1>
            <p className="mt-4 text-slate-600 text-sm md:text-base max-w-md leading-relaxed">
              Acesse sua conta para consultar informações, falar com nosso time e resolver tudo de onde estiver — rápido, simples e seguro.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> 100% online</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Atendimento 24h</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Dados protegidos</span>
            </div>
          </div>

          <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-slate-200/80 text-slate-800">
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-xl font-semibold tracking-tight">Acesse sua conta</h2>
              <p className="text-sm text-slate-500 mt-1">Informe seus dados para continuar.</p>
            </div>

            <form className="px-6 py-4 space-y-4" onSubmit={onSubmit}>
              <div>
                <label className="text-xs font-medium text-slate-600">CPF</label>
                <div className="mt-1 flex items-center border border-slate-300 rounded-lg px-3 focus-within:border-[#0b3d91] focus-within:ring-2 focus-within:ring-sky-100 transition">
                  <User className="h-4 w-4 text-slate-400" />
                  <input
                    inputMode="numeric"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full px-2 py-2.5 text-sm outline-none bg-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Senha</label>
                <div className="mt-1 flex items-center border border-slate-300 rounded-lg px-3 focus-within:border-[#0b3d91] focus-within:ring-2 focus-within:ring-sky-100 transition">
                  <Lock className="h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-2 py-2.5 text-sm outline-none bg-transparent"
                  />
                </div>
              </div>

              {err && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {err}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0b3d91] hover:bg-[#0a3582] text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60 transition shadow-sm"
              >
                {loading ? "Validando..." : "Entrar"}
              </button>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <a href="#" className="hover:text-[#0b3d91]">Esqueci minha senha</a>
                <a href="#faq" className="hover:text-[#0b3d91] flex items-center gap-1">
                  <HelpCircle className="h-3.5 w-3.5" /> Preciso de ajuda
                </a>
              </div>
            </form>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 rounded-b-2xl text-[11px] text-slate-500 text-center">
              Ambiente protegido. Seus dados trafegam de forma criptografada.
            </div>
          </div>
        </div>
      </section>

      {/* Sobre */}
      <section id="sobre" className="py-16 md:py-20 bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-semibold tracking-widest text-[#0b3d91] uppercase">Sobre o portal</span>
            <h2 className="mt-2 text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Tudo o que você precisa em um só lugar.
            </h2>
            <p className="mt-4 text-slate-600 text-sm md:text-base leading-relaxed">
              Um espaço único, seguro e intuitivo para acessar suas informações, acompanhar solicitações e falar com nossa equipe sempre que precisar.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate-700">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" /> Acesso simples com login protegido.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" /> Atendimento integrado por múltiplos canais.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" /> Tudo 100% online, sem filas nem burocracia.</li>
            </ul>
          </div>

          {/* Mock phone illustration */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute -inset-6 bg-sky-100 rounded-full blur-2xl opacity-60" />
              <div className="relative w-56 h-[420px] bg-slate-900 rounded-[2.5rem] p-3 shadow-2xl">
                <div className="w-full h-full bg-white rounded-[2rem] overflow-hidden flex flex-col">
                  <div className="bg-[#0b3d91] text-white text-xs px-4 py-3 flex items-center justify-between">
                    <span>Portal</span>
                    <ShieldCheck className="h-3 w-3" />
                  </div>
                  <div className="p-4 flex-1 space-y-3">
                    <div className="h-3 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                    <div className="mt-4 p-3 bg-sky-50 rounded-lg border border-sky-100">
                      <div className="text-[10px] text-sky-700 font-semibold">MINHA CONTA</div>
                      <div className="mt-1 text-sm font-bold text-slate-800">Bem-vindo!</div>
                      <div className="mt-2 h-7 bg-[#0b3d91] rounded text-white text-[10px] flex items-center justify-center">Acessar</div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <div className="text-[10px] text-slate-500">NOTIFICAÇÕES</div>
                      <div className="mt-1 text-sm font-bold text-slate-800">2 novas</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Passo a passo */}
      <section id="passos" className="py-16 md:py-20 bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center">
            <span className="text-xs font-semibold tracking-widest text-[#0b3d91] uppercase">Como funciona</span>
            <h2 className="mt-2 text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Em 3 passos você está dentro.
            </h2>
            <p className="text-slate-500 text-sm mt-2">Rápido, leve e sem complicação.</p>
          </div>

          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {[
              {
                n: 1,
                icon: <Smartphone className="h-5 w-5" />,
                t: "Passo 1",
                d: "Informe seu CPF e celular para receber o token via SMS. Depois é só inserir o código e seguir.",
              },
              {
                n: 2,
                icon: <MessageCircle className="h-5 w-5" />,
                t: "Passo 2",
                d: "Escolha o canal de atendimento que preferir — WhatsApp, e-mail ou direto no portal.",
              },
              {
                n: 3,
                icon: <CheckCircle2 className="h-5 w-5" />,
                t: "Passo 3",
                d: "Pronto! Agora você acessa todas as funcionalidades do portal de forma simples e segura.",
              },
            ].map((s) => (
              <div key={s.n} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#0b3d91] text-white flex items-center justify-center shadow-sm">
                    {s.icon}
                  </div>
                  <div className="text-[#0b3d91] font-semibold tracking-wide text-sm">{s.t.toUpperCase()}</div>
                </div>
                <p className="mt-4 text-sm text-slate-600 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 md:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center">
            <span className="text-xs font-semibold tracking-widest text-[#0b3d91] uppercase">FAQ</span>
            <h2 className="mt-2 text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Perguntas frequentes
            </h2>
          </div>
          <div className="mt-8 divide-y divide-slate-200 border border-slate-200 rounded-2xl overflow-hidden bg-white">
            {faqs.map((f, i) => {
              const open = faqOpen === i;
              return (
                <div key={i} className="bg-white">
                  <button
                    onClick={() => setFaqOpen(open ? null : i)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-800 text-sm">{f.q}</span>
                    <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open && (
                    <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed">{f.a}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contato */}
      <section id="contato" className="py-12 bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-3 gap-6 text-sm">
          <div>
            <div className="font-semibold text-base mb-2">Portal do Cliente</div>
            <p className="opacity-70 text-xs leading-relaxed">
              Plataforma online para acesso e atendimento dos nossos clientes.
            </p>
          </div>
          <div>
            <div className="font-semibold mb-2">Atendimento</div>
            <div className="flex items-center gap-2 opacity-90"><Phone className="h-4 w-4" /> 0800 000 0000</div>
            <div className="mt-1 flex items-center gap-2 opacity-90"><Mail className="h-4 w-4" /> atendimento@portal.com</div>
          </div>
          <div>
            <div className="font-semibold mb-2">Segurança</div>
            <div className="flex items-center gap-2 opacity-90"><ShieldCheck className="h-4 w-4" /> Dados criptografados</div>
            <div className="mt-1 flex items-center gap-2 opacity-90"><Lock className="h-4 w-4" /> Ambiente protegido</div>
          </div>
        </div>
      </section>

      <footer className="py-6 text-center text-xs text-slate-500 bg-slate-950 text-slate-400">
        © {new Date().getFullYear()} Portal do Cliente. Todos os direitos reservados.
      </footer>
    </div>
  );
}
