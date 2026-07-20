## Objetivo

Adicionar no painel admin (`/assinantes`) um botão em cada linha da lista de assinantes que permita **presentear dias ou meses** de acesso — estendendo a data de vencimento sem cobrança.

## Como vai funcionar

Em cada assinante da tabela, ao lado dos botões "Marcar pago" / "Suspender", entra um novo botão **"🎁 Presentear"**.

Ao clicar, abre um modal com:
- **Quantidade** (input numérico, padrão 7)
- **Unidade** (seletor: Dias / Meses)
- **Motivo/observação** (texto curto, opcional — ex: "Brinde lançamento", "Compensação suporte")
- Botão **Confirmar presente**

Regras:
- Se o assinante já tem `next_due_date` no futuro → soma em cima dessa data.
- Se está vencido, em trial, ou sem data → soma a partir de **hoje** (Brasília).
- Status vira `active` automaticamente (destrava conta bloqueada).
- Se estava em trial, encerra o trial (`trial_ends_at = now`) e marca como assinante presenteado.
- Registra no banco quem deu, quando, quanto e o motivo — para histórico e auditoria.
- Nunca gera comissão de parceiro (é cortesia, não pagamento).

O admin vê um toast "Presente aplicado: novo vencimento em DD/MM/AAAA" e a lista recarrega.

## Onde vai aparecer

- **Admin → Assinantes**: botão 🎁 em cada linha + modal.
- **Painel do cliente**: o novo vencimento reflete imediatamente. Se quiser, aviso "🎁 Você ganhou X dias de cortesia" fica visível até o próximo pagamento (pode ficar como P2 se preferir simplificar agora).

## Detalhes técnicos

**Migração de banco:**
- Nova tabela `public.subscriber_gifts` (id, subscriber_id, granted_by_user_id, days_granted, previous_due_date, new_due_date, reason, created_at) com RLS: só admin/super_admin lê/insere; assinante lê os próprios.
- GRANTs para `authenticated` e `service_role` conforme padrão do projeto.

**Server function nova** em `src/lib/link-subscribers.functions.ts`:
- `giftSubscriberDays({ subscriberId, days, reason })` com `requireSupabaseAuth` + verificação de role admin/super_admin via `has_role`.
- Calcula nova data (base = max(next_due_date, hoje BRT)), atualiza `link_subscribers` (status=active, next_due_date, trial_ends_at se aplicável), insere linha em `subscriber_gifts`.
- Retorna `{ newDueDate }`.

**UI nova em `src/routes/_authenticated/assinantes.tsx`:**
- Botão 🎁 na linha.
- Componente `GiftModal` (Dialog do shadcn) com os campos acima.
- Chamada via `useServerFn` + toast + refetch.

## Fora do escopo desta entrega

- Bonus em créditos/valor monetário.
- Cupom público de "X dias grátis" para novos cadastros.
- Notificação por e-mail automática do presente (posso propor depois se quiser).

## Confirmações rápidas

1. Confirma que o presente **estende sempre** a data (nunca substitui por menos), certo?
2. Quer que apareça um **badge "🎁 Cortesia"** no card do cliente até o próximo vencimento, ou só a data nova sem alarde?
