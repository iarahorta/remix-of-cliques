import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

// Validador público de token — retorna só { token, active } ou null.
// Não expõe id, nome, %, nada além de "esse token existe e está ativo".
export const validatePartnerToken = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => ({ token: (d.token ?? "").trim() }))
  .handler(async ({ data }) => {
    if (!data.token || data.token.length < 4 || data.token.length > 24) return { ok: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.rpc("get_partner_by_token" as any, { _token: data.token });
    const row = Array.isArray(rows) && rows.length ? (rows[0] as any) : null;
    if (!row || !row.active) return { ok: false };
    return { ok: true, token: row.token as string };
  });

// Registra a visita atribuída (first-touch). Idempotente por (partner, visitor).
// Nunca sobrescreve atribuição existente do mesmo visitor.
export const trackReferralVisit = createServerFn({ method: "POST" })
  .inputValidator((d: {
    token: string; visitor_id: string;
    landing_url?: string; referer?: string;
    utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string; utm_term?: string;
  }) => d)
  .handler(async ({ data }) => {
    const token = (data.token ?? "").trim();
    const visitor = (data.visitor_id ?? "").trim();
    if (!token || !visitor) return { ok: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: partner } = await supabaseAdmin
      .from("partners")
      .select("id,public_token,status")
      .eq("public_token", token)
      .maybeSingle();
    if (!partner || (partner as any).status !== "active") return { ok: false };

    // First-touch: se já existe referral desse visitor, mantém o primeiro parceiro.
    const { data: existing } = await supabaseAdmin
      .from("partner_referrals")
      .select("id,partner_id")
      .eq("visitor_id", visitor)
      .order("first_seen_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existing) return { ok: true };

    let ip_hash: string | null = null;
    let user_agent: string | null = null;
    try {
      const req = getRequest();
      user_agent = req.headers.get("user-agent");
      const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
      if (ip) {
        const buf = new TextEncoder().encode(ip + ":" + (process.env.SUPABASE_URL ?? ""));
        const hash = await crypto.subtle.digest("SHA-256", buf);
        ip_hash = Array.from(new Uint8Array(hash)).slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
      }
    } catch {}

    await supabaseAdmin.from("partner_referrals").insert({
      partner_id: (partner as any).id,
      public_token: (partner as any).public_token,
      visitor_id: visitor,
      landing_url: data.landing_url ?? null,
      referer: data.referer ?? null,
      utm_source: data.utm_source ?? null,
      utm_medium: data.utm_medium ?? null,
      utm_campaign: data.utm_campaign ?? null,
      utm_content: data.utm_content ?? null,
      utm_term: data.utm_term ?? null,
      ip_hash,
      user_agent,
    } as any);
    return { ok: true };
  });

// Anexa a atribuição a um assinante recém-criado. Só corre se o assinante
// ainda não tem partner_id (imutável depois do primeiro set).
export async function attachAttributionToSubscriber(
  subscriberId: string,
  token: string | null | undefined,
  visitorId: string | null | undefined,
) {
  if (!token || !visitorId) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: sub } = await supabaseAdmin
    .from("link_subscribers")
    .select("id,partner_id")
    .eq("id", subscriberId)
    .maybeSingle();
  if (!sub || (sub as any).partner_id) return;
  const { data: partner } = await supabaseAdmin
    .from("partners")
    .select("id,status")
    .eq("public_token", token)
    .maybeSingle();
  if (!partner || (partner as any).status !== "active") return;

  const { data: ref } = await supabaseAdmin
    .from("partner_referrals")
    .select("id")
    .eq("visitor_id", visitorId)
    .eq("partner_id", (partner as any).id)
    .order("first_seen_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  await supabaseAdmin
    .from("link_subscribers")
    .update({
      partner_id: (partner as any).id,
      referral_id: (ref as any)?.id ?? null,
      attributed_at: nowIso,
    } as any)
    .eq("id", subscriberId);

  if ((ref as any)?.id) {
    await supabaseAdmin
      .from("partner_referrals")
      .update({ subscriber_id: subscriberId, attributed_at: nowIso } as any)
      .eq("id", (ref as any).id);
  }
}