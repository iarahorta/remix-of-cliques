import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.includes("admin") && !roles.includes("super_admin")) {
    throw new Error("Acesso restrito a administradores.");
  }
}

export const getAsaasWebhookConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const token = process.env.ASAAS_WEBHOOK_TOKEN ?? "";
    const apiKey = process.env.ASAAS_API_KEY ?? "";
    const env = process.env.ASAAS_ENV === "sandbox" ? "sandbox" : "production";
    const req = getRequest();
    const origin = req ? new URL(req.url).origin : "";
    return {
      hasToken: token.length > 0,
      tokenPreview: token ? `${token.slice(0, 4)}…${token.slice(-4)} (${token.length} chars)` : null,
      hasApiKey: apiKey.length > 0,
      env,
      webhookUrl: `${origin}/api/public/webhooks/asaas`,
    };
  });

export const validateAsaasWebhookToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const token = process.env.ASAAS_WEBHOOK_TOKEN ?? "";
    if (!token) {
      return { ok: false, status: 0, message: "ASAAS_WEBHOOK_TOKEN não configurado." };
    }
    const req = getRequest();
    if (!req) throw new Error("Sem contexto de request.");
    const url = new URL("/api/public/webhooks/asaas", req.url).toString();

    // 1) Token válido → 200
    const okRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "asaas-access-token": token,
      },
      body: JSON.stringify({ event: "TEST_PING" }),
    });
    const okBody = await okRes.text();

    // 2) Token inválido → 401 (sanity check)
    const badRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "asaas-access-token": `${token}-invalid`,
      },
      body: JSON.stringify({ event: "TEST_PING" }),
    });

    const ok = okRes.status === 200 && badRes.status === 401;
    return {
      ok,
      status: okRes.status,
      rejectStatus: badRes.status,
      url,
      message: ok
        ? "Autenticação validada: endpoint aceita o token atual e rejeita tokens inválidos."
        : `Falha na validação. Endpoint retornou ${okRes.status} com o token e ${badRes.status} sem ele. Body: ${okBody.slice(0, 200)}`,
    };
  });
