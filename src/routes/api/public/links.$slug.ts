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

export const Route = createFileRoute("/api/public/links/$slug")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET,PATCH,DELETE,OPTIONS",
            "access-control-allow-headers": "content-type,x-api-key,authorization",
          },
        }),

      GET: async ({ request, params }) => {
        if (!checkAuth(request)) return unauthorized();
        const slug = params.slug.toLowerCase();
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { data: link, error } = await supabaseAdmin
          .from("short_links")
          .select(
            "id,slug,target_url,is_rotating,rotation_mode,rotation_cursor,status,click_count,last_clicked_at,label,user_id,created_at,updated_at"
          )
          .eq("slug", slug)
          .maybeSingle();
        if (error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        if (!link)
          return new Response(JSON.stringify({ error: "not_found" }), {
            status: 404,
            headers: { "content-type": "application/json" },
          });
        const { data: urls } = await supabaseAdmin
          .from("short_link_urls")
          .select("url,sort_order,weight")
          .eq("short_link_id", link.id)
          .order("sort_order");
        return Response.json({ link, rotation_urls: urls ?? [] });
      },

      // PATCH: { target_url?, rotation_urls?, rotation_mode?, status?, label? }
      PATCH: async ({ request, params }) => {
        if (!checkAuth(request)) return unauthorized();
        const slug = params.slug.toLowerCase();
        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { data: existing } = await supabaseAdmin
          .from("short_links")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        if (!existing)
          return new Response(JSON.stringify({ error: "not_found" }), {
            status: 404,
            headers: { "content-type": "application/json" },
          });

        const patch: {
          target_url?: string;
          label?: string;
          status?: string;
          is_rotating?: boolean;
          rotation_mode?: string;
        } = {};
        if (typeof body.target_url === "string") patch.target_url = body.target_url;
        if (typeof body.label === "string") patch.label = body.label;
        if (typeof body.status === "string") patch.status = body.status;
        if (
          typeof body.rotation_mode === "string" &&
          ["round_robin", "random", "weighted", "sticky"].includes(body.rotation_mode)
        ) {
          patch.rotation_mode = body.rotation_mode;
        }
        if (Array.isArray(body.rotation_urls))
          patch.is_rotating = body.rotation_urls.length > 0;

        if (Object.keys(patch).length) {
          const { error } = await supabaseAdmin
            .from("short_links")
            .update(patch)
            .eq("id", existing.id);
          if (error)
            return new Response(JSON.stringify({ error: error.message }), {
              status: 400,
              headers: { "content-type": "application/json" },
            });
        }

        if (Array.isArray(body.rotation_urls)) {
          await supabaseAdmin
            .from("short_link_urls")
            .delete()
            .eq("short_link_id", existing.id);
          if (body.rotation_urls.length > 0) {
            const rows = body.rotation_urls.map((u: any, i: number) => {
              if (typeof u === "string") {
                return {
                  short_link_id: existing.id,
                  url: u,
                  sort_order: i,
                  weight: 1,
                };
              }
              return {
                short_link_id: existing.id,
                url: String(u.url),
                sort_order: i,
                weight: Math.max(0, Math.min(1000, Number(u.weight ?? 1))),
              };
            });
            await supabaseAdmin.from("short_link_urls").insert(rows);
          }
        }

        return Response.json({ ok: true });
      },

      DELETE: async ({ request, params }) => {
        if (!checkAuth(request)) return unauthorized();
        const slug = params.slug.toLowerCase();
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { error } = await supabaseAdmin
          .from("short_links")
          .delete()
          .eq("slug", slug);
        if (error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        return Response.json({ ok: true });
      },
    },
  },
});
