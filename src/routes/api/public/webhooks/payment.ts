import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  campaign_id: z.string().uuid(),
  status: z.enum(["paid", "unpaid", "refunded"]).default("paid"),
  reference: z.string().optional(),
  method: z.string().optional().default("pix"),
});

export const Route = createFileRoute("/api/public/webhooks/payment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYMENT_WEBHOOK_SECRET;
        if (!secret) {
          return new Response("Webhook secret not configured", { status: 503 });
        }
        const provided = request.headers.get("x-webhook-secret") ?? new URL(request.url).searchParams.get("secret");
        if (provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: unknown;
        try { payload = await request.json(); }
        catch { return new Response("Invalid JSON", { status: 400 }); }

        const parsed = bodySchema.safeParse(payload);
        if (!parsed.success) {
          return Response.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
        }
        const { campaign_id, status, reference, method } = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const patch: Record<string, unknown> = {
          payment_status: status,
          payment_reference: reference ?? null,
          paid_method: status === "paid" ? method : null,
          paid_at: status === "paid" ? new Date().toISOString() : null,
        };
        const { error } = await supabaseAdmin.from("campaigns").update(patch as any).eq("id", campaign_id);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        // Disparo manual: admin precisa apertar play em /admin/pedidos.
        return Response.json({ ok: true });
      },
    },
  },
});
