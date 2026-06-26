# Landing Page HS Assessoria — Black & Gold

## Mudanças de Rotas

- `/` → nova **Landing Page pública** (atual dashboard sai daqui).
- `/login` → tela de acesso (renomeio de `/auth`). `/auth` passa a redirecionar para `/login`.
- `/painel` → novo home autenticado (move o conteúdo de `src/routes/_authenticated/index.tsx` para `_authenticated/painel.tsx`). Após login, redireciona para `/painel`.
- `/area` → redirect imediato para `/login`.
- Guarda do `_authenticated`: redirect de não-logado vai para `/login`; logado em `/login` vai para `/painel`.

## Estrutura da Landing (`/`)

Fundo preto/grafite com textura grain, acentos em **gold metálico** (mesmos tokens `--gold`, `--bronze`, `bg-gold-metal` do painel — sem inventar paleta nova). Tipografia: display já usada no projeto (`font-display`) + Inter para corpo.

Seções:
1. **Top bar minimal** — logo HS centralizada, link discreto "Acessar Painel" à direita.
2. **Hero** — headline grande ("Disparos em massa com alta performance e segurança"), subhead curta, CTA primário dourado **"Falar com Consultor"** → `https://wa.me/5531975225821`, CTA secundário fantasma "Ver planos" (scroll para #planos). Mockup/visual à direita reaproveitando estética do painel (cards gold + número grande de entregas).
3. **Benefícios** — grid 3 colunas com ícones dourados (lucide: ShieldCheck, Zap, Target). Títulos curtos + 1–2 linhas cada. Em mobile vira coluna única.
4. **Planos** (`#planos`) — grid responsivo de cards premium puxados da tabela `landing_plans` (ver abaixo). Cada card: nome, preço, descrição, lista de features, badge "Mais vendido" opcional, CTA WhatsApp. Loading skeleton enquanto carrega; se vazio, mostra placeholder discreto "Em breve".
5. **Prova/CTA final** — faixa com headline + botão WhatsApp.
6. **Rodapé** — copyright + link discreto **"Acessar Painel"** → `/login`.

**Botão flutuante WhatsApp**: fixo bottom-right, círculo verde-escuro com ícone, animação `animate-pulse` suave + halo dourado. Link para `https://wa.me/5531975225821`. Visível em todas as rotas públicas (`/`, `/login`).

Responsivo mobile-first (grids colapsam, hero empilha, tipografia escala).

## Admin editável dos planos

Nova tabela `public.landing_plans`:
- `name`, `price_label` (texto livre, ex: "R$ 497"), `period_label` (ex: "/mês" ou null), `description`, `features` (text[]), `cta_label`, `cta_url`, `highlighted` (bool), `sort_order` (int), `active` (bool), timestamps.
- RLS: `SELECT` público (anon + authenticated) só de `active = true`; `INSERT/UPDATE/DELETE` apenas para super_admin/admin via `has_role`.
- GRANTs: `SELECT` para anon e authenticated; `ALL` para service_role e roles admin via policies.
- Seed: vazio (usuário preenche).

Nova rota admin **`/admin/landing`** (`src/routes/_authenticated/admin/landing.tsx`):
- Lista cards existentes em tabela editável.
- Botões: Novo plano, Editar (modal), Reordenar (sort_order ±), Ativar/Desativar, Excluir.
- Form com todos os campos acima; features editadas como lista (add/remove linha).
- Link no menu admin (sidebar) com permissão `manage_landing` (adiciono ao set de permissões existente; super_admin sempre vê).

A landing pública lê via `useQuery` no client (sem server fn, usa `supabase` anon client e RLS pública).

## Arquivos

Criar:
- `src/routes/index.tsx` (substitui o atual — mover conteúdo público para cá)
- `src/components/landing/{hero,benefits,plans,footer,whatsapp-fab,top-bar}.tsx`
- `src/routes/login.tsx` (conteúdo do atual `/auth`)
- `src/routes/area.tsx` (redirect → /login)
- `src/routes/_authenticated/painel.tsx` (conteúdo do atual `_authenticated/index.tsx`)
- `src/routes/_authenticated/admin/landing.tsx`
- Migration `landing_plans` + permissão `manage_landing`

Editar:
- `src/routes/auth.tsx` → vira redirect para `/login` (ou deletar e ajustar referências)
- `src/routes/_authenticated/index.tsx` → redirect para `/painel`
- `src/routes/_authenticated/route.tsx` → redirect não-autenticado para `/login`
- `src/components/app-sidebar.tsx` → adicionar item "Landing" no grupo Admin
- Qualquer `navigate('/auth')` / `navigate('/')` pós-login → atualizar para `/login` / `/painel`

## Fora de escopo

- Não mexo no fluxo de campanhas, Infobip, encurtador, pedidos.
- WhatsApp link fica hardcoded com `5531975225821`; trocar futuramente é edição simples.
