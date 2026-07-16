// Server-only Asaas client. Never import from client bundles.
const BASE =
  process.env.ASAAS_ENV === "sandbox"
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3";

async function asaas(path: string, init?: RequestInit): Promise<any> {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error("ASAAS_API_KEY ausente");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      access_token: key,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }
  if (!res.ok) {
    const msg =
      json?.errors?.[0]?.description ||
      json?.message ||
      `asaas ${res.status}`;
    console.error("[asaas] request failed", { path, status: res.status, message: msg });
    throw new Error(msg);
  }
  return json;
}

export type AsaasBillingType =
  | "UNDEFINED"
  | "BOLETO"
  | "CREDIT_CARD"
  | "PIX";

export async function upsertAsaasCustomer(input: {
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
  mobilePhone?: string;
  externalReference: string;
}) {
  return asaas("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createAsaasSubscription(input: {
  customer: string;
  value: number;
  nextDueDate: string; // YYYY-MM-DD
  billingType: AsaasBillingType;
  description?: string;
  externalReference: string;
}) {
  return asaas("/subscriptions", {
    method: "POST",
    body: JSON.stringify({ ...input, cycle: "MONTHLY" }),
  });
}

export async function createAsaasPaymentLink(input: {
  name: string;
  value: number;
  billingType: AsaasBillingType;
  chargeType: "DETACHED" | "RECURRENT" | "INSTALLMENT";
  subscriptionCycle?: "MONTHLY";
  description?: string;
  externalReference: string;
  dueDateLimitDays?: number;
  notificationEnabled?: boolean;
  isAddressRequired?: boolean;
}) {
  return asaas("/paymentLinks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function cancelAsaasSubscription(id: string) {
  return asaas(`/subscriptions/${id}`, { method: "DELETE" });
}

export async function listAsaasSubscriptionPayments(id: string) {
  return asaas(`/subscriptions/${id}/payments?limit=20`);
}

export async function getAsaasPayment(id: string) {
  return asaas(`/payments/${id}`);
}
