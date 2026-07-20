# Régua de avisos por e-mail + cron diário

Após publicar, ativo a régua completa de lembretes por e-mail. Nada muda no fluxo HS (intocado) e nenhum cliente com assinatura em dia recebe e-mail.

## Régua final

| Gatilho | Template | Quando dispara |
|---|---|---|
| Trial acabando | `trial-expiring` (hoursLeft≈6) | Trial iniciado entre 18h e 24h atrás |
| Assinatura vencendo em 3 dias | `subscription-expiring` (daysLeft=3) | `current_period_end` = hoje + 3 dias (BRT) |
| Assinatura vencendo em 24h | `subscription-expiring` (daysLeft=1) | `current_period_end` = amanhã (BRT) |
| Conta bloqueada | `subscription-blocked` (daysOverdue=3) | `current_period_end` = hoje − 3 dias (BRT) |

Idempotência por `${template}-${subscriber_id}-${current_period_end}` — mesmo se o cron rodar 2×, o cliente recebe 1× só.

## Como o cron funciona

- Roda **1×/dia às 09:00 BRT (12:00 UTC)** via `pg_cron` + `pg_net`.
- Chama `POST /api/public/hooks/send-expiry-reminders` autenticado com `apikey` (Supabase anon).
- O endpoint varre `link_subscribers`, seleciona só quem se encaixa em cada condição do dia, e dispara o template correspondente pra cada um.
- Quem está em dia **não recebe nada**.
- Suprimidos (bounce/reclamação/unsubscribe) são bloqueados pela Lovable automaticamente.

## Arquivos

Novos:
- `src/routes/api/public/hooks/send-expiry-reminders.ts` — endpoint do cron, com as 4 queries e envios via `sendTemplateEmail`.
- `src/lib/expiry-reminders.functions.ts` — server function admin-only para disparar teste manual pra `iarachorta@gmail.com`.

Migração (via `supabase--insert`, não migration — contém URL/anon key do projeto):
- Habilita `pg_cron` e `pg_net` se necessário.
- `cron.schedule('send-expiry-reminders', '0 12 * * *', ...)` chamando o endpoint.

Sem tocar em: `short_links`, `r.$slug.ts`, RLS existentes, fluxo HS.

## Teste

Após publicar e o cron estar agendado, disparo teste manual pra `iarachorta@gmail.com` com os 3 templates (`trial-expiring`, `subscription-expiring` daysLeft=1 e 3, `subscription-blocked`) pra você validar visual/copy antes de qualquer cliente real receber.

## Dependência: DNS

O envio efetivo só acontece após `avisos.zpclik.site` verificar (monitoro em Cloud → Emails). Todo o resto (endpoint, cron, templates) já fica pronto e roda idempotente — assim que o DNS verificar, os e-mails começam a sair no próximo ciclo das 09:00 BRT sem eu precisar mexer em nada.
