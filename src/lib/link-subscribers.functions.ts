import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function genSlug(len = 6) {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function assertStaff(ctx: { supabase: any; userId: string }) {
  // Try permission first
  const { data: permRows } = await ctx.supabase
    .from("user_permissions")
    .select("permission")
    .eq("user_id", ctx.userId)
    .eq("permission", "view_shortener_admin");
  if (permRows && permRows.length > 0) return;
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  const ok = (roles ?? []).some(
    (r: any) => r.role === "admin" || r.role === "super_admin",
  );
  if (!ok) throw new Error("Sem permissão");
}

async function requireActiveSubscription(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("link_subscribers")
    .select("id,status,current_period_end")
    .eq("id", ctx.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Assinatura não encontrada — complete seu cadastro.");
  const today = new Date().toISOString().slice(0, 10);
  if (data.status !== "active" || !data.current_period_end || data.current_period_end < today) {
    throw new Error("Assinatura inativa ou vencida — regularize o pagamento pra criar novos links.");
  }
  return data;
}

export const createSubscriberProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; email: string; phone: string }) => ({
    name: (d.name ?? "").trim(),
    email: (d.email ?? "").trim().toLowerCase(),
    phone: (d.phone ?? "").trim(),
  }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("link_subscribers")
      .select("id,status")
      .eq("id", context.userId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabaseAdmin
        .from("link_subscribers")
        .update({ name: data.name, email: data.email, phone: data.phone })
        .eq("id", context.userId);
      if (error) throw new Error(error.message);
      return { ok: true, created: false };
    }
    const { error } = await supabaseAdmin.from("link_subscribers").insert({
      id: context.userId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      status: "pending_payment",
    });
    if (error) throw new Error(error.message);
    return { ok: true, created: true };
  });

export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("link_subscribers")
      .select("id,name,email,phone,status,current_period_end,last_payment_at,plan_price_cents,payment_method,created_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { subscription: data ?? null };
  });

export const createSubscriberLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { target_url: string; label?: string | null }) => ({
    target_url: (d.target_url ?? "").trim(),
    label: (d.label ?? "")?.toString().trim() || null,
  }))
  .handler(async ({ data, context }) => {
    if (!/^https?:\/\//i.test(data.target_url)) {
      throw new Error("URL inválida — deve começar com http:// ou https://");
    }
    await requireActiveSubscription({ supabase: context.supabase, userId: context.userId });
    let slug = "";
    let inserted = false;
    for (let i = 0; i < 8 && !inserted; i++) {
      const candidate = genSlug(6);
      const { error } = await context.supabase.from("short_links").insert({
        user_id: context.userId,
        slug: candidate,
        is_rotating: false,
        target_url: data.target_url,
        status: "occupied",
        label: data.label,
        is_subscriber_link: true,
      });
      if (!error) {
        slug = candidate;
        inserted = true;
      }
    }
    if (!inserted) throw new Error("Não foi possível gerar um slug único, tente novamente.");
    return { slug, url: `https://cliques.site/r/${slug}` };
  });

export const listMySubscriberLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("short_links")
      .select("id,slug,target_url,label,click_count,status,created_at,last_clicked_at")
      .eq("user_id", context.userId)
      .eq("is_subscriber_link", true)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { links: data ?? [] };
  });

export const getMyLinkMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { shortLinkId: string }) => ({ shortLinkId: d.shortLinkId }))
  .handler(async ({ data, context }) => {
    const { data: link, error: linkErr } = await context.supabase
      .from("short_links")
      .select("id,slug,user_id")
      .eq("id", data.shortLinkId)
      .maybeSingle();
    if (linkErr) throw new Error(linkErr.message);
    if (!link || link.user_id !== context.userId) throw new Error("Link não encontrado");

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: clicks, error } = await context.supabase
      .from("short_link_clicks")
      .select("created_at,country,city,is_bot")
      .eq("short_link_id", link.id)
      .eq("is_bot", false)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);

    const rows = clicks ?? [];
    const byDay = new Map<string, number>();
    // Seed last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      byDay.set(key, 0);
    }
    const byCountry = new Map<string, number>();
    const byCity = new Map<string, number>();
    for (const c of rows) {
      const key = (c.created_at as string).slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
      if (c.country) byCountry.set(c.country, (byCountry.get(c.country) ?? 0) + 1);
      if (c.city) byCity.set(c.city, (byCity.get(c.city) ?? 0) + 1);
    }
    const daily = Array.from(byDay.entries()).map(([day, count]) => ({ day, count }));
    const topCountries = Array.from(byCountry.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    const topCities = Array.from(byCity.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return { total: rows.length, daily, topCountries, topCities };
  });

// ==================== ADMIN (staff) ====================

export const listSubscribersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff({ supabase: context.supabase, userId: context.userId });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("link_subscribers")
      .select("id,name,email,phone,status,current_period_end,last_payment_at,plan_price_cents,payment_method,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { subscribers: data ?? [] };
  });

export const markSubscriberPaidAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subscriberId: string }) => ({ subscriberId: d.subscriberId }))
  .handler(async ({ data, context }) => {
    await assertStaff({ supabase: context.supabase, userId: context.userId });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const { error } = await supabaseAdmin
      .from("link_subscribers")
      .update({
        status: "active",
        last_payment_at: now.toISOString(),
        current_period_end: end.toISOString().slice(0, 10),
        payment_method: "manual",
      })
      .eq("id", data.subscriberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const suspendSubscriberAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subscriberId: string }) => ({ subscriberId: d.subscriberId }))
  .handler(async ({ data, context }) => {
    await assertStaff({ supabase: context.supabase, userId: context.userId });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("link_subscribers")
      .update({ status: "suspended" })
      .eq("id", data.subscriberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
