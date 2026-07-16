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

export const Route = createFileRoute("/api/public/subscribers/$id")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET,PATCH,OPTIONS",
            "access-control-allow-headers": "content-type,x-api-key,authorization",
          },
        }),

      PATCH: async ({ request, params }) => {
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

        const action = body?.action;
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        if (action === "mark_paid") {
          const now = new Date();
          const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          const { error } = await supabaseAdmin
            .from("link_subscribers")
            .update({
              status: "active",
              last_payment_at: now.toISOString(),
              current_period_end: end.toISOString().slice(0, 10),
              payment_method: "manual",
            })
            .eq("id", params.id);
          if (error)
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { "content-type": "application/json" },
            });
          return Response.json({ ok: true });
        }

        if (action === "suspend") {
          const { error } = await supabaseAdmin
            .from("link_subscribers")
            .update({ status: "suspended" })
            .eq("id", params.id);
          if (error)
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { "content-type": "application/json" },
            });
          return Response.json({ ok: true });
        }

        return new Response(JSON.stringify({ error: "invalid_action" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
