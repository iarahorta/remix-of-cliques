import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ───────────────────────── helpers ─────────────────────────

async function assertInfobipPermission(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roleSet = new Set((roles ?? []).map((r: any) => r.role));
  if (roleSet.has("super_admin") || roleSet.has("admin")) return;
  const { data: perm } = await supabase
    .from("user_permissions" as any)
    .select("permission")
    .eq("user_id", userId)
    .eq("permission", "manage_infobip")
    .maybeSingle();
  if (!perm) throw new Error("Forbidden: requires manage_infobip permission");
}

async function getSettings() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "infobip").maybeSingle();
  const value = (data?.value as any) ?? {};
  return {
    base_url: (value.base_url as string | null) ?? null,
    default_sender: (value.default_sender as string | null) ?? null,
  };
}

function buildHeaders(apiKey: string) {
  return {
    Authorization: `App ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function requireCreds(settings: { base_url: string | null }, apiKey: string | undefined) {
  if (!settings.base_url) throw new Error("Base URL não configurada em /admin/infobip");
  if (!apiKey) throw new Error("INFOBIP_API_KEY não configurada nos Secrets");
  return { baseUrl: settings.base_url.replace(/\/$/, ""), apiKey };
}

// ───────────────────────── server fns ─────────────────────────

export const getInfobipStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertInfobipPermission(context.supabase, context.userId);
    const settings = await getSettings();
    const apiKey = process.env.INFOBIP_API_KEY ?? null;
    return {
      base_url: settings.base_url,
      default_sender: settings.default_sender,
      has_api_key: !!apiKey,
      webhook_url_template: `${process.env.SUPABASE_URL ? "" : ""}/api/public/webhooks/infobip`,
    };
  });

export const saveInfobipSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { base_url: string | null; default_sender: string | null }) =>
    z.object({
      base_url: z.string().url().nullable(),
      default_sender: z.string().nullable(),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertInfobipPermission(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: "infobip", value: { base_url: data.base_url, default_sender: data.default_sender } as any }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testInfobipConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertInfobipPermission(context.supabase, context.userId);
    const settings = await getSettings();
    const { baseUrl, apiKey } = requireCreds(settings, process.env.INFOBIP_API_KEY);
    const res = await fetch(`${baseUrl}/whatsapp/1/senders`, { headers: buildHeaders(apiKey) });
    const text = await res.text();
    if (!res.ok) return { ok: false, status: res.status, body: text.slice(0, 500) };
    let senders: string[] = [];
    try {
      const parsed = JSON.parse(text);
      senders = (parsed?.senders ?? parsed?.results ?? []).map((s: any) => s.sender ?? s.from ?? s.id).filter(Boolean);
    } catch { /* ignore */ }
    return { ok: true, status: res.status, senders };
  });

export const syncInfobipTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertInfobipPermission(context.supabase, context.userId);
    const settings = await getSettings();
    const { baseUrl, apiKey } = requireCreds(settings, process.env.INFOBIP_API_KEY);
    if (!settings.default_sender) throw new Error("Configure o Sender padrão em /admin/infobip");

    const res = await fetch(
      `${baseUrl}/whatsapp/2/senders/${encodeURIComponent(settings.default_sender)}/templates`,
      { headers: buildHeaders(apiKey) },
    );
    if (!res.ok) throw new Error(`Infobip ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const payload = await res.json() as any;
    const items: any[] = payload?.templates ?? payload?.results ?? [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let upserted = 0;
    for (const t of items) {
      const body = t?.structure?.body?.text ?? t?.body ?? "";
      const header = t?.structure?.header ?? null;
      const footer = t?.structure?.footer?.text ?? t?.footer ?? null;
      const buttons = t?.structure?.buttons ?? [];
      const urlBtn = buttons.find?.((b: any) => b?.type === "URL");
      const row = {
        name: t.name,
        language: t.language ?? "pt_BR",
        category: t.category ?? "MARKETING",
        status: (t.status ?? "PENDING").toUpperCase(),
        status_reason: t.rejectionReason ?? t.statusReason ?? null,
        header_type: header?.format ?? null,
        header_text: header?.text ?? null,
        body_text: body,
        footer_text: footer,
        button_url_pattern: urlBtn?.url ?? null,
        button_text: urlBtn?.text ?? null,
        infobip_template_id: t.id ?? null,
        last_synced_at: new Date().toISOString(),
      };
      const { error } = await supabaseAdmin.from("wa_templates").upsert(row as any, { onConflict: "name,language" });
      if (!error) upserted += 1;
    }
    return { ok: true, count: upserted };
  });

export const createInfobipTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    name: string; language: string; category: string; body_text: string;
    header_text?: string | null; footer_text?: string | null;
    button_text?: string | null; button_url_pattern?: string | null;
  }) => data)
  .handler(async ({ context, data }) => {
    await assertInfobipPermission(context.supabase, context.userId);
    const settings = await getSettings();
    const { baseUrl, apiKey } = requireCreds(settings, process.env.INFOBIP_API_KEY);
    if (!settings.default_sender) throw new Error("Configure o Sender padrão em /admin/infobip");

    const structure: any = { body: { text: data.body_text } };
    if (data.header_text) structure.header = { format: "TEXT", text: data.header_text };
    if (data.footer_text) structure.footer = { text: data.footer_text };
    if (data.button_text && data.button_url_pattern) {
      structure.buttons = [{ type: "URL", text: data.button_text, url: data.button_url_pattern }];
    }

    const res = await fetch(
      `${baseUrl}/whatsapp/2/senders/${encodeURIComponent(settings.default_sender)}/templates`,
      {
        method: "POST",
        headers: buildHeaders(apiKey),
        body: JSON.stringify({
          name: data.name, language: data.language, category: data.category, structure,
        }),
      },
    );
    const text = await res.text();
    if (!res.ok) throw new Error(`Infobip ${res.status}: ${text.slice(0, 400)}`);
    const payload = (() => { try { return JSON.parse(text); } catch { return {}; } })() as any;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("wa_templates").upsert({
      name: data.name, language: data.language, category: data.category,
      status: (payload?.status ?? "PENDING").toUpperCase(),
      header_type: data.header_text ? "TEXT" : null,
      header_text: data.header_text ?? null,
      body_text: data.body_text,
      footer_text: data.footer_text ?? null,
      button_url_pattern: data.button_url_pattern ?? null,
      button_text: data.button_text ?? null,
      infobip_template_id: payload?.id ?? null,
      last_synced_at: new Date().toISOString(),
      created_by: context.userId,
    } as any, { onConflict: "name,language" });

    return { ok: true, status: (payload?.status ?? "PENDING").toUpperCase() };
  });

