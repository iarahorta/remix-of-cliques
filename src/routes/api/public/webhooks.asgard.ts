import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/asgard")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const sig = request.headers.get("x-webhook-signature");
        const { verifyAsgardSignature } = await import("@/lib/asgard.server");
        const secret = process.env.ASGARD_WEBHOOK_SECRET;
        if (!secret) {
          console.error("ASGARD_WEBHOOK_SECRET not configured — rejecting webhook");
          return new Response("Webhook secret not configured", { status: 401 });
        }
        if (!verifyAsgardSignature(raw, sig)) {
          console.warn("[asgard-webhook] invalid signature", { hasSig: !!sig, bodyLen: raw.length });
          return new Response("Invalid signature", { status: 401 });
        }
        let payload: any;
        try { payload = JSON.parse(raw); } catch {
          console.warn("[asgard-webhook] bad json body");
          return new Response("bad json", { status: 400 });
        }

        const event = payload?.event as string | undefined;
        const orderId = payload?.order_id != null ? String(payload.order_id) : undefined;
        const status = payload?.status as string | undefined;
        if (!event || !orderId) {
          console.warn("[asgard-webhook] payload missing event/order_id", { event, orderId });
          return new Response("ok", { status: 200 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: charge } = await supabaseAdmin
          .from("asgard_pix_charges")
          .select("*")
          .eq("order_id", orderId)
          .maybeSingle();
        if (!charge) {
          console.warn("[asgard-webhook] charge not found in DB", { orderId, event });
          return new Response("ok", { status: 200 });
        }

        // Evento é a fonte da verdade — se veio order.completed, ignoramos qualquer
        // status divergente no payload (evita falso-positivo/negativo).
        const nextStatus =
          event === "order.completed" ? "completed"
          : event === "order.cancelled" ? "cancelled"
          : event === "order.expired" ? "expired"
          : event === "order.refunded" ? "refunded"
          : (status ?? (charge as any).status);

        await supabaseAdmin
          .from("asgard_pix_charges")
          .update({
            status: nextStatus,
            paid_at: nextStatus === "completed" ? new Date().toISOString() : (charge as any).paid_at,
          } as any)
          .eq("order_id", orderId);

        if (nextStatus === "completed" && (charge as any).status !== "completed") {
          const now = new Date();
          const subscriberId = (charge as any).subscriber_id;
          const { data: subRow } = await supabaseAdmin
            .from("link_subscribers").select("current_period_end").eq("id", subscriberId).maybeSingle();
          const currentEnd = (subRow as any)?.current_period_end ? new Date((subRow as any).current_period_end) : null;
          const from = currentEnd && currentEnd > now ? currentEnd : now;
          const next = new Date(from);
          next.setUTCDate(next.getUTCDate() + 30);
          const newEnd = next.toISOString().slice(0, 10);
          await supabaseAdmin.from("link_subscribers").update({
            status: "active",
            current_period_end: newEnd,
            last_payment_at: now.toISOString(),
            payment_method: "pix_asgard",
            asgard_last_charge_status: "completed",
          } as any).eq("id", subscriberId);
          console.info("[asgard-webhook] subscription extended", {
            subscriber_id: subscriberId,
            order_id: orderId,
            old_end: (subRow as any)?.current_period_end ?? null,
            new_end: newEnd,
          });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});