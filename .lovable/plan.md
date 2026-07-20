## Problema

No painel `/clientes/dashboard`, no bloco "🎁 Teste grátis ativo", o botão **"Assinar agora — R$ 19,90/mês"** não responde ao clique — sem loading, sem modal PIX, sem toast de erro. Ou seja, o fluxo de conversão de trial → assinatura paga está morto.

## Diagnóstico (não confirmado ainda)

O código está aparentemente correto:
- `onClick={openInvoice}` → `openInvoiceAuto` → `createPix()` (server fn `createAsgardPixCharge`).
- `useServerFn` está registrado, `attachSupabaseAuth` está no `functionMiddleware`, os segredos `ASGARD_PUBLIC_KEY` / `ASGARD_SECRET_KEY` existem.
- Todos os erros dentro de `openInvoiceAuto` são capturados em `try/catch` e mostrados via `toast.error(...)`.

Como o usuário diz que **nada** acontece (nem toast, nem loading), suspeitas prováveis, em ordem:

1. **`<Toaster />` do sonner não está montado** nesta rota (o toast é chamado mas não aparece) — e algum erro ocorre silenciosamente antes de `setBillingLoading(true)` fazer efeito visível.
2. **A chamada da server fn está falhando antes do handler** (ex.: middleware de auth rejeitando por algum motivo, ou erro no client bundle) e o `catch` só pega `Error` — se vier um `Response`/redirect cru, o `e?.message` vira `undefined` e o toast aparece vazio (parece "nada").
3. **AsgardPay retorna erro 4xx** (ex.: `cpf` exigido, `amount` mínimo, credenciais em modo produção vs sandbox) e a mensagem chega, mas o Toaster não existe no DOM.

Sem network/console capturados nesta sessão, preciso instrumentar para confirmar.

## Plano de correção

### 1. Garantir feedback visual ao usuário
- Confirmar que `<Toaster />` do `sonner` está montado no `__root.tsx` (ou adicionar se estiver faltando na rota `/clientes/dashboard`).
- No `catch` do `openInvoiceAuto`, garantir mensagem de fallback quando `e?.message` for vazio: `toast.error(String(e?.message ?? e ?? "Falha ao gerar cobrança"))`.

### 2. Instrumentar diagnóstico temporário
- Adicionar `console.log("[assinar] click", { billingLoading })` e `console.log("[assinar] pix resp", r)` em `openInvoiceAuto` para o próximo turno já trazer sinais reais nos logs do preview.

### 3. Endurecer o `createAsgardPixCharge`
- No handler, envolver `createAsgardPix(...)` num `try/catch` que faz `console.error("[asgard] falhou", err)` no server e re-lança `Error` com `message` limpo em PT-BR (ex.: `"Não foi possível criar a cobrança (Asgard: XXX). Tente de novo."`), para o toast do cliente sempre ter conteúdo legível.

### 4. Verificar payload aceito pela Asgard
- Após confirmar via logs qual erro a API retorna, ajustar:
  - Se for `cpf obrigatório` → abrir modal pedindo CPF antes de gerar o PIX (já temos coluna `cpf` em `link_subscribers`).
  - Se for `amount` / `currency` / campo faltando → ajustar o body em `asgard.server.ts`.
  - Se for credencial (401/403) → informar a Iara para revisar chaves na Asgard.

### 5. Publicar após confirmar fluxo funcionando ponta a ponta
- Testar com a conta `iarachorta@gmail.com` (trial) gerando PIX real, ver modal, copiar código, verificar status. Só depois publicar.

## Escopo

Somente arquivos:
- `src/routes/clientes.dashboard.tsx` (mensagens de erro + logs temporários + garantia de Toaster).
- `src/routes/__root.tsx` (adicionar `<Toaster />` se faltar).
- `src/lib/asgard-billing.functions.ts` (mensagens de erro server-side).
- `src/lib/asgard.server.ts` (log de erro do gateway).

**Não vou tocar em**: RLS, tabelas, políticas, fluxo HS, encurtador, rotas de rota `/r/`, nem no gateway/segredos.

## Riscos

- Baixo. Todas as mudanças são de UX/observabilidade + hardening de erro; nenhuma altera lógica de billing, período de assinatura ou permissões.

## Próximo passo depois deste plano

Após ver os logs reais (turno seguinte), aplicar o fix definitivo (provavelmente exigir CPF antes do PIX, ou ajustar payload da Asgard).
