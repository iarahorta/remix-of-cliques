import { createFileRoute } from "@tanstack/react-router";
import { Portal } from "@/routes/portal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Portal do Cliente — Acesso Seguro" },
      { name: "description", content: "Portal do cliente para acesso a serviços e atendimento online." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Portal,
});
