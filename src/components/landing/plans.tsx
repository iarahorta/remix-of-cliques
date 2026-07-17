import { Check, Star, ArrowRight, ShieldCheck, FileBarChart, BadgeCheck, Link2, Sparkles } from "lucide-react";
import { WHATSAPP_URL } from "./whatsapp-fab";
import { Scroll3D } from "./scroll-3d";
import { trackClick, useSectionView } from "@/lib/pixel-tracking";


type Tier = { label: string; price: string; note?: string; promo?: boolean };

type Plan = {
  name: string;
  tag: string;
  unit: string;
  description: string;
  tiers: Tier[];
  features: string[];
  highlighted?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "White",
    tag: "Nichos white",
    unit: "por número entregue",
    description: "Para ofertas white-hat: infoprodutos, serviços, e-commerce, SaaS e nichos sem restrição.",
    tiers: [
      { label: "Acima de 5k", price: "R$ 0,17" },
      { label: "Acima de 20k", price: "R$ 0,15", note: "MELHOR PREÇO", promo: true },
    ],
    features: [
      "Lista mínima de 5.000 números",
      "Cobrança apenas por números entregues",
      "Relatório detalhado de entrega",
      "Higienização e validação inclusas",
      "Rotação inteligente de links",
      "Suporte consultivo dedicado",
    ],
    highlighted: true,
  },
  {
    name: "Opções Binárias",
    tag: "Nicho regulado",
    unit: "por número entregue",
    description: "Estrutura preparada para nichos sensíveis: trading, opções binárias e ofertas reguladas.",
    tiers: [
      { label: "Até 10k", price: "R$ 0,18" },
      { label: "Acima de 10k", price: "R$ 0,16", note: "PROMOÇÃO", promo: true },
    ],
    features: [
      "Lista mínima de 5.000 números",
      "Cobrança apenas por números entregues",
      "Relatório detalhado de entrega",
      "Infraestrutura blindada para o nicho",
      "Templates aprovados e copy otimizada",
      "Suporte consultivo dedicado",
    ],
  },
  {
    name: "Rifa",
    tag: "Nicho rifa",
    unit: "por número entregue",
    description: "Estrutura otimizada para rifas online: alta conversão, copy persuasiva e gestão de picos de tráfego.",
    tiers: [
      { label: "Até 10k", price: "R$ 0,19" },
      { label: "Acima de 10k", price: "R$ 0,17", note: "PROMOÇÃO", promo: true },
    ],
    features: [
      "Lista mínima de 5.000 números",
      "Cobrança apenas por números entregues",
      "Relatório detalhado de entrega",
      "Templates testados para rifas",
      "Rotação inteligente de links",
      "Suporte consultivo dedicado",
    ],
  },
];

const GUARANTEES = [
  { icon: BadgeCheck, title: "Só paga o que entregar", text: "Cobrança 100% por entrega confirmada. Número não entregue não é cobrado." },
  { icon: FileBarChart, title: "Relatórios detalhados", text: "Acompanhe entregas, falhas e métricas em tempo real direto no painel." },
  { icon: ShieldCheck, title: "Lista mínima de 5k", text: "Volume mínimo de 5.000 números por campanha para garantir performance." },
];

