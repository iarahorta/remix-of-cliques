import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


// Cancelamento simples da assinatura: apenas marca como suspensa no banco.
// O gateway ativo é o Asgard (PIX manual), sem assinatura recorrente externa
// para cancelar via API.
export const cancelSubscriberBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("link_subscribers")
      .update({ status: "suspended" })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
