import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PLAN_VALUE_BRL = 19.9;

export const createAsgardPixCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createAsgardPix } = await import("./asgard.server");

    const { data: sub, error: subErr } = await supabaseAdmin
      .from("link_subscribers")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (subErr) throw new Error(subErr.message);
    if (!sub) throw new Error("Assinatura não encontrada — complete seu cadastro.");
    const email = ((sub as any).email ?? "").trim();
    if (!email) throw new Error("Complete seu cadastro (email) antes de gerar o PIX.");

    // Reaproveita cobrança pendente recente (últimos 5min) — casa com o timer da UI.
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existing } = await supabaseAdmin
      .from("asgard_pix_charges")
      .select("*")
      .eq("subscriber_id", sub.id)
      .eq("status", "pending")
      .gte("created_at", fiveMinAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing && (existing as any).copy_paste) {
      return {
        orderId: (existing as any).order_id,
        copyPaste: (existing as any).copy_paste,
        qrcode: (existing as any).qrcode,
        amount: Number((existing as any).amount),
        status: (existing as any).status,
        createdAt: (existing as any).created_at as string,
        expiresInSec: 5 * 60,
      };
    }

    const idem = `sub-${sub.id}-${Date.now()}`;
    let pix;
    try {
      pix = await createAsgardPix({
        amount: PLAN_VALUE_BRL,
        email,
        name: (sub as any).name ?? undefined,
        phone: (sub as any).phone ?? undefined,
        externalReference: sub.id,
        idempotencyKey: idem,
      });
    } catch (err: any) {
      console.error("[asgard] createAsgardPix falhou", err);
      const raw = String(err?.message ?? err ?? "erro desconhecido");
      // Erros comuns: 401/403 (chaves), 400 (payload inválido/cpf exigido), 5xx.
      if (/401|403|unauthor/i.test(raw)) {
        throw new Error("Gateway de pagamento recusou as credenciais. Contate o suporte.");
      }
      throw new Error("Não foi possível gerar o PIX agora. Tente novamente em instantes ou chame o suporte.");
    }

    const createdAtIso = new Date().toISOString();
    await supabaseAdmin.from("asgard_pix_charges").insert({
      subscriber_id: sub.id,
      order_id: String(pix.order_id),
      transaction_id: pix.transaction_id ?? null,
      status: pix.status ?? "pending",
      amount: PLAN_VALUE_BRL,
      copy_paste: pix.copy_paste ?? null,
      qrcode: pix.qrcode ?? null,
    } as any);

    await supabaseAdmin
      .from("link_subscribers")
      .update({
        asgard_last_order_id: String(pix.order_id),
        asgard_last_charge_status: pix.status ?? "pending",
      } as any)
      .eq("id", sub.id);

    return {
      orderId: String(pix.order_id),
      copyPaste: pix.copy_paste ?? null,
      qrcode: pix.qrcode ?? null,
      amount: PLAN_VALUE_BRL,
      status: pix.status ?? "pending",
      createdAt: createdAtIso,
      expiresInSec: 5 * 60,
    };
  });

export const getAsgardChargeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getAsgardOrder } = await import("./asgard.server");

    const { data: charge } = await supabaseAdmin
      .from("asgard_pix_charges")
      .select("*")
      .eq("order_id", data.orderId)
      .eq("subscriber_id", context.userId)
      .maybeSingle();
    if (!charge) throw new Error("Cobrança não encontrada.");

    // Poll Asgard to keep DB in sync (reconciliation fallback)
    try {
      const remote = await getAsgardOrder(data.orderId);
      if (remote.status && remote.status !== (charge as any).status) {
        await supabaseAdmin
          .from("asgard_pix_charges")
          .update({
            status: remote.status,
            paid_at: remote.status === "completed" ? new Date().toISOString() : (charge as any).paid_at,
          } as any)
          .eq("order_id", data.orderId);

        if (remote.status === "completed" && (charge as any).status !== "completed") {
          // Extend subscription by 30 days
          const now = new Date();
          const base = (charge as any).subscriber_id;
          const { data: subRow } = await supabaseAdmin
            .from("link_subscribers").select("current_period_end").eq("id", base).maybeSingle();
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
          } as any).eq("id", base);
        }
        return { status: remote.status };
      }
    } catch {
      /* ignore reconciliation errors */
    }
    return { status: (charge as any).status };
  });