export function LandingPlans() {
  const ref = useSectionView<HTMLElement>("Plans");
  return (
    <section ref={ref} id="planos" className="mx-auto max-w-6xl px-5 py-20 [perspective:1400px]">

      <div className="text-center mb-12">
        <p className="text-[11px] uppercase tracking-[0.3em] text-gold-gradient">Tabela de preços</p>
        <h2 className="mt-3 font-display text-3xl sm:text-4xl">Preços por nicho</h2>
        <p className="mt-3 text-sm text-muted-foreground max-w-xl mx-auto">
          Valores transparentes, cobrança apenas pelos números entregues e relatórios completos de cada disparo.
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-[oklch(0.7_0.13_70_/_0.5)] bg-[oklch(0.25_0.08_70_/_0.35)] px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-gold-gradient">
          Pacotes mínimos de 5.000 envios
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
        {PLANS.map((p, idx) => (
          <Scroll3D key={p.name} delay={idx * 80} intensity={1.1} axis="mix">
            <div
              className={`relative card-premium p-8 flex flex-col h-full ${
                p.highlighted
                  ? "ring-2 ring-[oklch(0.78_0.15_80)] shadow-[0_25px_80px_oklch(0.7_0.15_70_/_0.35)] animate-pulse-gold"
                  : ""
              }`}
            >
              {p.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-gold-metal px-3 py-1 text-[10px] font-bold uppercase tracking-widest shadow-lg">
                  <Star className="h-3 w-3" /> Mais procurado
                </span>
              )}
              <p className="text-[10px] uppercase tracking-[0.25em] text-gold-gradient">{p.tag}</p>
              <h3 className="mt-2 font-display text-2xl">{p.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>

              <div className="mt-6 space-y-2">
                {p.tiers.map((t, i) => (
                  <div
                    key={i}
                    className={`flex items-baseline justify-between gap-3 rounded-lg px-3 py-2 ${
                      t.promo
                        ? "bg-[oklch(0.25_0.08_70_/_0.4)] border border-[oklch(0.7_0.13_70_/_0.5)]"
                        : "bg-[oklch(0.15_0.02_60_/_0.4)]"
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.label}</span>
                      {t.note && (
                        <span className="text-[9px] font-bold uppercase tracking-widest text-gold-gradient">
                          {t.note}
                        </span>
                      )}
                    </div>
                    <span className={`font-display ${t.promo ? "text-2xl text-gold-gradient" : "text-xl"}`}>
                      {t.price}
                    </span>
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground text-right pr-1">{p.unit}</p>
              </div>

              <ul className="mt-6 space-y-3 flex-1">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-[oklch(0.75_0.13_75)]" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackClick(`Plan_${p.name.replace(/\s+/g, "")}`, { plan: p.name })}

                className={`mt-8 inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all ${
                  p.highlighted
                    ? "bg-gold-metal hover:scale-[1.02]"
                    : "border border-[oklch(0.5_0.1_60_/_0.6)] bg-[oklch(0.15_0.02_60_/_0.5)] hover:bg-[oklch(0.2_0.03_60)]"
                }`}
              >
                Contratar agora <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </Scroll3D>
        ))}
      </div>

      {/* CTA Encurtador — atrai novos assinantes pro www.zpclik.site */}
      <Scroll3D delay={100} intensity={0.9}>
        <div className="mt-14 card-premium relative overflow-hidden p-8 md:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(600px circle at 15% 20%, oklch(0.55 0.14 70 / 0.35), transparent 60%), radial-gradient(500px circle at 85% 80%, oklch(0.7 0.15 75 / 0.25), transparent 55%)",
            }}
          />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-gold-gradient">
                <Sparkles className="h-3.5 w-3.5" /> Novo produto
              </p>
              <h3 className="mt-3 font-display text-2xl sm:text-3xl">
                Encurtador de links com rotação inteligente
              </h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Links curtos ilimitados no domínio <span className="font-semibold text-foreground">www.zpclik.site</span>,
                métricas de acessos reais (filtramos bots automaticamente) e rotação entre vários destinos —
                perfeito pra distribuir tráfego entre grupos, ofertas e páginas.
                <span className="block mt-1">Só R$ 19,90/mês. Assine em segundos.</span>
              </p>
            </div>
            <a
              href="/clientes"
              onClick={() => trackClick("Plan_Encurtador", { plan: "encurtador" })}
              className="shrink-0 inline-flex items-center justify-center gap-2 rounded-lg bg-gold-metal px-6 py-3 text-sm font-bold uppercase tracking-wider transition-transform hover:scale-[1.03]"
            >
              <Link2 className="h-4 w-4" /> Conhecer Encurtador
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </Scroll3D>


      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {GUARANTEES.map((g, i) => (
          <Scroll3D key={g.title} delay={i * 60} intensity={0.8}>
            <div className="card-premium p-6 flex gap-4 items-start h-full">
              <div className="h-10 w-10 shrink-0 rounded-lg bg-gold-metal flex items-center justify-center">
                <g.icon className="h-5 w-5 text-[oklch(0.2_0.02_50)]" />
              </div>
              <div>
                <p className="font-semibold text-sm">{g.title}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{g.text}</p>
              </div>
            </div>
          </Scroll3D>
        ))}
      </div>
    </section>
  );
}
