import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  const ok = (data ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin");
  if (!ok) throw new Error("Sem permissão");
}

export const listPartners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("partners")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { partners: data ?? [] };
  });

export const createPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    name: string; type: string; email?: string; phone?: string;
    tax_id?: string; pix_key?: string; pix_key_type?: string;
    default_commission_bps: number; notes?: string;
  }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const name = (data.name ?? "").trim();
    if (!name) throw new Error("Nome obrigatório.");
    const bps = Math.max(0, Math.min(10000, Math.round(data.default_commission_bps)));
    const { data: row, error } = await context.supabase
      .from("partners")
      .insert({
        name,
        type: data.type as any,
        email: data.email || null,
        phone: data.phone || null,
        tax_id: data.tax_id || null,
        pix_key: data.pix_key || null,
        pix_key_type: data.pix_key_type || null,
        default_commission_bps: bps,
        notes: data.notes || null,
      } as any)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { partner: row };
  });

export const updatePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id: string;
    name?: string; type?: string; email?: string | null; phone?: string | null;
    tax_id?: string | null; pix_key?: string | null; pix_key_type?: string | null;
    default_commission_bps?: number; status?: string; notes?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const patch: any = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.type !== undefined) patch.type = data.type as any;
    if (data.email !== undefined) patch.email = data.email || null;
    if (data.phone !== undefined) patch.phone = data.phone || null;
    if (data.tax_id !== undefined) patch.tax_id = data.tax_id || null;
    if (data.pix_key !== undefined) patch.pix_key = data.pix_key || null;
    if (data.pix_key_type !== undefined) patch.pix_key_type = data.pix_key_type || null;
    if (data.status !== undefined) patch.status = data.status as any;
    if (data.notes !== undefined) patch.notes = data.notes || null;
    if (data.default_commission_bps !== undefined) {
      patch.default_commission_bps = Math.max(0, Math.min(10000, Math.round(data.default_commission_bps)));
    }
    const { error } = await context.supabase.from("partners").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rotatePartnerToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: newTok, error: fnErr } = await supabaseAdmin.rpc("generate_partner_token" as any);
    if (fnErr) throw new Error(fnErr.message);
    const { error } = await context.supabase
      .from("partners")
      .update({ public_token: newTok as any })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { token: newTok };
  });

export const listCommissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { partnerId?: string; status?: string }) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase
      .from("partner_commissions")
      .select("*, partners(name,public_token,type,pix_key), link_subscribers(name,email)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.partnerId) q = q.eq("partner_id", data.partnerId);
    if (data.status) q = q.eq("status", data.status as any);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { commissions: rows ?? [] };
  });

export const updateCommissionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "approved" | "paid" | "canceled" | "reversed"; paid_ref?: string; paid_method?: string; notes?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const patch: any = { status: data.status };
    if (data.status === "paid") {
      patch.paid_at = new Date().toISOString();
      patch.paid_method = data.paid_method || "pix_manual";
      patch.paid_ref = data.paid_ref || null;
    }
    if (data.notes !== undefined) patch.notes = data.notes || null;
    const { error } = await context.supabase
      .from("partner_commissions")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPartnerDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { partnerId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const [{ data: partner }, { data: refs }, { data: subs }, { data: comms }] = await Promise.all([
      context.supabase.from("partners").select("*").eq("id", data.partnerId).maybeSingle(),
      context.supabase.from("partner_referrals").select("id,subscriber_id,first_seen_at").eq("partner_id", data.partnerId),
      context.supabase.from("link_subscribers").select("id,status,current_period_end,last_payment_at").eq("partner_id", data.partnerId),
      context.supabase.from("partner_commissions").select("gross_cents,net_cents,commission_cents,status,created_at").eq("partner_id", data.partnerId),
    ]);
    return {
      partner,
      referrals_total: refs?.length ?? 0,
      referrals_converted: (refs ?? []).filter((r: any) => r.subscriber_id).length,
      subscribers_total: subs?.length ?? 0,
      subscribers_active: (subs ?? []).filter((s: any) => s.status === "active").length,
      commissions: comms ?? [],
    };
  });

export const listGatewayFeeRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("gateway_fee_rules")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rules: data ?? [] };
  });

export const upsertGatewayFeeRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; gateway: string; method: string; fixed_cents: number; percent_bps: number; active: boolean; notes?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id) {
      const { error } = await context.supabase.from("gateway_fee_rules").update({
        gateway: data.gateway, method: data.method,
        fixed_cents: Math.max(0, Math.round(data.fixed_cents)),
        percent_bps: Math.max(0, Math.min(10000, Math.round(data.percent_bps))),
        active: data.active, notes: data.notes || null,
      }).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("gateway_fee_rules").insert({
        gateway: data.gateway, method: data.method,
        fixed_cents: Math.max(0, Math.round(data.fixed_cents)),
        percent_bps: Math.max(0, Math.min(10000, Math.round(data.percent_bps))),
        active: data.active, notes: data.notes || null,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
export const listPayoutsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; partnerId?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase
      .from("partner_payouts")
      .select("*, partners(name,public_token,pix_key,pix_key_type,tax_id,email)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status) q = q.eq("status", data.status);
    if (data.partnerId) q = q.eq("partner_id", data.partnerId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { payouts: rows ?? [] };
  });

export const updatePayoutStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "paid" | "canceled"; paid_ref?: string; notes?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.status === "paid") {
      const { error: e1 } = await supabaseAdmin
        .from("partner_payouts")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          paid_ref: data.paid_ref || null,
          notes: data.notes ?? undefined,
        } as any)
        .eq("id", data.id);
      if (e1) throw new Error(e1.message);
      const { error: e2 } = await supabaseAdmin
        .from("partner_commissions")
        .update({ status: "paid", paid_at: new Date().toISOString(), paid_method: "pix_manual", paid_ref: data.paid_ref || null } as any)
        .eq("payout_id", data.id);
      if (e2) throw new Error(e2.message);
    } else {
      const { error: e1 } = await supabaseAdmin
        .from("partner_payouts")
        .update({ status: "canceled", notes: data.notes ?? undefined } as any)
        .eq("id", data.id);
      if (e1) throw new Error(e1.message);
      const { error: e2 } = await supabaseAdmin
        .from("partner_commissions")
        .update({ payout_id: null } as any)
        .eq("payout_id", data.id);
      if (e2) throw new Error(e2.message);
    }
    return { ok: true };
  });
