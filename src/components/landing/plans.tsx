import { useQuery } from "@tanstack/react-query";
import { Check, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Plan = {
  id: string;
  name: string;
  price_label: string;
  period_label: string | null;
  description: string | null;
  features: string[];
  cta_label: string;
  cta_url: string;
  highlighted: boolean;
};

export function LandingPlans() {
  const { data, isLoading } = useQuery({
    queryKey: ["landing_plans_public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_plans" as any)
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Plan[];
    },
  });

  return (
    <section id="planos" className="mx-auto max-w-6xl px-5 py-20">
      <div className="text-center mb-12">
        <p className="text-[11px] uppercase tracking-[0.3em] text-gold-gradient">Planos</p>
        <h2 className="mt-3 font-display text-3xl sm:text-4xl">Escolha o plano ideal</h2>
        <p className="mt-3 text-sm text-muted-foreground max-w-xl mx-auto">
          Valores transparentes e atendimento consultivo para você focar no que importa: resultado.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card-premium p-8 h-96 animate-pulse opacity-50" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">
          Planos em breve. Fale com um consultor para uma proposta personalizada.
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => (
            <div
              key={p.id}
              className={`relative card-premium p-8 flex flex-col ${
                p.highlighted ? "ring-2 ring-[oklch(0.7_0.13_70)] shadow-[0_20px_60px_oklch(0.6_0.12_55_/_0.25)]" : ""
              }`}
            >
              {p.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-gold-metal px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
                  <Star className="h-3 w-3" /> Mais vendido
                </span>
              )}
              <h3 className="font-display text-2xl">{p.name}</h3>
              {p.description && (
                <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
              )}
              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-4xl text-gold-gradient">{p.price_label}</span>
                {p.period_label && (
                  <span className="text-xs text-muted-foreground">{p.period_label}</span>
                )}
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
                href={p.cta_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-8 inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold transition-all ${
                  p.highlighted
                    ? "bg-gold-metal hover:scale-[1.02]"
                    : "border border-[oklch(0.5_0.1_60_/_0.6)] bg-[oklch(0.15_0.02_60_/_0.5)] hover:bg-[oklch(0.2_0.03_60)]"
                }`}
              >
                {p.cta_label}
              </a>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
