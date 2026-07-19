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
        const { data, error } = await supabaseAdmin.rpc("bump_short_link_click", {
          _slug: slug,
        });
        if (error || !data || !data[0]) {
          return new Response("Link não encontrado", { status: 404 });
        }
        const row = data[0] as { target: string | null; status: string };
        const url = new URL(request.url);
        const fallback = `${url.origin}/`;
        const target = row.target && row.target.trim() ? row.target : fallback;

        // Log click metadata (best-effort, non-blocking on failure)
        try {
          const h = request.headers;
          const ip =
            h.get("cf-connecting-ip") ||
            h.get("x-real-ip") ||
            (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
            null;
          const { data: linkRow } = await supabaseAdmin
            .from("short_links")
            .select("id")
            .eq("slug", slug)
            .maybeSingle();
          if (linkRow?.id) {
            await supabaseAdmin.from("short_link_clicks").insert({
              short_link_id: linkRow.id,
              slug,
              target_url: target,
              ip,
              country: h.get("cf-ipcountry") || null,
              region: h.get("cf-region") || null,
              city: h.get("cf-ipcity") || null,
              user_agent: h.get("user-agent") || null,
              referer: h.get("referer") || null,
            });
          }
        } catch (e) {
          console.error("click log failed", e);
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
