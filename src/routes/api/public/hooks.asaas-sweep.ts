import { createFileRoute } from "@tanstack/react-router";

// Daily sweep — suspends subscribers whose payment has been overdue for > 5 days.
// Call with header  x-cron-token: <ASAAS_WEBHOOK_TOKEN>
export const Route = createFileRoute("/api/public/hooks/asaas-sweep")({
  server: {
    handlers: {
      GET: async ({ request }) => runSweep(request),
      POST: async ({ request }) => runSweep(request),
    },
  },
});

async function runSweep(request: Request): Promise<Response> {
  const token = request.headers.get("x-cron-token");
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected || token !== expected) {
    return new Response("unauthorized", { status: 401 });
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("link_subscribers")
    .update({ status: "suspended" })
    .eq("status", "pending_payment")
    .lt("overdue_since", cutoff)
    .select("id");
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ ok: true, suspended: data?.length ?? 0 });
}