export const deleteInfobipTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertInfobipPermission(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("wa_templates").delete().eq("id", data.id);
    return { ok: true };
  });

export const dispatchInfobipCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { campaign_id: string }) =>
    z.object({ campaign_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertInfobipPermission(context.supabase, context.userId);
    const { runInfobipDispatch } = await import("@/lib/infobip-core.server");
    const result = await runInfobipDispatch(data.campaign_id);
    if (!result.ok) throw new Error(result.reason);
    return result;
  });

/** Bulk-create N variants of a template name suffixed _01.._NN for A/B approval. */
export const createInfobipTemplateBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    base_name: string; variants: number; language: string; category: string;
    body_text: string; header_text?: string | null; footer_text?: string | null;
    button_text?: string | null; button_url_pattern?: string | null;
  }) => data)
  .handler(async ({ context, data }) => {
    await assertInfobipPermission(context.supabase, context.userId);
    const settings = await getSettings();
    const { baseUrl, apiKey } = requireCreds(settings, process.env.INFOBIP_API_KEY);
    if (!settings.default_sender) throw new Error("Configure o Sender padrão em /admin/infobip");
    const count = Math.max(1, Math.min(20, Math.floor(data.variants || 1)));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const results: Array<{ name: string; ok: boolean; status?: string; error?: string }> = [];
    for (let i = 1; i <= count; i++) {
      const name = count === 1 ? data.base_name : `${data.base_name}_${String(i).padStart(2, "0")}`;
      const structure: any = { body: { text: data.body_text } };
      if (data.header_text) structure.header = { format: "TEXT", text: data.header_text };
      if (data.footer_text) structure.footer = { text: data.footer_text };
      if (data.button_text && data.button_url_pattern) {
        structure.buttons = [{ type: "URL", text: data.button_text, url: data.button_url_pattern }];
      }
      try {
        const res = await fetch(
          `${baseUrl}/whatsapp/2/senders/${encodeURIComponent(settings.default_sender)}/templates`,
          {
            method: "POST",
            headers: buildHeaders(apiKey),
            body: JSON.stringify({ name, language: data.language, category: data.category, structure }),
          },
        );
        const text = await res.text();
        if (!res.ok) { results.push({ name, ok: false, error: `${res.status}: ${text.slice(0, 200)}` }); continue; }
        const payload = (() => { try { return JSON.parse(text); } catch { return {}; } })() as any;
        await supabaseAdmin.from("wa_templates").upsert({
          name, language: data.language, category: data.category,
          status: (payload?.status ?? "PENDING").toUpperCase(),
          header_type: data.header_text ? "TEXT" : null,
          header_text: data.header_text ?? null,
          body_text: data.body_text,
          footer_text: data.footer_text ?? null,
          button_url_pattern: data.button_url_pattern ?? null,
          button_text: data.button_text ?? null,
          infobip_template_id: payload?.id ?? null,
          last_synced_at: new Date().toISOString(),
          created_by: context.userId,
        } as any, { onConflict: "name,language" });
        results.push({ name, ok: true, status: (payload?.status ?? "PENDING").toUpperCase() });
      } catch (e: any) {
        results.push({ name, ok: false, error: e?.message ?? "erro" });
      }
    }
    return { results, ok: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length };
  });

/** Returns approved Infobip templates for use in the campaign wizard. */
export const listApprovedInfobipTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("wa_templates")
      .select("id, name, language, body_text, header_text, footer_text, button_text, button_url_pattern")
      .eq("status", "APPROVED")
      .order("name");
    return (data ?? []) as Array<{
      id: string; name: string; language: string; body_text: string;
      header_text: string | null; footer_text: string | null;
      button_text: string | null; button_url_pattern: string | null;
    }>;
  });
