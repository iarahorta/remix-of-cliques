
# Sistema de Parceiros e Comissionamento — Arquitetura V1

Objetivo: uma única arquitetura que serve gerente, White Labels da HS, afiliados, agências e revendedores, com regras de comissão por parceiro (e no futuro por produto), sem refatoração. Sem afiliação-marketing como termo — o menu é **Parceiros**.

## 1. Princípios

- **Token público, nunca ID.** O parceiro é identificado externamente por um token curto tipo `9XkA71Lm`. IDs de banco jamais aparecem em URL.
- **Origem sempre rastreada.** Todo `link_subscriber` (assinante) carrega o parceiro que originou a venda; sem parceiro = "direct" (parceiro-sistema).
- **Comissão só sobre líquido.** Bruto − taxas do gateway − outras taxas = líquido. Percentual mora no parceiro (ou override por produto), nunca no código.
- **Comissão só nasce em pagamento confirmado** (webhook Asgard `order.completed`), com **UNIQUE por pagamento** — reembolso reverte, não duplica.
- **Desacoplado da HS.** ZPclik só conhece o token. HS distribui o link `zpclik.site/?ref=TOKEN` do jeito que quiser.

## 2. Tabelas (schema completo)

### 2.1 `partners` — cadastro do parceiro
- `id uuid` (interno)
- `public_token text unique` — 8-12 chars base62, gerado no banco
- `type partner_type` — enum: `manager | white_label | affiliate | agency | reseller`
- `name`, `email`, `phone`, `tax_id` (CPF/CNPJ), `pix_key`, `pix_key_type`
- `default_commission_bps int` — pontos-base (2000 = 20,00%). Evita float.
- `status partner_status` — `active | inactive | suspended`
- `notes text`
- `owner_user_id uuid` (opcional — se um dia o parceiro logar no painel)
- `created_at`, `updated_at`

### 2.2 `partner_products` — override de comissão por produto (preparação futura)
- `partner_id`, `product_code text` (`zpclik` hoje; `hs`, `outro-saas` amanhã)
- `commission_bps int`, `active bool`
- UNIQUE(`partner_id`, `product_code`)
- Regra de resolução: se existir linha ativa aqui → usa; senão cai no `default_commission_bps` do parceiro.

### 2.3 `partner_referrals` — atribuição da origem
- `id`, `partner_id`, `public_token` (snapshot do token no momento do clique)
- `visitor_id text` — cookie/localStorage ID anônimo (uuid v4 gerado no cliente)
- `subscriber_id uuid null` — preenchido quando o visitante vira assinante
- `landing_url`, `utm_source/medium/campaign/content/term`, `referer`, `ip_hash`, `user_agent`
- `first_seen_at`, `attributed_at`, `expires_at` (first_seen + **90 dias**)
- Índice em `visitor_id` e `partner_id`.

**Regra de atribuição (first-touch, janela 90 dias):**
1. `?ref=TOKEN` na URL → grava cookie+localStorage `zpclik_ref` = `{token, visitor_id, exp}` por 90 dias.
2. No signup do `/clientes`, o cliente já envia `visitor_id` + `token` corrente ao criar o `link_subscriber`.
3. Server valida token → grava `partner_id` no `link_subscribers` **e** fecha o `partner_referrals` (attributed_at, subscriber_id).
4. Se o visitante volta em <90 dias sem `?ref`, o cookie ainda vale.
5. Se voltar com `?ref` diferente → **first-touch vence** (não sobrescreve) — política definitiva, evita roubo de comissão.

### 2.4 Alterações em `link_subscribers`
- `+ partner_id uuid null references partners(id)`
- `+ referral_id uuid null references partner_referrals(id)`
- `+ attributed_at timestamptz`
- Imutável após set (trigger): protege contra troca de parceiro depois da venda.

### 2.5 `partner_commissions` — histórico
- `id`, `partner_id`, `subscriber_id`, `product_code` (`zpclik`)
- `source_type text` (`asgard_pix` hoje), `source_id text` — ex.: `order_id` do Asgard
- **UNIQUE(`source_type`, `source_id`)** — trava de duplicidade
- `gross_cents int`, `gateway_fee_cents int`, `other_fee_cents int`, `net_cents int` (generated: gross - gateway - other)
- `commission_bps int` (snapshot), `commission_cents int` (calculado no insert)
- `status commission_status` — `pending | approved | paid | canceled | reversed`
- `paid_at`, `paid_method` (`pix_manual` por enquanto), `paid_ref` (comprovante)
- `notes`, `created_at`, `updated_at`
- Índices: (partner_id, status), (subscriber_id), (created_at).

