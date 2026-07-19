import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Link2,
  BarChart3,
  Shuffle,
  MessageCircle,
  QrCode,
  Bot,
  Zap,
  Globe,
  Check,
  ArrowRight,
  ShieldCheck,
  Clock,
  Rocket,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import logoAsset from "@/assets/zpclik-logo.png.asset.json";

function GoldStar() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-[#f0c95a]" aria-hidden>
      <path d="M12 2l2.9 6.9L22 10l-5.5 4.8L18.2 22 12 18.3 5.8 22l1.7-7.2L2 10l7.1-1.1L12 2z" />
    </svg>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[oklch(0.32_0.04_80/_0.25)] bg-[oklch(0.12_0.008_60/_0.85)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <a href="/" className="flex items-center gap-2">
          <img src={logoAsset.url} alt="zpclik" className="h-10 w-10 rounded-lg object-cover ring-1 ring-[oklch(0.5_0.1_80/_0.4)]" />
          <span className="font-display text-lg tracking-wide">
            <span className="text-gold-gradient">zp</span>clik
          </span>
        </a>
        <nav className="hidden gap-8 text-sm text-muted-foreground md:flex">
          <a href="#recursos" className="hover:text-foreground">Recursos</a>
          <a href="#como-funciona" className="hover:text-foreground">Como funciona</a>
          <a href="#precos" className="hover:text-foreground">Preços</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/clientes"
            className="hidden rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground md:inline-block"
          >
            Entrar
          </Link>
          <Link
            to="/clientes"
            className="rounded-lg bg-gold-metal px-4 py-2 text-sm font-bold transition-transform hover:scale-[1.03]"
          >
            Começar
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const generatePreview = () => {
    if (!/^https?:\/\//i.test(url.trim())) return;
    const slug = Math.random().toString(36).slice(2, 8);
    setPreview(`https://www.zpclik.site/r/${slug}`);
  };

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(700px circle at 20% 10%, rgba(212,165,55,0.18), transparent 55%), radial-gradient(600px circle at 85% 30%, rgba(247,224,138,0.10), transparent 60%)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-2 md:py-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[oklch(0.5_0.1_80/_0.4)] bg-[oklch(0.22_0.03_75/_0.4)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-gold-gradient">
            <Sparkles className="h-3 w-3" /> Encurtador premium
          </p>
          <h1 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            Encurtador de links com{" "}
            <span className="text-gold-gradient">rotação inteligente</span> e analytics de verdade.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
            Distribua tráfego entre vários destinos, acompanhe cada acesso em tempo real (filtramos bots
            automaticamente) e crie links de WhatsApp em segundos.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/clientes"
              className="inline-flex items-center gap-2 rounded-lg bg-gold-metal px-6 py-3 text-sm font-bold uppercase tracking-wider transition-transform hover:scale-[1.03]"
            >
              Assinar por R$ 19,90/mês <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex items-center gap-2 rounded-lg border border-[oklch(0.5_0.1_80/_0.5)] bg-[oklch(0.2_0.02_70/_0.4)] px-6 py-3 text-sm font-semibold hover:bg-[oklch(0.24_0.03_70/_0.5)]"
            >
              Ver como funciona
            </a>
          </div>

          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <GoldStar /><GoldStar /><GoldStar /><GoldStar /><GoldStar />
            <span>Sem fidelidade · Cancele quando quiser</span>
          </div>
        </div>

        {/* Demo card */}
        <div className="card-premium p-6 md:p-8">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Link2 className="h-4 w-4 text-[#f0c95a]" /> Teste na prática
          </p>
          <div className="mt-5 space-y-3">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Cole sua URL longa aqui..."
              className="w-full rounded-lg border border-[oklch(0.3_0.02_70/_0.5)] bg-[oklch(0.12_0.008_60)] px-4 py-3 text-sm outline-none focus:border-[#d4a537]"
            />
            <button
              onClick={generatePreview}
              className="w-full rounded-lg bg-gold-metal py-3 text-sm font-bold uppercase tracking-wider transition-transform hover:scale-[1.02]"
            >
              Encurtar link
            </button>
          </div>
          {preview && (
            <div className="mt-5 rounded-lg border border-[oklch(0.5_0.1_80/_0.4)] bg-[oklch(0.18_0.03_75/_0.5)] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Seu link curto (preview):
              </p>
              <p className="mt-2 break-all font-mono text-sm text-gold-gradient">{preview}</p>
              <Link
                to="/clientes"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#f0c95a] hover:underline"
              >
                Assinar para ativar este link <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}
          <p className="mt-4 text-[11px] text-muted-foreground">
            Links criados no domínio <span className="font-semibold text-foreground">www.zpclik.site</span>.
          </p>
        </div>
      </div>

      {/* Trust strip */}
      <div className="mx-auto grid max-w-6xl gap-4 border-t border-[oklch(0.32_0.04_80/_0.2)] px-5 py-8 md:grid-cols-4">
        {[
          { icon: Zap, title: "Setup instantâneo", text: "Crie e ative em segundos" },
          { icon: Bot, title: "Sem bots na métrica", text: "Filtro automático de crawlers" },
          { icon: Shuffle, title: "Rotação de destinos", text: "Round-robin ou aleatório" },
          { icon: ShieldCheck, title: "SSL + uptime", text: "Infra profissional 24/7" },
        ].map((it) => (
          <div key={it.title} className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-bronze-metal">
              <it.icon className="h-4 w-4 text-[#f0c95a]" />
            </div>
            <div>
              <p className="text-sm font-semibold">{it.title}</p>
              <p className="text-xs text-muted-foreground">{it.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: BarChart3, title: "Analytics em tempo real", text: "Cliques, país, cidade, dispositivo e referência. Tudo filtrado, sem bot poluindo seu dashboard." },
  { icon: Shuffle, title: "Rotação inteligente", text: "Adicione vários destinos por link e distribua tráfego em modo round-robin, aleatório ou por peso." },
  { icon: MessageCircle, title: "Link do WhatsApp", text: "Cole o número + mensagem e gere um wa.me curto pronto pra vender. Sem enrolação." },
  { icon: QrCode, title: "QR Code embutido", text: "Todo link vira QR na hora — perfeito pra offline, panfleto, adesivo e stand." },
  { icon: Bot, title: "Filtro anti-bot", text: "Detectamos crawlers, previews de rede social e bots automatizados. Métrica limpa de verdade." },
  { icon: Zap, title: "Edição sem quebrar", text: "Trocou a oferta? Edite o destino a qualquer momento — o slug continua o mesmo." },
  { icon: Globe, title: "Domínio profissional", text: "Todos os links no domínio zpclik.site — curtinho, memorável e com SSL garantido." },
  { icon: Clock, title: "Histórico completo", text: "Baixe CSV dos últimos acessos, filtre por período e analise fora da plataforma." },
];

function Features() {
  return (
    <section id="recursos" className="mx-auto max-w-6xl px-5 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gold-gradient">
          Tudo o que um encurtador sério precisa
        </p>
        <h2 className="mt-3 font-display text-3xl sm:text-4xl">
          Ferramentas <span className="text-gold-gradient">premium</span> pra escalar seu tráfego
        </h2>
        <p className="mt-4 text-sm text-muted-foreground md:text-base">
          Foi construído por quem vive de tráfego pago, WhatsApp e social. Cada recurso resolve uma dor real.
        </p>
      </div>

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="card-premium p-6 transition-transform hover:-translate-y-1">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-gold-metal">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-lg">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  { n: "01", title: "Assine em 1 minuto", text: "Cadastro rápido e pagamento via Pix. Sem burocracia, sem cartão, sem boleto." },
  { n: "02", title: "Crie seu link", text: "Cole a URL, escolha um slug (ou deixe automático) e ative rotação se quiser." },
  { n: "03", title: "Divulgue onde quiser", text: "WhatsApp, Instagram, TikTok, tráfego pago, e-mail — o link é seu." },
  { n: "04", title: "Acompanhe e otimize", text: "Veja acessos reais em tempo real, exporte CSV e ajuste a campanha." },
];

function HowItWorks() {
  return (
    <section id="como-funciona" className="border-y border-[oklch(0.32_0.04_80/_0.2)] bg-[oklch(0.12_0.008_60)]">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gold-gradient">
            Como funciona
          </p>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl">
            Do cadastro ao primeiro clique em <span className="text-gold-gradient">4 passos</span>
          </h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="card-premium p-6">
              <p className="font-display text-3xl text-gold-gradient">{s.n}</p>
              <h3 className="mt-3 font-display text-lg">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const features = [
    "Links curtos ilimitados",
    "Rotação inteligente entre destinos",
    "Analytics em tempo real (sem bots)",
    "Link de WhatsApp em 1 clique",
    "Exportação em CSV",
    "Edição de destino sem quebrar o slug",
    "Domínio zpclik.site com SSL",
    "Suporte prioritário",
  ];
  return (
    <section id="precos" className="mx-auto max-w-6xl px-5 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gold-gradient">
          Preço direto ao ponto
        </p>
        <h2 className="mt-3 font-display text-3xl sm:text-4xl">
          Um plano. <span className="text-gold-gradient">Tudo incluso.</span>
        </h2>
        <p className="mt-4 text-sm text-muted-foreground md:text-base">
          Nada de tier free travado, nada de upgrade forçado. Um preço fixo com tudo liberado.
        </p>
      </div>

      <div className="mx-auto mt-14 max-w-lg">
        <div className="card-premium relative overflow-hidden p-8 md:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full opacity-30 blur-3xl"
            style={{ background: "radial-gradient(circle, #d4a537, transparent 70%)" }}
          />
          <span className="inline-flex items-center gap-1 rounded-full bg-gold-metal px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
            <Rocket className="h-3 w-3" /> Plano zpclik Pro
          </span>
          <div className="mt-6 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground line-through decoration-red-500/70 decoration-2">DE R$ 39,90</span>
              <span className="rounded-full bg-red-500/15 text-red-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">-50%</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs uppercase tracking-widest text-[#f0c95a]">por apenas</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-5xl text-gold-gradient">R$ 19,90</span>
              <span className="text-sm text-muted-foreground">/mês</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            🔥 Oferta de lançamento por tempo limitado. Preço trava enquanto sua assinatura estiver ativa.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pagamento mensal via Pix. Você recebe a cobrança no painel e paga em segundos. Cancele quando quiser.
          </p>

          <ul className="mt-8 space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#f0c95a]" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <Link
            to="/clientes"
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-gold-metal py-4 text-sm font-bold uppercase tracking-wider transition-transform hover:scale-[1.02]"
          >
            Quero assinar agora <ArrowRight className="h-4 w-4" />
          </Link>

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Sem fidelidade · Sem taxa de setup · Suporte humano
          </p>
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: "Posso usar meu próprio domínio?",
    a: "Não. Para manter o preço em R$ 19,90/mês e a infra 100% blindada, todos os links usam o domínio www.zpclik.site + um slug curto (ex: zpclik.site/r/abc123). Você pode escolher o slug que quiser (se estiver disponível).",
  },
  {
    q: "Quantos links posso criar?",
    a: "Ilimitado. Enquanto sua assinatura estiver ativa, você cria quantos links quiser, sem cota.",
  },
  {
    q: "Como funciona a rotação de destinos?",
    a: "Você cadastra vários URLs de destino num mesmo link curto. A cada clique o zpclik envia o visitante pra um destino diferente (round-robin ou aleatório) — perfeito pra distribuir carga entre grupos de WhatsApp, ofertas ou landing pages.",
  },
  {
    q: "Consigo editar o destino depois?",
    a: "Sim. Você troca o destino a qualquer momento sem alterar o link curto — todo mundo que já recebeu continua funcionando.",
  },
  {
    q: "As métricas contam bot?",
    a: "Não. Filtramos automaticamente bots, crawlers e previews de rede social (WhatsApp, Facebook, Twitter etc.), então o número que aparece no dashboard é de gente de verdade.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim, sem fidelidade e sem multa. Cancela pelo painel e pronto.",
  },
  {
    q: "Como funciona o pagamento?",
    a: "Mensalidade via Pix. Todo mês você gera um Pix pelo painel (QR Code + copia e cola) e paga em segundos. Assim que o pagamento é confirmado, sua conta é liberada por mais 30 dias automaticamente. Sem cartão, sem boleto, sem débito automático.",
  },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 py-20">
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gold-gradient">FAQ</p>
        <h2 className="mt-3 font-display text-3xl sm:text-4xl">Perguntas frequentes</h2>
      </div>
      <div className="mt-10 space-y-3">
        {FAQS.map((f, i) => (
          <button
            key={f.q}
            onClick={() => setOpen(open === i ? null : i)}
            className="card-premium w-full p-5 text-left transition-colors"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="font-semibold">{f.q}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[#f0c95a] transition-transform ${open === i ? "rotate-180" : ""}`}
              />
            </div>
            {open === i && (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative overflow-hidden border-t border-[oklch(0.32_0.04_80/_0.2)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(500px circle at 50% 20%, rgba(212,165,55,0.25), transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-3xl px-5 py-24 text-center">
        <h2 className="font-display text-4xl sm:text-5xl">
          Pare de perder <span className="text-gold-gradient">cliques</span>.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground md:text-lg">
          Cada link que você compartilha sem medir é dinheiro na mesa. Comece hoje por R$ 19,90/mês
          e transforme seu tráfego em dado.
        </p>
        <Link
          to="/clientes"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-gold-metal px-8 py-4 text-sm font-bold uppercase tracking-wider transition-transform hover:scale-[1.03]"
        >
          Assinar zpclik agora <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-4 text-xs text-muted-foreground">
          Sem fidelidade · Cancele quando quiser · Suporte humano
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[oklch(0.32_0.04_80/_0.2)] bg-[oklch(0.1_0.008_60)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-xs text-muted-foreground md:flex-row">
        <div className="flex items-center gap-2">
          <div className="grid h-6 w-6 place-items-center rounded bg-gold-metal">
            <Link2 className="h-3 w-3" />
          </div>
          <span>© {new Date().getFullYear()} zpclik — Todos os direitos reservados.</span>
        </div>
        <div className="flex gap-5">
          <a href="#recursos" className="hover:text-foreground">Recursos</a>
          <a href="#precos" className="hover:text-foreground">Preços</a>
          <Link to="/clientes" className="hover:text-foreground">Entrar</Link>
        </div>
      </div>
    </footer>
  );
}

export function LandingZpclik() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}