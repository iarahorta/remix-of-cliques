import { createFileRoute } from "@tanstack/react-router";
import { LandingZpclik } from "@/components/landing-zpclik";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "zpclik — Encurtador de Links Premium com Rotação e Analytics" },
      { name: "description", content: "Encurtador profissional: rotação inteligente entre destinos, analytics em tempo real (sem bots) e link do WhatsApp em 1 clique. R$ 19,90/mês." },
      { name: "robots", content: "index,follow" },
      { property: "og:title", content: "zpclik — Encurtador Premium" },
      { property: "og:description", content: "Rotação inteligente, analytics reais e link de WhatsApp em segundos. R$ 19,90/mês." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingZpclik,
});