### 2.6 `gateway_fee_rules` — taxa registrada por gateway/método
- `gateway text` (`asgard`), `method text` (`pix`), `fixed_cents int`, `percent_bps int`, `active bool`, `effective_from`, `effective_to`
- Ao registrar o pagamento, snapshot da regra vigente entra em `partner_commissions.gateway_fee_cents`.
- Se não houver regra, `gateway_fee_cents=0` (líquido = bruto) — e log de aviso.

### 2.7 `partner_payouts` (opcional agora, obrigatório amanhã — deixamos a tabela pronta e vazia)
- Agrupa `partner_commissions` pagas num lote. Hoje o admin marca uma-a-uma como `paid`. Amanhã: lote + comprovante único. **Sem quebra de contrato.**

## 3. Fluxo da venda

```text
HS / gerente / site externo
    │  link: https://zpclik.site/?ref=TOKEN
    ▼
Landing zpclik
    │  1. Root loader lê ?ref → chama server fn públic get_partner_by_token(token)
    │     (retorna { token, active } ou null — nunca vaza id/nome)
    │  2. Se válido: seta cookie+localStorage zpclik_ref (90d, first-touch)
    │     e INSERT em partner_referrals (visitor_id, ip_hash, ua, landing_url, utm...)
    ▼
Cliente cria conta em /clientes  (link_subscribers.insert)
    │  Client envia { visitor_id, ref_token } no signup
    │  Server fn signupSubscriber:
    │    - valida token → partner_id
    │    - INSERT link_subscribers com partner_id + referral_id + attributed_at
    │    - UPDATE partner_referrals SET subscriber_id, attributed_at
    ▼
Cliente gera PIX (asgard_pix_charges.insert)
    │  Nada muda aqui.
    ▼
Webhook Asgard "order.completed"  (já existe: /api/public/webhooks/asgard)
    │  Nova etapa idempotente:
    │    IF link_subscriber.partner_id IS NOT NULL
    │      INSERT partner_commissions (
    │        source_type='asgard_pix', source_id=order_id,   ← UNIQUE
    │        gross = charge.amount_cents,
    │        gateway_fee = gateway_fee_rules(asgard,pix).apply(gross),
    │        commission_bps = resolve_commission_bps(partner, 'zpclik'),
    │        status='pending'
    │      ) ON CONFLICT DO NOTHING
    │    Marca approved automaticamente após N dias (política V1: aprovação
    │    manual pelo admin — status vira 'approved' quando o admin decide).
    ▼
Admin → menu Comissões → aprova → paga (marca 'paid' + registra ref/comprovante)
```

## 4. Segurança

- `?ref=TOKEN` só existe pra atribuir; sozinho não cria comissão.
- Comissão nasce **apenas dentro do webhook Asgard**, dentro de uma transação, com constraint UNIQUE(`source_type`,`source_id`).
- Reembolso/estorno: nova entrada no webhook → server fn `reverse_commission(source_id)` marca `reversed` e cria linha compensatória se já estava `paid`.
- RLS:
  - `partners`, `partner_commissions`, `partner_referrals`, `partner_products`, `gateway_fee_rules`, `partner_payouts` → apenas admin/super_admin via `has_role`. Sem `anon`, sem `authenticated` amplo.
  - Server fn pública `get_partner_by_token(token)` roda com `SECURITY DEFINER`, retorna só `{ active, token }`.
  - `link_subscribers` ganha `partner_id`/`referral_id` — leitura continua restrita ao dono; admin lê tudo.
- Token: 10 chars base62, gerado com `gen_random_bytes` no Postgres; UNIQUE + rotacionável.
- Rate-limit no endpoint público de validação (IP + UA) via edge log.
- Nunca confiar no cookie: no signup e no webhook, servidor **revalida** o token e o parceiro estar `active`.

## 5. Painel Admin (novas telas)

Rota base: `_authenticated/admin/parceiros` (gate `has_role('admin')`).

1. **Parceiros** (`/admin/parceiros`)
   - Lista com filtros por tipo/status.
   - Botão "Novo parceiro" → form (nome, tipo, email, telefone, tax_id, pix, %, obs).
   - Editar tudo, inclusive `%` e status. Token é read-only + botão "Rotacionar token".
   - Link de indicação copiável: `https://www.zpclik.site/?ref=TOKEN`.

