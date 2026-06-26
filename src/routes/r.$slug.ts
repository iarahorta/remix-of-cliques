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
        const fallback = `${url.origin}/portal`;
        const target = row.target && row.target.trim() ? row.target : fallback;
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
