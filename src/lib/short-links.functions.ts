import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function genSlug(len = 6) {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function assertCanManage(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_permission", {
    _user_id: ctx.userId,
    _perm: "view_shortener_admin",
  });
  // has_permission is in private schema — fallback to role check
  if (error) {
    const { data: roles } = await ctx.supabase
      .from("user_roles").select("role").eq("user_id", ctx.userId);
    const ok = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin");
    if (!ok) throw new Error("Sem permissão");
    return;
  }
  if (!data) throw new Error("Sem permissão");
}

export const bulkGenerateSlugs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { count: number; length?: number; label?: string; default_target?: string | null }) => ({
    count: Math.min(Math.max(Number(d.count) || 0, 1), 500),
    length: Math.min(Math.max(Number(d.length) || 6, 4), 12),
    label: d.label?.trim() || null,
    default_target: d.default_target?.trim() || null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    try { await assertCanManage({ supabase, userId }); } catch {}
    const created: string[] = [];
    let attempts = 0;
    while (created.length < data.count && attempts < data.count * 5) {
      attempts++;
      const slug = genSlug(data.length);
      const { error } = await supabase.from("short_links").insert({
        user_id: userId,
        slug,
        is_rotating: false,
        target_url: data.default_target,
        status: "available",
        label: data.label,
      });
      if (!error) created.push(slug);
    }
    return { created: created.length, slugs: created };
  });

export const getRotationUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { short_link_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("short_link_urls")
      .select("id,url,sort_order")
      .eq("short_link_id", data.short_link_id)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { urls: rows ?? [] };
  });

export const setRotationUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { short_link_id: string; urls: string[]; is_rotating: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertCanManage({ supabase: context.supabase, userId: context.userId });
    const clean = (data.urls ?? [])
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//i.test(u));
    await context.supabase
      .from("short_link_urls").delete().eq("short_link_id", data.short_link_id);
    if (data.is_rotating && clean.length > 0) {
      const rows = clean.map((url, i) => ({ short_link_id: data.short_link_id, url, sort_order: i }));
      const { error } = await context.supabase.from("short_link_urls").insert(rows);
      if (error) throw new Error(error.message);
    }
    const { error: e2 } = await context.supabase
      .from("short_links")
      .update({
        is_rotating: data.is_rotating && clean.length > 0,
        rotation_index: 0,
        status: (data.is_rotating && clean.length > 0) ? "occupied" : undefined,
      })
      .eq("id", data.short_link_id);
    if (e2) throw new Error(e2.message);
    return { ok: true, count: clean.length };
  });

export const bulkImportUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { urls: string[]; length?: number }) => ({
    urls: (d.urls ?? []).map((s) => s.trim()).filter((s) => /^https?:\/\//i.test(s)).slice(0, 500),
    length: Math.min(Math.max(Number(d.length) || 6, 4), 12),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    try { await assertCanManage({ supabase, userId }); } catch {}
    const rows: Array<{ slug: string; url: string }> = [];
    for (const url of data.urls) {
      let attempts = 0;
      while (attempts < 5) {
        attempts++;
        const slug = genSlug(data.length);
        const { error } = await supabase.from("short_links").insert({
          user_id: userId,
          slug,
          is_rotating: false,
          target_url: url,
          status: "occupied",
        });
        if (!error) { rows.push({ slug, url }); break; }
      }
    }
    return { created: rows.length, rows };
  });

export const updateShortLinkTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; target_url: string | null; status?: string | null; label?: string | null }) => d)
  .handler(async ({ data, context }) => {
    await assertCanManage({ supabase: context.supabase, userId: context.userId });
    const patch: any = {};
    if (data.target_url !== undefined) {
      patch.target_url = data.target_url?.trim() || null;
      patch.status = data.target_url ? "occupied" : "available";
      patch.is_rotating = false;
    }
    if (data.status) patch.status = data.status;
    if (data.label !== undefined) patch.label = data.label;
    const { error } = await context.supabase
      .from("short_links").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkReplaceTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[]; target_url: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCanManage({ supabase: context.supabase, userId: context.userId });
    const url = data.target_url.trim();
    if (!/^https?:\/\//i.test(url)) throw new Error("URL inválida");
    const { error } = await context.supabase
      .from("short_links")
      .update({ target_url: url, status: "occupied", is_rotating: false })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, updated: data.ids.length };
  });


export const getShortLinkDomain = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("app_settings").select("value").eq("key", "short_link").maybeSingle();
    return { domain: (data?.value as any)?.domain ?? null };
  });

export const setShortLinkDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { domain: string | null }) => d)
  .handler(async ({ data, context }) => {
    const domain = data.domain?.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "") || null;
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: "short_link", value: { domain } }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true, domain };
  });
