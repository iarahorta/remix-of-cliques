import { createFileRoute } from '@tanstack/react-router'
import { sendTemplateEmail } from '@/lib/email-templates/send-email'

// Cron endpoint: chamado 1x/dia às 09:00 BRT.
// Autenticado via header `apikey` (Supabase anon) — /api/public/* bypassa auth
// no site publicado, então validamos explicitamente.

type Subscriber = {
  id: string
  email: string | null
  name: string | null
  status: string
  current_period_end: string | null
  created_at: string
}

async function send(
  template: string,
  sub: Subscriber,
  templateData: Record<string, unknown>,
  scopeKey: string,
) {
  if (!sub.email) return { skipped: true as const, reason: 'no_email' }
  const idempotencyKey = `${template}-${sub.id}-${scopeKey}`
  try {
    const result = await sendTemplateEmail(template, sub.email, {
      templateData: { name: sub.name ?? undefined, ...templateData },
      idempotencyKey,
    })
    return { sent: result.sent, reason: 'reason' in result ? result.reason : undefined }
  } catch (err) {
    console.error('[send-expiry-reminders] send failed', {
      template,
      subscriberId: sub.id,
      error: err instanceof Error ? err.message : String(err),
    })
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

// Retorna a data (YYYY-MM-DD) em BRT para um offset em dias a partir de hoje.
function brtDate(offsetDays: number): string {
  const now = new Date()
  now.setUTCDate(now.getUTCDate() + offsetDays)
  // BRT = UTC-3, sem DST
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  return brt.toISOString().slice(0, 10)
}

export const Route = createFileRoute('/api/public/hooks/send-expiry-reminders')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY
        const apiKey = request.headers.get('apikey')
        if (!anonKey || apiKey !== anonKey) {
          return new Response('Unauthorized', { status: 401 })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

        const summary = {
          trial_expiring: 0,
          subscription_expiring_3d: 0,
          subscription_expiring_1d: 0,
          subscription_blocked: 0,
          errors: 0,
          skipped: 0,
        }

        // 1) Trial acabando (~6h): trial iniciado entre 18h e 24h atrás.
        {
          const now = new Date()
          const upper = new Date(now.getTime() - 18 * 60 * 60 * 1000).toISOString()
          const lower = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
          const { data, error } = await supabaseAdmin
            .from('link_subscribers')
            .select('id,email,name,status,current_period_end,created_at')
            .eq('status', 'trialing')
            .gte('created_at', lower)
            .lte('created_at', upper)
          if (error) console.error('[send-expiry-reminders] trial query error', error)
          for (const sub of (data ?? []) as Subscriber[]) {
            const scope = sub.created_at.slice(0, 10)
            const r = await send('trial-expiring', sub, { hoursLeft: 6 }, scope)
            if (r.error) summary.errors++
            else if (r.sent) summary.trial_expiring++
            else summary.skipped++
          }
        }

        // 2) Assinatura vencendo em 3 dias.
        for (const [daysLeft, key] of [
          [3, 'subscription_expiring_3d'] as const,
          [1, 'subscription_expiring_1d'] as const,
        ]) {
          const day = brtDate(daysLeft)
          const { data, error } = await supabaseAdmin
            .from('link_subscribers')
            .select('id,email,name,status,current_period_end,created_at')
            .in('status', ['active'])
            .gte('current_period_end', `${day}T00:00:00-03:00`)
            .lte('current_period_end', `${day}T23:59:59-03:00`)
          if (error) console.error('[send-expiry-reminders] expiring query error', error)
          for (const sub of (data ?? []) as Subscriber[]) {
            const scope = (sub.current_period_end ?? day).slice(0, 10)
            const r = await send(
              'subscription-expiring',
              sub,
              { daysLeft },
              `${daysLeft}-${scope}`,
            )
            if (r.error) summary.errors++
            else if (r.sent) summary[key]++
            else summary.skipped++
          }
        }

        // 4) Bloqueio: 3 dias após vencimento.
        {
          const day = brtDate(-3)
          const { data, error } = await supabaseAdmin
            .from('link_subscribers')
            .select('id,email,name,status,current_period_end,created_at')
            .in('status', ['active', 'suspended', 'overdue'])
            .gte('current_period_end', `${day}T00:00:00-03:00`)
            .lte('current_period_end', `${day}T23:59:59-03:00`)
          if (error) console.error('[send-expiry-reminders] blocked query error', error)
          for (const sub of (data ?? []) as Subscriber[]) {
            const scope = (sub.current_period_end ?? day).slice(0, 10)
            const r = await send(
              'subscription-blocked',
              sub,
              { daysOverdue: 3 },
              scope,
            )
            if (r.error) summary.errors++
            else if (r.sent) summary.subscription_blocked++
            else summary.skipped++
          }
        }

        return Response.json({ ok: true, summary, ranAt: new Date().toISOString() })
      },
    },
  },
})