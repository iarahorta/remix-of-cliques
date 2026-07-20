import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { sendTemplateEmail } from '@/lib/email-templates/send-email'

// Dispara os 3 templates de vencimento para um e-mail de teste.
// Uso: apenas admin. Idempotência por timestamp pra permitir múltiplos testes.
export const sendExpiryRemindersTest = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { to: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', context.userId)
    const isAdmin = (roles ?? []).some(
      (r) => r.role === 'admin' || r.role === 'super_admin',
    )
    if (!isAdmin) throw new Error('Forbidden')

    const stamp = Date.now()
    const to = data.to
    const results: Record<string, { sent: boolean; reason?: string }> = {}

    results.trial = await sendTemplateEmail('trial-expiring', to, {
      templateData: { name: 'Iara', hoursLeft: 6 },
      idempotencyKey: `test-trial-${stamp}`,
    })
    results.expiring3d = await sendTemplateEmail('subscription-expiring', to, {
      templateData: { name: 'Iara', daysLeft: 3 },
      idempotencyKey: `test-exp3d-${stamp}`,
    })
    results.expiring1d = await sendTemplateEmail('subscription-expiring', to, {
      templateData: { name: 'Iara', daysLeft: 1 },
      idempotencyKey: `test-exp1d-${stamp}`,
    })
    results.blocked = await sendTemplateEmail('subscription-blocked', to, {
      templateData: { name: 'Iara', daysOverdue: 3 },
      idempotencyKey: `test-blocked-${stamp}`,
    })

    return { ok: true, results }
  })