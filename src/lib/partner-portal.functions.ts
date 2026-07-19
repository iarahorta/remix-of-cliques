import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getMyPartner(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("partners")
    .select("*")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export const getMyPartnerOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const partner = await getMyPartner(context.userId);
    if (!partner) return { partner: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: refs }, { data: subs }, { data: comms }] = await Promise.all([
      supabaseAdmin.from("partner_referrals").select("id,subscriber_id").eq("partner_id", partner.id),
      supabaseAdmin.from("link_subscribers").select("id,status,name,email,created_at,current_period_end,last_payment_at").eq("partner_id", partner.id).order("created_at", { ascending: false }),
      supabaseAdmin.from("partner_commissions").select("gross_cents,net_cents,commission_cents,status,created_at,paid_at").eq("partner_id", partner.id),
    ]);
    const commissions = comms ?? [];
    const totals = commissions.reduce((acc: any, r: any) => {
      const c = Number(r.commission_cents ?? 0);
      acc.gross += Number(r.gross_cents ?? 0);
      acc.net += Number(r.net_cents ?? 0);
      acc.total += c;
      if (r.status === "pending") acc.pending += c;
      else if (r.status === "approved") acc.approved += c;
      else if (r.status === "paid") acc.paid += c;
      return acc;
    }, { gross: 0, net: 0, total: 0, pending: 0, approved: 0, paid: 0 });
    return {
      partner,
      referrals_total: refs?.length ?? 0,
      referrals_converted: (refs ?? []).filter((r: any) => r.subscriber_id).length,
      subscribers: subs ?? [],
      subscribers_active: (subs ?? []).filter((s: any) => s.status === "active").length,
      totals,
    };
  });

export const listMyPartnerCommissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const partner = await getMyPartner(context.userId);
    if (!partner) return { commissions: [] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("partner_commissions")
      .select("id,created_at,gross_cents,gateway_fee_cents,net_cents,commission_bps,commission_cents,status,paid_at,paid_ref,source_type,link_subscribers(name,email)")
      .eq("partner_id", partner.id)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (data.status) q = q.eq("status", data.status as any);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { commissions: rows ?? [] };
  });

export const listMyPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const partner = await getMyPartner(context.userId);
    if (!partner) return { payouts: [], available_cents: 0, pending_cents: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: payouts }, { data: approved }] = await Promise.all([
      supabaseAdmin.from("partner_payouts").select("*").eq("partner_id", partner.id).order("created_at", { ascending: false }),
      supabaseAdmin.from("partner_commissions")
        .select("commission_cents,status,payout_id")
        .eq("partner_id", partner.id)
        .eq("status", "approved")
        .is("payout_id", null),
    ]);
    const available_cents = (approved ?? []).reduce((s: number, r: any) => s + Number(r.commission_cents ?? 0), 0);
    const pending_cents = (payouts ?? [])
      .filter((p: any) => p.status === "requested")
      .reduce((s: number, p: any) => s + Number(p.total_cents ?? 0), 0);
    return { payouts: payouts ?? [], available_cents, pending_cents };
  });

export const requestMyPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { notes?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const partner = await getMyPartner(context.userId);
    if (!partner) throw new Error("Você não é um parceiro cadastrado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: approved, error: qErr } = await supabaseAdmin
      .from("partner_commissions")
      .select("id,commission_cents")
      .eq("partner_id", partner.id)
      .eq("status", "approved")
      .is("payout_id", null);
    if (qErr) throw new Error(qErr.message);
    const rows = approved ?? [];
    const total = rows.reduce((s: number, r: any) => s + Number(r.commission_cents ?? 0), 0);
    if (total <= 0 || rows.length === 0) throw new Error("Nenhuma comissão aprovada disponível para saque.");
    const { data: payout, error: pErr } = await supabaseAdmin
      .from("partner_payouts")
      .insert({
        partner_id: partner.id,
        total_cents: total,
        status: "requested",
        notes: data.notes || null,
      } as any)
      .select()
      .single();
    if (pErr) throw new Error(pErr.message);
    const { error: uErr } = await supabaseAdmin
      .from("partner_commissions")
      .update({ payout_id: payout.id } as any)
      .in("id", rows.map((r: any) => r.id));
    if (uErr) throw new Error(uErr.message);
    return { payout };
  });
