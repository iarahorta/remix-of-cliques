import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,OPTIONS",
  "access-control-allow-headers": "content-type,x-api-key,authorization",
};

function unauthorized() {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json", ...CORS },
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

export const Route = createFileRoute("/api/public/links/$slug/clicks")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async ({ request, params }) => {
        if (!checkAuth(request)) return unauthorized();
        const slug = params.slug.toLowerCase();
        const url = new URL(request.url);
        const limit = Math.min(
          Math.max(parseInt(url.searchParams.get("limit") ?? "500", 10) || 500, 1),
          2000,
        );
        const since = url.searchParams.get("since");
        const until = url.searchParams.get("until");

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const { data: link, error: linkErr } = await supabaseAdmin
          .from("short_links")
          .select("id,slug")
          .eq("slug", slug)
          .maybeSingle();
        if (linkErr)
          return new Response(JSON.stringify({ error: linkErr.message }), {
            status: 500,
            headers: { "content-type": "application/json", ...CORS },
          });
        if (!link)
          return new Response(JSON.stringify({ error: "not_found" }), {
            status: 404,
            headers: { "content-type": "application/json", ...CORS },
          });

        let q = supabaseAdmin
          .from("short_link_clicks")
          .select(
            "id,slug,target_url,ip,country,region,city,user_agent,referer,created_at",
          )
          .eq("short_link_id", link.id)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (since) q = q.gte("created_at", since);
        if (until) q = q.lte("created_at", until);

        const { data, error } = await q;
        if (error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json", ...CORS },
          });

        return new Response(
          JSON.stringify({ slug: link.slug, count: data?.length ?? 0, clicks: data ?? [] }),
          { status: 200, headers: { "content-type": "application/json", ...CORS } },
        );
      },
    },
  },
});
