import { ShieldCheck, Zap, Target } from "lucide-react";

const items = [
  {
    icon: ShieldCheck,
    title: "Segurança e Compliance",
    text: "Infraestrutura oficial, números higienizados e rotinas para preservar reputação e evitar bloqueios.",
  },
  {
    icon: Zap,
    title: "Performance em Escala",
    text: "Disparos rápidos, com rotação inteligente de links e relatórios em tempo real para acompanhar tudo.",
  },
  {
    icon: Target,
    title: "Estratégia Sob Medida",
    text: "Consultoria que adapta copy, segmentação e horário ao seu nicho para maximizar conversão.",
  },
];

export function LandingBenefits() {
  return (
    <section id="beneficios" className="mx-auto max-w-6xl px-5 py-20">
      <div className="text-center mb-12">
        <p className="text-[11px] uppercase tracking-[0.3em] text-gold-gradient">Por que HS Assessoria</p>
        <h2 className="mt-3 font-display text-3xl sm:text-4xl">A diferença está na estratégia</h2>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {items.map((it) => (
          <div
            key={it.title}
            className="card-premium p-7 group hover:-translate-y-1 transition-transform"
          >
            <div className="h-12 w-12 rounded-xl bg-gold-metal flex items-center justify-center mb-5">
              <it.icon className="h-6 w-6 text-[oklch(0.2_0.02_50)]" />
            </div>
            <h3 className="font-display text-xl mb-2">{it.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{it.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
