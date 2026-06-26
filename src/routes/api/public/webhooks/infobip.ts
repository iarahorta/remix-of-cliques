import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

// Infobip envia callbacks de status de entrega e de aprovação de template.
// Documentação varia por conta; aceitamos os formatos mais comuns.

export const Route = createFileRoute("/api/public/webhooks/infobip")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.INFOBIP_WEBHOOK_SECRET;
        if (!secret) return new Response("Webhook secret not configured", { status: 503 });

        const body = await request.text();

        // Aceita 2 modos de verificação:
        // 1) HMAC SHA256 hex em X-Infobip-Signature
        // 2) Segredo simples em X-Webhook-Secret (fallback p/ contas sem HMAC)
        const sigHeader = request.headers.get("x-infobip-signature");
        const simple = request.headers.get("x-webhook-secret") ?? new URL(request.url).searchParams.get("secret");

        let authorized = false;
        if (sigHeader) {
          try {
            const expected = createHmac("sha256", secret).update(body).digest("hex");
            const a = Buffer.from(sigHeader);
            const b = Buffer.from(expected);
            authorized = a.length === b.length && timingSafeEqual(a, b);
          } catch { authorized = false; }
        } else if (simple) {
          authorized = simple === secret;
        }
        if (!authorized) return new Response("Unauthorized", { status: 401 });

        let payload: any;
        try { payload = JSON.parse(body); } catch { return new Response("Invalid JSON", { status: 400 }); }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Delivery reports: { results: [ { messageId, to, status:{ groupName, description, name }, sentAt, doneAt } ] }
        const results: any[] = payload?.results ?? payload?.deliveryInfo ?? [];
        if (Array.isArray(results) && results.length) {
          for (const r of results) {
            const messageId = r.messageId ?? r.id;
            if (!messageId) continue;
            const groupName = (r.status?.groupName ?? r.status?.name ?? "unknown").toString().toLowerCase();
            const delivered = groupName === "delivered_to_handset" || groupName === "delivered" || (r.status?.id ?? 0) === 5;
            const failed = groupName === "undeliverable" || groupName === "expired" || groupName === "rejected";
            const patch: any = {
              status: delivered ? "delivered" : failed ? "failed" : groupName,
              status_detail: r.status?.description ?? r.status?.name ?? null,
              delivered_at: delivered ? (r.doneAt ?? new Date().toISOString()) : null,
              failed_at: failed ? (r.doneAt ?? new Date().toISOString()) : null,
            };
            const { data: row } = await supabaseAdmin
              .from("campaign_deliveries")
              .update(patch)
              .eq("message_id", messageId)
              .select("campaign_id")
              .maybeSingle();
            if (row?.campaign_id) {
              if (delivered) {

                const { data: c } = await supabaseAdmin.from("campaigns").select("delivered_count").eq("id", row.campaign_id).maybeSingle();
                await supabaseAdmin.from("campaigns").update({ delivered_count: ((c?.delivered_count as number) ?? 0) + 1 } as any).eq("id", row.campaign_id);
              } else if (failed) {
                const { data: c } = await supabaseAdmin.from("campaigns").select("failed_count").eq("id", row.campaign_id).maybeSingle();
                await supabaseAdmin.from("campaigns").update({ failed_count: ((c?.failed_count as number) ?? 0) + 1 } as any).eq("id", row.campaign_id);
              }
            }
          }
          return Response.json({ ok: true, processed: results.length });
        }

        // Template status update: { name, language, status, rejectionReason }
        if (payload?.name && payload?.status) {
          await supabaseAdmin.from("wa_templates").update({
            status: String(payload.status).toUpperCase(),
            status_reason: payload.rejectionReason ?? null,
            last_synced_at: new Date().toISOString(),
          } as any).eq("name", payload.name).eq("language", payload.language ?? "pt_BR");
          return Response.json({ ok: true, kind: "template" });
        }

        return Response.json({ ok: true, ignored: true });
      },
    },
  },
});
