import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LandingTopBar } from "@/components/landing/top-bar";
import { LandingHero } from "@/components/landing/hero";
import { LandingBenefits } from "@/components/landing/benefits";
import { LandingPlans } from "@/components/landing/plans";
import { LandingFooter } from "@/components/landing/footer";
import { WhatsAppFab } from "@/components/landing/whatsapp-fab";
import { Portal } from "@/routes/portal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HS Assessoria — Disparos de WhatsApp com alta performance" },
      { name: "description", content: "Disparos em massa premium com estratégia, segurança e entrega oficial. Fale com um consultor da HS Assessoria." },
      { property: "og:title", content: "HS Assessoria — Disparos de WhatsApp com alta performance" },
      { property: "og:description", content: "Disparos em massa premium com estratégia, segurança e entrega oficial." },
    ],
  }),
  component: IndexRouter,
});

function IndexRouter() {
  const [host, setHost] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") setHost(window.location.hostname);
  }, []);

  // Enquanto SSR/primeiro paint: renderiza landing (safe default).
  // No client, se for cliques.site → mostra Portal no lugar.
  const isClicks = host === "cliques.site" || host === "www.cliques.site";
  if (isClicks) return <Portal />;

  return (
    <div className="min-h-screen bg-background">
      <LandingTopBar />
      <LandingHero />
      <LandingBenefits />
      <LandingPlans />
      <LandingFooter />
      <WhatsAppFab />
    </div>
  );
}