2. **Comissões** (`/admin/comissoes`)
   - Colunas: Parceiro · Cliente · Produto · Bruto · Taxas · Líquido · % · Comissão · Status · Origem · Data.
   - Filtros por status/parceiro/período. Export CSV.
   - Ações em lote: aprovar, marcar como paga (abre modal com PIX/comprovante), cancelar/estornar.

3. **Dashboard do parceiro** (`/admin/parceiros/$token`)
   - Cards: indicados · assinaturas ativas · receita líquida · comissões pendentes/aprovadas/pagas · total recebido · última venda · ticket médio · conversão (referrals→subscribers).
   - Tabela de comissões do parceiro.

4. **Regras de taxa** (`/admin/parceiros/regras-taxa`) — CRUD de `gateway_fee_rules`. Deixa a HS/admin ajustar sem código.

## 6. Preparação para o futuro (sem refatoração)

- **Multi-produto**: coluna `product_code` em todos os lugares certos + `partner_products`. Amanhã HS vira `product_code='hs'`.
- **Múltiplos gateways**: `source_type` já é livre; `gateway_fee_rules` já é por (gateway, method).
- **Área do parceiro logado**: `partners.owner_user_id` + rota `_authenticated/parceiro/*` — só ligar UI.
- **Saque**: tabela `partner_payouts` já criada e vazia; hoje pagamento manual.
- **Webhook/API pública para parceiros**: futuro `/api/public/partners/*` com auth por token — arquitetura já favorece.
- **Campanhas / links personalizados**: `partner_referrals` já grava utm_*; expandir com `partner_campaigns` depois sem tocar em `partners`/`commissions`.

## 7. Detalhes técnicos (para você, não para o painel)

- Migração cria: enums `partner_type`, `partner_status`, `commission_status`; tabelas listadas; função `public.generate_partner_token()` (base62 10 chars, retry até UNIQUE ok); função `public.resolve_commission_bps(partner_id, product_code)`; função `public.record_partner_commission(source_type, source_id, subscriber_id, gross_cents)` chamada de dentro do webhook Asgard.
- GRANTs conforme regra: todas as tabelas de parceiros com `TO authenticated` + `TO service_role`, políticas via `has_role('admin')`. Nada `TO anon`.
- Server fns novas em `src/lib/partners.functions.ts` (admin) + `src/lib/partner-attribution.functions.ts` (pública, só `get_partner_by_token` e `track_visit`).
- Webhook Asgard (`src/routes/api/public/webhooks.asgard.ts`) ganha bloco final `record_partner_commission(...)` — idempotente pela UNIQUE.
- Nenhum arquivo do fluxo HS é tocado.

## 8. Por que essa arquitetura

- **Uma tabela `partners` para todos os tipos** evita o clássico erro de fazer "tabela de gerentes" hoje e "tabela de white labels" amanhã. O `type` custa nada e destrava relatórios.
- **`commission_bps` inteiro** elimina erros de float em dinheiro.
- **UNIQUE(source_type, source_id)** é a defesa mais barata e mais eficaz contra comissão duplicada — nem dois webhooks simultâneos conseguem furar.
- **First-touch com janela + revalidação no servidor** casa com o comportamento comercial ("quem trouxe leva") e é auditável (referral row existe antes da venda).
- **Taxa por regra versionada** permite HS/admin corrigir o líquido sem migração quando o Asgard mudar tabela.
- **Product_code desde o dia 1** é o que evita a refatoração quando a HS entrar como segundo produto — o mesmo `partners` já serve.

---

## 9. Execução após aprovação

1. Migração única (enums + tabelas + funções + GRANTs + RLS + colunas em `link_subscribers`).
2. Server fns admin (CRUD parceiros, listar/filtrar comissões, aprovar/pagar/estornar) + pública (validar token, registrar referral).
3. Hook de atribuição no root loader / signup.
4. Extensão do webhook Asgard.
5. Telas admin (Parceiros, Comissões, Dashboard do parceiro, Regras de taxa).
6. Seed: parceiro-sistema "direct" + parceiro real da gerente (você me passa nome/pix/%; 20% default).
7. Auditoria: re-scan de segurança e teste de ponta-a-ponta com um pagamento real de R$ 19,90.

Confirma essa arquitetura que eu já começo pela migração?
