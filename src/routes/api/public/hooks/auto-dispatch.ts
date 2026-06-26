import { createFileRoute } from "@tanstack/react-router";

// Disparo automático foi desativado a pedido do admin.
// Mantido como no-op para não quebrar cron antigo enquanto a job não é removida.
export const Route = createFileRoute("/api/public/hooks/auto-dispatch")({
  server: {
    handlers: {
      POST: async () =>
        Response.json({ ok: true, disabled: true, message: "Auto-dispatch desativado. Use o botão Disparar em /admin/pedidos." }),
    },
  },
});
