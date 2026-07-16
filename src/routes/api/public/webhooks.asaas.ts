import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/asaas")({
  server: {
    handlers: {
      GET: async () => new Response("ok"),
      POST: async ({ request }) => {
        const token = request.headers.get("asaas-access-token");
        const expected = process.env.ASAAS_WEBHOOK_TOKEN;
        if (!expected || !token || token !== expected) {
          return new Response("unauthorized", { status: 401 });
        }
        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("bad request", { status: 400 });
        }
        const event: string = body?.event ?? "";
        const payment = body?.payment;
        if (!payment) return Response.json({ ok: true, ignored: "no payment" });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Resolve subscriber id — prefer payment.externalReference, fallback to customer/subscription lookup
        let subscriberId: string | null = payment.externalReference ?? null;
        if (!subscriberId && payment.subscription) {
          const { data } = await supabaseAdmin
            .from("link_subscribers")
            .select("id")
            .eq("asaas_subscription_id", payment.subscription)
            .maybeSingle();
          subscriberId = (data as any)?.id ?? null;
        }
        if (!subscriberId && payment.paymentLink) {
          const { data } = await (supabaseAdmin as any)
            .from("link_subscribers")
            .select("id")
            .eq("asaas_payment_link_id", payment.paymentLink)
            .maybeSingle();
          subscriberId = (data as any)?.id ?? null;
        }
        if (!subscriberId && payment.customer) {
          const { data } = await supabaseAdmin
            .from("link_subscribers")
            .select("id")
            .eq("asaas_customer_id", payment.customer)
            .maybeSingle();
          subscriberId = (data as any)?.id ?? null;
        }
        if (!subscriberId) return Response.json({ ok: true, ignored: "no subscriber" });

        const patch: Record<string, any> = {
          asaas_last_payment_id: payment.id,
          asaas_last_payment_status: payment.status,
          asaas_last_invoice_url: payment.invoiceUrl ?? null,
          updated_at: new Date().toISOString(),
        };
        if (payment.customer) patch.asaas_customer_id = payment.customer;
        if (payment.subscription) patch.asaas_subscription_id = payment.subscription;

        if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
          patch.status = "active";
          patch.overdue_since = null;
          patch.payment_method = payment.billingType ?? "asaas";
          const now = new Date();
          const { data: cur } = await supabaseAdmin
            .from("link_subscribers")
            .select("current_period_end")
            .eq("id", subscriberId)
            .maybeSingle();
          const curEnd = (cur as any)?.current_period_end
            ? new Date((cur as any).current_period_end)
            : null;
          const base = curEnd && curEnd > now ? curEnd : now;
          const end = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
          patch.current_period_end = end.toISOString().slice(0, 10);
          patch.last_payment_at = now.toISOString();
        } else if (event === "PAYMENT_OVERDUE") {
          patch.status = "pending_payment";
          patch.overdue_since = new Date().toISOString();
        } else if (
          event === "PAYMENT_REFUNDED" ||
          event === "PAYMENT_CHARGEBACK_REQUESTED" ||
          event === "PAYMENT_CHARGEBACK_DISPUTE"
        ) {
          patch.status = "suspended";
        }

        const { error } = await supabaseAdmin
          .from("link_subscribers")
          .update(patch as any)
          .eq("id", subscriberId);
        if (error) {
          console.error("[asaas webhook] update failed", error.message);
          return new Response("update failed", { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
