import { createFileRoute } from "@tanstack/react-router";
import { Portal } from "@/routes/portal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "zpclik — Encurtador de Links Inteligente" },
      { name: "description", content: "Encurte links, acompanhe cliques reais e distribua tráfego com rotação inteligente." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Portal,
});
