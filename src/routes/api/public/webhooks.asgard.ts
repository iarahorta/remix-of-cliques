import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/asgard")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const sig = request.headers.get("x-webhook-signature");
        const { verifyAsgardSignature } = await import("@/lib/asgard.server");
        const secret = process.env.ASGARD_WEBHOOK_SECRET;
        if (secret) {
          if (!verifyAsgardSignature(raw, sig)) {
            return new Response("Invalid signature", { status: 401 });
          }
        }
        let payload: any;
        try { payload = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

        const event = payload?.event as string | undefined;
        const orderId = payload?.order_id != null ? String(payload.order_id) : undefined;
        const status = payload?.status as string | undefined;
        if (!event || !orderId) return new Response("ok", { status: 200 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: charge } = await supabaseAdmin
          .from("asgard_pix_charges")
          .select("*")
          .eq("order_id", orderId)
          .maybeSingle();
        if (!charge) return new Response("ok", { status: 200 });

        const nextStatus = status ?? (event === "order.completed" ? "completed" : event === "order.cancelled" ? "cancelled" : event === "order.expired" ? "expired" : event === "order.refunded" ? "refunded" : (charge as any).status);

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
          await supabaseAdmin.from("link_subscribers").update({
            status: "active",
            current_period_end: next.toISOString().slice(0, 10),
            last_payment_at: now.toISOString(),
            payment_method: "pix_asgard",
            asgard_last_charge_status: "completed",
          } as any).eq("id", subscriberId);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});