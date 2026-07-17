import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PLAN_VALUE_BRL = 19.9;

function todayPlusDaysISO(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function loadSubscriber(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("link_subscribers")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Assinatura não encontrada — complete seu cadastro.");
  return data as any;
}

export const ensureSubscriberBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createAsaasPaymentLink, listAsaasSubscriptionPayments } = await import("./asaas.server");

    let sub = await loadSubscriber(context.userId);
    const email = (sub.email ?? "").trim();
    if (!email) {
      throw new Error("Complete seu cadastro (email) antes de gerar a cobrança.");
    }

    // For new subscribers, use an Asaas recurring payment link. This lets the
    // payer fill CPF/CNPJ and payment details on Asaas, avoiding customer-API
    // failures when the app only has name/email/phone.
    if (!sub.asaas_subscription_id && !sub.asaas_payment_link_url) {
      const created = await createAsaasPaymentLink({
        name: "www.zpclik.site — assinatura mensal",
        value: PLAN_VALUE_BRL,
        billingType: "UNDEFINED",
        chargeType: "RECURRENT",
        subscriptionCycle: "MONTHLY",
        description: `Assinatura mensal do encurtador — ${email}`,
        externalReference: sub.id,
        dueDateLimitDays: 3,
        notificationEnabled: true,
        isAddressRequired: false,
      });
      if (!created?.url) throw new Error("O Asaas não retornou o link de pagamento.");
      const { error } = await supabaseAdmin
        .from("link_subscribers")
        .update({
          asaas_payment_link_id: created.id,
          asaas_payment_link_url: created.url,
          asaas_last_invoice_url: created.url,
        } as any)
        .eq("id", sub.id);
      if (error) throw new Error(error.message);
      sub = { ...sub, asaas_payment_link_id: created.id, asaas_payment_link_url: created.url };
    }

    if (!sub.asaas_subscription_id) {
      return {
        invoiceUrl: sub.asaas_payment_link_url ?? null,
        dueDate: null,
        status: "PENDING",
        value: PLAN_VALUE_BRL,
      };
    }

    const payments = await listAsaasSubscriptionPayments(sub.asaas_subscription_id);
    const list: any[] = payments?.data ?? [];
    const open = list.find((p) => p.status === "PENDING" || p.status === "OVERDUE" || p.status === "AWAITING_RISK_ANALYSIS")
      ?? list[0]
      ?? null;
    return {
      invoiceUrl: open?.invoiceUrl ?? null,
      dueDate: open?.dueDate ?? null,
      status: open?.status ?? null,
      value: open?.value ?? PLAN_VALUE_BRL,
    };
  });

export const getSubscriberInvoiceStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sub = await loadSubscriber(context.userId);
    if (!sub.asaas_subscription_id) return { invoiceUrl: sub.asaas_payment_link_url ?? null, dueDate: null, status: sub.asaas_payment_link_url ? "PENDING" : null, value: PLAN_VALUE_BRL };
    const { listAsaasSubscriptionPayments } = await import("./asaas.server");
    const payments = await listAsaasSubscriptionPayments(sub.asaas_subscription_id);
    const list: any[] = payments?.data ?? [];
    const open = list.find((p) => p.status === "PENDING" || p.status === "OVERDUE" || p.status === "AWAITING_RISK_ANALYSIS")
      ?? list[0]
      ?? null;
    return {
      invoiceUrl: open?.invoiceUrl ?? null,
      dueDate: open?.dueDate ?? null,
      status: open?.status ?? null,
      value: open?.value ?? PLAN_VALUE_BRL,
    };
  });

export const cancelSubscriberBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { cancelAsaasSubscription } = await import("./asaas.server");
    const sub = await loadSubscriber(context.userId);
    if (sub.asaas_subscription_id) {
      try { await cancelAsaasSubscription(sub.asaas_subscription_id); } catch { /* ignore — may already be cancelled */ }
    }
    const { error } = await supabaseAdmin
      .from("link_subscribers")
      .update({ asaas_subscription_id: null, status: "suspended" })
      .eq("id", sub.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
