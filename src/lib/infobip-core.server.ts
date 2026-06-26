// Server-only Infobip dispatch core. Imported dynamically from server fns,
// public webhooks and cron hooks. Never reach this from client code.

type DispatchResult =
  | { ok: true; bulkId: string | null; sent: number }
  | { ok: false; reason: string };

export async function runInfobipDispatch(campaignId: string): Promise<DispatchResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: settingsRow } = await supabaseAdmin
    .from("app_settings").select("value").eq("key", "infobip").maybeSingle();
  const settings = (settingsRow?.value as any) ?? {};
  const baseUrl = (settings.base_url as string | null)?.replace(/\/$/, "") ?? null;
  const sender = (settings.default_sender as string | null) ?? null;
  const apiKey = process.env.INFOBIP_API_KEY;

  if (!baseUrl) return { ok: false, reason: "Base URL Infobip não configurada" };
  if (!sender) return { ok: false, reason: "Sender padrão Infobip não configurado" };
  if (!apiKey) return { ok: false, reason: "INFOBIP_API_KEY ausente" };

  const { data: c } = await supabaseAdmin
    .from("campaigns")
    .select("id, infobip_template_id, template_data, dispatched_at")
    .eq("id", campaignId)
    .maybeSingle();
  if (!c) return { ok: false, reason: "Campanha não encontrada" };
  if (c.dispatched_at) return { ok: false, reason: "Campanha já disparada" };
  if (!c.infobip_template_id) return { ok: false, reason: "Sem template Infobip vinculado" };

  const { data: tpl } = await supabaseAdmin
    .from("wa_templates")
    .select("name, language, status")
    .eq("id", c.infobip_template_id)
    .maybeSingle();
  if (!tpl) return { ok: false, reason: "Template Infobip não encontrado" };
  if (tpl.status !== "APPROVED") return { ok: false, reason: `Template está ${tpl.status}` };

  const { data: files } = await supabaseAdmin
    .from("campaign_files").select("storage_path, filename").eq("campaign_id", campaignId);
  const validFile = (files ?? []).find((f) => f.filename === "leads-validos.csv");
  if (!validFile) return { ok: false, reason: "leads-validos.csv não encontrado" };

  const { data: signed } = await supabaseAdmin.storage.from("campaign-files").download(validFile.storage_path);
  const csv = await signed!.text();
  const numbers = csv.split(/\r?\n/).slice(1).map((s) => s.trim()).filter(Boolean);
  if (!numbers.length) return { ok: false, reason: "Nenhum número válido" };

  const tplData = (c.template_data as any) ?? {};
  const placeholders = Object.keys(tplData)
    .filter((k) => /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => String(tplData[k] ?? ""));

  const messages = numbers.map((to) => ({
    from: sender, to,
    content: {
      templateName: tpl.name,
      templateData: { body: { placeholders } },
      language: tpl.language,
    },
  }));

  const res = await fetch(`${baseUrl}/whatsapp/1/message/template`, {
    method: "POST",
    headers: {
      Authorization: `App ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ messages }),
  });
  const text = await res.text();
  if (!res.ok) {
    const reason = `Infobip ${res.status}: ${text.slice(0, 300)}`;
    await supabaseAdmin.from("campaigns").update({ dispatch_error: reason } as any).eq("id", campaignId);
    return { ok: false, reason };
  }
  const payload = (() => { try { return JSON.parse(text); } catch { return {}; } })() as any;
  const bulkId = payload?.bulkId ?? null;

  const deliveries = (payload?.messages ?? []).map((m: any) => ({
    campaign_id: campaignId,
    phone: m.to,
    message_id: m.messageId ?? null,
    status: (m.status?.groupName ?? "sent").toLowerCase(),
    status_detail: m.status?.description ?? null,
  }));
  if (deliveries.length) {
    await supabaseAdmin.from("campaign_deliveries").insert(deliveries as any);
  }

  await supabaseAdmin.from("campaigns").update({
    channel: "infobip",
    infobip_bulk_id: bulkId,
    status: "processing",
    infobip_meta: payload,
    dispatched_at: new Date().toISOString(),
    dispatch_error: null,
  } as any).eq("id", campaignId);

  return { ok: true, bulkId, sent: messages.length };
}

/** Runs through all paid, scheduled-eligible campaigns and dispatches them. */
export async function runDueAutoDispatches(): Promise<{ checked: number; dispatched: number; errors: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const nowIso = new Date().toISOString();
  const { data } = await supabaseAdmin
    .from("campaigns")
    .select("id, scheduled_at")
    .eq("auto_dispatch", true)
    .eq("payment_status", "paid")
    .is("dispatched_at", null)
    .not("infobip_template_id", "is", null)
    .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
    .limit(50);

  const list = (data ?? []) as Array<{ id: string }>;
  let dispatched = 0, errors = 0;
  for (const row of list) {
    try {
      const r = await runInfobipDispatch(row.id);
      if (r.ok) dispatched += 1; else errors += 1;
    } catch { errors += 1; }
  }
  return { checked: list.length, dispatched, errors };
}
