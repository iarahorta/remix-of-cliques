import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/r/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const slug = (params.slug ?? "").trim().toLowerCase();
        if (!slug) return new Response("Not Found", { status: 404 });

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        // Run the click-bump RPC and the id lookup in parallel — the RPC
        // returns the redirect target, the lookup gives us the FK for the
        // click log (fire-and-forget below).
        const [rpcRes, linkRes] = await Promise.all([
          supabaseAdmin.rpc("bump_short_link_click", { _slug: slug }),
          supabaseAdmin
            .from("short_links")
            .select("id")
            .eq("slug", slug)
            .maybeSingle(),
        ]);

        const { data, error } = rpcRes;
        if (error || !data || !data[0]) {
          return new Response("Link não encontrado", { status: 404 });
        }
        const row = data[0] as { target: string | null; status: string };
        const url = new URL(request.url);
        const fallback = `${url.origin}/`;
        const target = row.target && row.target.trim() ? row.target : fallback;

        // Log click metadata BEFORE responding. Background/waitUntil is
        // unreliable in this runtime (isolate ends before the insert
        // completes), which caused ~80% of clicks to bump the counter but
        // never land in short_link_clicks. One insert is fast enough to
        // await inline.
        const linkId = linkRes.data?.id;
        if (linkId) {
          const h = request.headers;
          const ip =
            h.get("cf-connecting-ip") ||
            h.get("x-real-ip") ||
            (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
            null;
          // Cloudflare geo: on the platform we run, request.cf isn't
          // forwarded to the TanStack handler, so rely on the standard
          // CF-* headers that Cloudflare always injects at the edge.
          const cf =
            ((request as any).cf as
              | {
                  city?: string;
                  region?: string;
                  regionCode?: string;
                  country?: string;
                }
              | undefined) || undefined;
          try {
            const { error: e } = await supabaseAdmin
              .from("short_link_clicks")
              .insert({
                short_link_id: linkId,
                slug,
                target_url: target,
                ip,
                country: h.get("cf-ipcountry") || cf?.country || null,
                region: h.get("cf-region") || cf?.region || null,
                region_code:
                  h.get("cf-region-code") || cf?.regionCode || null,
                city: h.get("cf-ipcity") || cf?.city || null,
                user_agent: h.get("user-agent") || null,
                referer: h.get("referer") || null,
              });
            if (e) console.error("click log failed", e);
          } catch (e) {
            console.error("click log failed", e);
          }
        }

        return new Response(null, {
          status: 302,
          headers: {
            location: target,
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
