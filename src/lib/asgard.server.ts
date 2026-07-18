import { createHmac, timingSafeEqual } from "crypto";

const ASGARD_BASE = "https://app.asgardpay.com.br/api/v1";

function headers() {
  const pub = process.env.ASGARD_PUBLIC_KEY;
  const sec = process.env.ASGARD_SECRET_KEY;
  if (!pub || !sec) throw new Error("ASGARD_PUBLIC_KEY / ASGARD_SECRET_KEY não configurados.");
  return {
    "Content-Type": "application/json",
    "X-Public-Key": pub,
    "X-Secret-Key": sec,
  } as Record<string, string>;
}

export interface AsgardPixResponse {
  order_id: number;
  transaction_id?: string;
  qrcode?: string;
  copy_paste?: string;
  status: string;
}

export async function createAsgardPix(input: {
  amount: number;
  email: string;
  name?: string | null;
  cpf?: string | null;
  phone?: string | null;
  externalReference?: string;
  idempotencyKey?: string;
}): Promise<AsgardPixResponse> {
  const cpfDigits = (input.cpf ?? "").replace(/\D+/g, "");
  if (cpfDigits.length !== 11) {
    throw new Error("CPF inválido — informe um CPF com 11 dígitos.");
  }
  const body = {
    customer: {
      email: input.email,
      name: input.name ?? undefined,
      cpf: cpfDigits,
      phone: input.phone ?? undefined,
    },
    amount: Number(input.amount.toFixed(2)),
    currency: "BRL",
    metadata: input.externalReference ? { external_id: input.externalReference } : undefined,
  };
  const h = headers();
  h["Accept"] = "application/json";
  h["Idempotency-Key"] = input.idempotencyKey ?? `pix-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const res = await fetch(`${ASGARD_BASE}/payments/pix`, {
    method: "POST",
    headers: h,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 300);
    try { const j = JSON.parse(text); if (j?.message) msg = j.message; } catch { /* html error */ }
    throw new Error(`AsgardPay ${res.status}: ${msg}`);
  }
  return JSON.parse(text) as AsgardPixResponse;
}

export async function getAsgardOrder(orderId: string | number) {
  const h = headers();
  h["Accept"] = "application/json";
  const res = await fetch(`${ASGARD_BASE}/payments/${orderId}`, { headers: h });
  const text = await res.text();
  if (!res.ok) throw new Error(`AsgardPay ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as { order_id: number; status: string; amount: number; copy_paste?: string; qrcode?: string; metadata?: any };
}

export function verifyAsgardSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.ASGARD_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signatureHeader, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}