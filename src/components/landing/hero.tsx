import { ArrowRight, Sparkles } from "lucide-react";
import { WHATSAPP_URL } from "./whatsapp-fab";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[oklch(0.6_0.14_70_/_0.18)] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-[oklch(0.5_0.12_55_/_0.18)] blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-5 pt-20 pb-24 sm:pt-28 sm:pb-32 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[oklch(0.5_0.1_60_/_0.5)] bg-[oklch(0.18_0.02_60_/_0.6)] px-4 py-1.5 text-[11px] uppercase tracking-[0.25em] text-gold-gradient">
          <Sparkles className="h-3.5 w-3.5" /> Disparos premium em escala
        </span>

        <h1 className="mt-8 font-display text-4xl sm:text-6xl md:text-7xl leading-[1.05] tracking-tight">
          <span className="text-foreground">Alta performance em </span>
          <span className="text-gold-gradient">disparos de WhatsApp</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
          Estratégia, segurança e entrega — a HS Assessoria conecta sua oferta a milhares de números
          válidos com infraestrutura oficial e atendimento consultivo.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-gold-metal px-7 py-3.5 text-sm font-semibold tracking-wide hover:scale-[1.02] transition-transform"
          >
            Falar com Consultor <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#planos"
            className="inline-flex items-center gap-2 rounded-lg border border-[oklch(0.5_0.1_60_/_0.5)] bg-[oklch(0.15_0.02_60_/_0.5)] px-7 py-3.5 text-sm font-medium text-foreground hover:bg-[oklch(0.2_0.03_60)] transition-colors"
          >
            Ver planos
          </a>
        </div>

        <div className="mt-14 grid grid-cols-3 max-w-2xl mx-auto gap-6 text-center">
          {[
            { v: "+10M", l: "Disparos entregues" },
            { v: "99,2%", l: "Taxa de entrega" },
            { v: "24/7", l: "Suporte dedicado" },
          ].map((s) => (
            <div key={s.l}>
              <p className="font-display text-2xl sm:text-3xl text-gold-gradient">{s.v}</p>
              <p className="mt-1 text-[11px] sm:text-xs uppercase tracking-[0.18em] text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
