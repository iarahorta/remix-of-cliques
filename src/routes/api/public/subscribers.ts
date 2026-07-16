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

export const Route = createFileRoute("/api/public/subscribers")({
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

      GET: async ({ request }) => {
        if (!checkAuth(request)) return unauthorized();
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { data, error } = await supabaseAdmin
          .from("link_subscribers")
          .select(
            "id,name,email,phone,status,current_period_end,last_payment_at,plan_price_cents,payment_method,created_at"
          )
          .order("created_at", { ascending: false });
        if (error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        return Response.json({ subscribers: data ?? [] });
      },
    },
  },
});
