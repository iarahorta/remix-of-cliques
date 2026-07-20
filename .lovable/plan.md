# Plano — Avisos por e-mail de vencimento

Idioma dos e-mails: 100% PT-BR. Timezone Brasília em todas as datas exibidas.

## 1. Infra de e-mail (Lovable Emails)

- Configurar domínio de envio (subdomínio dedicado, ex.: `notify.zpclik.site`) via dialog de setup — DNS via NS delegation. Aguardar verificação (pode levar até 72h, mas envio já pode ser scaffoldado antes).
- Scaffold de app emails (templates transacionais + helper `sendTemplateEmail`).
- Nenhuma fila / cron table criada — a Lovable cuida de entrega, retries, suppression e unsubscribe.

## 2. Templates (React Email, PT-BR, tema preto/dourado do zpclik)

Todos com logo, saudação pelo nome, CTA "Renovar agora" apontando pro dashboard, rodapé com suporte.

1. `trial-ending` — "Seu teste grátis termina em breve" (disparado quando falta ≤ 6h pro fim do trial de 24h).
2. `subscription-expiring-1d` — "Sua assinatura vence amanhã" (1 dia antes do `current_period_end`).
3. `subscription-blocked-soon` — "Última chance: acesso será bloqueado hoje" (3 dias após vencer, ou seja no dia do corte).

## 3. Trigger — cron diário

- Migração `pg_cron` + `pg_net` que roda 1×/dia às **09:00 BRT** (12:00 UTC).
- Chama endpoint público `POST /api/public/hooks/send-expiry-reminders` autenticado com `apikey` (Supabase anon).
- Endpoint faz 3 queries em `link_subscribers`:
  - trial: `status='trialing'` e `trial_started_at` entre 18h e 24h atrás → envia `trial-ending`.
  - 1 dia antes: `status='active'` e `current_period_end = amanhã (BRT)` → envia `subscription-expiring-1d`.
  - 3 dias após: `status IN ('active','suspended')` e `current_period_end = hoje - 3 dias (BRT)` → envia `subscription-blocked-soon`.
- Idempotência: `idempotencyKey = ${template}-${subscriber_id}-${current_period_end}` — a Lovable deduplica reenvios se o cron rodar 2×.
- Suprimidos (bounce/complaint/unsubscribe) são bloqueados server-side pela Lovable — nada extra a fazer.

## 4. Teste manual

- Após scaffold, disparo um envio de teste de cada um dos 3 templates pro `iarachorta@gmail.com` via server function one-off, pra você validar visual e copy.
- Verifico logs de entrega em Cloud → Emails.

## 5. Detalhes técnicos

- Novos arquivos:
  - `src/lib/email-templates/trial-ending.tsx`
  - `src/lib/email-templates/subscription-expiring-1d.tsx`
  - `src/lib/email-templates/subscription-blocked-soon.tsx`
  - `src/routes/api/public/hooks/send-expiry-reminders.ts`
  - `src/lib/expiry-reminders.functions.ts` (função de teste manual — admin only)
- Migração:
  - `pg_cron` + `pg_net` (se ainda não habilitados).
  - Job diário `send-expiry-reminders` às 12:00 UTC.
- Sem alteração no fluxo HS. Sem tocar em `short_links`, `r.$slug.ts`, políticas RLS existentes.

## 6. Fora de escopo (podemos fazer depois se quiser)

- Aviso de pagamento confirmado (recibo).
- Aviso de bloqueio efetivo (dia 4+).
- JÁ PODE FAZER 

## Pergunta técnica que resolvo sozinho durante o build

- Domínio de envio: uso `avisos.zpclik.site` como subdomínio delegado. 

Ao aprovar, começo pelo scaffold + setup do domínio, depois templates, depois cron e teste final pra `iarachorta@gmail.com`.