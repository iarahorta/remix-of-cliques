# P1.3 — Revisar fluxo de pagamento (Asgard PIX)

## O que já está OK (confirmado lendo o código)

- Webhook `/api/public/webhooks/asgard` valida `x-webhook-signature` com `ASGARD_WEBHOOK_SECRET` e rejeita 401 se secret ausente (não é fail-open).
- Ao receber `order.completed`, estende `current_period_end` em +30 dias a partir do maior entre `current_period_end` e `now` (não perde dias pagos antecipadamente).
- Idempotente: só atualiza assinante se o charge ainda não estava `completed`.
- `getAsgardOrder` (polling manual do dashboard) também confirma pagamento — cinto + suspensório.
- Retirar a necessidade de  CPF , não quero q peça cpf para gerar o pix e adicione timer de 5 minutos

## Riscos que quero corrigir (baixo risco, alto valor)

1. **Webhook não loga o motivo quando a assinatura falha.** Se o Asgard mudar formato do header, ficamos cegos.
  - Fix: `console.warn` estruturado (event, order_id, motivo) em cada retorno 4xx. Sem vazar segredo.
2. **Webhook aceita `order.completed` mas ignora silenciosamente se o `charge` não existe no banco.** Retorna 200 "ok" sem log.
  - Fix: `console.warn` com order_id quando charge não encontrado. Manter 200 (Asgard não deve reenviar), mas registrar.
3. **Se `event` é `order.completed` mas `status` no payload vem diferente, a lógica usa `status` (do payload).** Pode dar falso-positivo se Asgard mandar `status: "pending"` num evento `order.completed`.
  - Fix: quando `event === "order.completed"` forçar `nextStatus = "completed"` (evento é a fonte da verdade, não o status do payload).
4. **Não há log de auditoria de quem estendeu a assinatura.** Se der divergência com Asgard, não temos trilha.
  - Fix: `console.info` com `{ subscriber_id, order_id, old_end, new_end }` após update.
5. **Alerta de vencimento no dashboard usa `current_period_end` em UTC** (comparação com `new Date()`) — pode marcar "vencido" 3h antes/depois no Brasil.
  - Fix: comparar em `America/Sao_Paulo` (helper `nowInBrazil()`). Cai dentro da regra Core de timezone Brasília.

## Fora de escopo (não vou mexer)

- Não vou mexer em `asgard.server.ts` (geração de PIX está funcionando, confirmado por assinantes reais no banco).
- Não vou mexer em schema de `asgard_pix_charges` nem `link_subscribers`.
- Não vou trocar polling por realtime.

## Arquivos alterados

- `src/routes/api/public/webhooks.asgard.ts` — logs estruturados + regra do `nextStatus`.
- `src/routes/clientes.dashboard.tsx` — comparação de vencimento em TZ Brasil (helper local).

## Risco: baixo. Tempo: ~25 min.

---

# P1.4 — Exclusão de link no painel do assinante

## Problema

Não existe hoje. O `Trash2` visível no dashboard é só para remover linha de rotação, não o link inteiro. Cliente que criou link errado precisa pedir suporte.

## Regra de negócio

- Cliente só pode excluir link **próprio** e `is_subscriber_link = true`.
- Exclusão é **soft delete**: setar `status = 'archived'` (não apaga histórico de cliques).
- `slug` fica queimado (tabela `used_slugs` já impede reuso — não vou mexer nisso).
- Confirmação obrigatória via modal ("Digite EXCLUIR pra confirmar") — evita clique acidental.
- Link arquivado deixa de redirecionar (`bump_short_link_click` já retorna `status <> 'active'` → não redireciona). ✅ já protegido.

## Implementação

1. **Server fn nova** `deleteMySubscriberLink` em `src/lib/link-subscribers.functions.ts`:
  - Usa `requireSupabaseAuth`.
  - Valida ownership + `is_subscriber_link = true` (mesmo padrão das outras fns do arquivo).
  - `UPDATE short_links SET status='archived' WHERE id=? AND user_id=?`.
2. **UI no `clientes.dashboard.tsx**`:
  - Botão "Excluir" (ícone Trash2 vermelho) em cada card de link, ao lado de Editar/Métricas.
  - Modal de confirmação com input "digite EXCLUIR".
  - Após sucesso: `toast` + refetch da lista.
  - Links arquivados **não aparecem** na listagem (filtro `status <> 'archived'` na query existente `listMyLinks`).

## Regras invioláveis respeitadas

- ✅ Não mexo em `r/$slug.ts`, `short-links.functions.ts`, RLS existente.
- ✅ Não afeta fluxo HS (só toca links com `is_subscriber_link=true`).
- ✅ Não deleta cliques históricos — métricas do link ficam preservadas caso o cliente peça relatório depois.

## Arquivos alterados

- `src/lib/link-subscribers.functions.ts` — nova fn + filtro `archived` em `listMyLinks`.
- `src/routes/clientes.dashboard.tsx` — botão + modal de confirmação.

## Risco: baixo-médio (soft delete, reversível via banco). Tempo: ~35 min.

---

**Ordem de execução:** P1.3 primeiro (5 fixes pequenos e independentes), depois P1.4. Publish único no final. Confirma que sigo?