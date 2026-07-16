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
    const {
      upsertAsaasCustomer,
      createAsaasSubscription,
      listAsaasSubscriptionPayments,
    } = await import("./asaas.server");

    let sub = await loadSubscriber(context.userId);

    // 1) Ensure customer
    if (!sub.asaas_customer_id) {
      const email = (sub.email ?? "").trim();
      if (!email) {
        throw new Error("Complete seu cadastro (email) antes de gerar a cobrança.");
      }
      const name = (sub.name ?? "").trim() || email.split("@")[0];
      const cust = await upsertAsaasCustomer({
        name,
        email,
        mobilePhone: sub.phone ?? undefined,
        externalReference: sub.id,
      });
      const { error } = await supabaseAdmin
        .from("link_subscribers")
        .update({ asaas_customer_id: cust.id })
        .eq("id", sub.id);
      if (error) throw new Error(error.message);
      sub = { ...sub, asaas_customer_id: cust.id };
    }

    // 2) Ensure subscription
    if (!sub.asaas_subscription_id) {
      const created = await createAsaasSubscription({
        customer: sub.asaas_customer_id,
        value: PLAN_VALUE_BRL,
        nextDueDate: todayPlusDaysISO(2),
        billingType: "UNDEFINED",
        description: "cliques.site — assinatura mensal do encurtador",
        externalReference: sub.id,
      });
      const { error } = await supabaseAdmin
        .from("link_subscribers")
        .update({ asaas_subscription_id: created.id })
        .eq("id", sub.id);
      if (error) throw new Error(error.message);
      sub = { ...sub, asaas_subscription_id: created.id };
    }

    // 3) Find latest open payment
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
    if (!sub.asaas_subscription_id) return { invoiceUrl: null, dueDate: null, status: null, value: PLAN_VALUE_BRL };
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
