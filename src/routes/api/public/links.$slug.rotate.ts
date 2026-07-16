import { createFileRoute } from "@tanstack/react-router";

function unauthorized() {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

function checkAuth(request: Request): boolean {
  const key = process.env.CLIQUES_API_KEY;
  if (!key) return false;
  const provided =
    request.headers.get("x-api-key") ||
    (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return !!provided && provided === key;
}

export const Route = createFileRoute("/api/public/links/$slug/rotate")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "POST,OPTIONS",
            "access-control-allow-headers": "content-type,x-api-key,authorization",
          },
        }),
      POST: async ({ request, params }) => {
        if (!checkAuth(request)) return unauthorized();
        const slug = params.slug.toLowerCase();
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { data: link } = await supabaseAdmin
          .from("short_links")
          .select("id,rotation_cursor")
          .eq("slug", slug)
          .maybeSingle();
        if (!link)
          return new Response(JSON.stringify({ error: "not_found" }), {
            status: 404,
            headers: { "content-type": "application/json" },
          });
        const { count } = await supabaseAdmin
          .from("short_link_urls")
          .select("*", { head: true, count: "exact" })
          .eq("short_link_id", link.id);
        const total = count ?? 0;
        const next = total > 0 ? ((link.rotation_cursor ?? 0) + 1) % total : 0;
        await supabaseAdmin
          .from("short_links")
          .update({ rotation_cursor: next })
          .eq("id", link.id);
        return Response.json({ ok: true, rotation_cursor: next, total });
      },
    },
  },
});
