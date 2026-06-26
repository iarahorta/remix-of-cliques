import { createFileRoute } from "@tanstack/react-router";

const ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";

function genSlug(len = 6): string {
  let s = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

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

export const Route = createFileRoute("/api/public/links")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET,POST,OPTIONS",
            "access-control-allow-headers": "content-type,x-api-key,authorization",
          },
        }),

      // List links (optional ?limit=&offset=&q=)
      GET: async ({ request }) => {
        if (!checkAuth(request)) return unauthorized();
        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
        const offset = Number(url.searchParams.get("offset") ?? 0);
        const q = url.searchParams.get("q");
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        let query = supabaseAdmin
          .from("short_links")
          .select(
            "id,slug,target_url,is_rotating,status,click_count,last_clicked_at,label,created_at,updated_at"
          )
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (q) query = query.ilike("slug", `%${q}%`);
        const { data, error } = await query;
        if (error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        return Response.json({ links: data });
      },

      // Bulk create: { count, length?, target_url?, label?, prefix? }
      // Or single: { slug?, target_url, rotation_urls?, label? }
      POST: async ({ request }) => {
        if (!checkAuth(request)) return unauthorized();
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

        // Bulk mode
        if (typeof body?.count === "number" && body.count > 0) {
          const count = Math.min(body.count, 500);
          const len = Math.max(4, Math.min(Number(body.length ?? 6), 16));
          const prefix = typeof body.prefix === "string" ? body.prefix : "";
          const target_url: string | null = body.target_url ?? null;
          const label: string | null = body.label ?? null;

          const rows: Array<{
            slug: string;
            target_url: string | null;
            label: string | null;
            status: string;
          }> = [];
          const seen = new Set<string>();
          while (rows.length < count) {
            const slug = (prefix + genSlug(len)).toLowerCase();
            if (seen.has(slug)) continue;
            seen.add(slug);
            rows.push({ slug, target_url, label, status: "active" });
          }
          const { data, error } = await supabaseAdmin
            .from("short_links")
            .insert(rows)
            .select("id,slug,target_url,status");
          if (error)
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { "content-type": "application/json" },
            });
          return Response.json({ created: data?.length ?? 0, links: data });
        }

        // Single mode
        const target_url: string | undefined = body?.target_url;
        if (!target_url)
          return new Response(
            JSON.stringify({ error: "target_url_required" }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            }
          );
        const slug = (body?.slug || genSlug(6)).toLowerCase();
        const rotation_urls: string[] | undefined = body?.rotation_urls;
        const is_rotating =
          Array.isArray(rotation_urls) && rotation_urls.length > 0;

        const { data: link, error } = await supabaseAdmin
          .from("short_links")
          .insert({
            slug,
            target_url,
            label: body?.label ?? null,
            is_rotating,
            status: "active",
          })
          .select("id,slug,target_url,is_rotating,status")
          .single();
        if (error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });

        if (is_rotating && link) {
          const rows = rotation_urls!.map((u, i) => ({
            short_link_id: link.id,
            url: u,
            sort_order: i,
          }));
          await supabaseAdmin.from("short_link_urls").insert(rows);
        }
        return Response.json({ link });
      },
    },
  },
});
