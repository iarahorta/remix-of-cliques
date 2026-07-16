## Objetivo

No formulário de criação de link **Rotativo** (e no modal de edição de rotação) em `/clientes/dashboard`, permitir montar a lista de URLs a partir de **número de WhatsApp + mensagem**, sem sair da tela. Cada par (número, mensagem) vira automaticamente uma URL `https://wa.me/<numero>?text=<mensagem>` adicionada à lista de rotação.

Assim a pessoa cria **um único link rotativo** que distribui cliques entre vários números de WhatsApp.

## Comportamento

Dentro do bloco "Rotativo" (hoje só aceita URL crua), adicionar um seletor de tipo de entrada por linha:

- **URL** (atual): campo único de URL + peso.
- **WhatsApp** (novo): dois campos — `Número` (com máscara/limpeza aceitando `+55 11 9...`) e `Mensagem` (opcional, textarea curta) + peso.

Ao digitar em modo WhatsApp, a URL final é montada em tempo real:
`https://wa.me/<digits>?text=<encodeURIComponent(mensagem)>`
e é isso que é enviado ao backend no `rotation_urls[].url`. Nenhuma mudança de schema — continua salvando URLs no `short_link_urls`.

Botão **"+ Adicionar número"** (atalho que já cria uma linha em modo WhatsApp) e **"+ Adicionar URL"** (linha em modo URL). Mínimo 2 destinos, máximo 20 (regra que já existe).

Validações no cliente:
- Número: só dígitos após limpar máscara, 10–15 dígitos; erro inline se inválido.
- Mensagem: opcional, até 500 chars.
- URL (modo URL): precisa começar com `http(s)://`.
- Peso: 0–1000 (já existe).

Ao editar um link rotativo existente, se a URL casar com `^https?://wa\.me/(\d+)(?:\?text=(.*))?$`, a linha é aberta em modo **WhatsApp** já com número e mensagem decodificados; caso contrário, abre em modo URL. Isso é só UI — o valor salvo continua sendo a URL final.

## Arquivos a alterar

- `src/routes/clientes.dashboard.tsx`
  - Estender o estado do formulário de criação para cada item da rotação guardar `{ kind: "url" | "whatsapp", url?, phone?, message?, weight }`.
  - Helper `buildWaUrl(phone, msg)` (já usado no modo simples) e novo `parseWaUrl(url)` para o modo edição.
  - Antes de submeter, mapear itens para `{ url: kind === "whatsapp" ? buildWaUrl(...) : url, weight }`.
  - Aplicar a mesma UI dentro do `EditTargetModal` na aba "Rotativo".
- Nenhuma alteração em `src/lib/link-subscribers.functions.ts`, na rota `r.$slug.ts`, no banco ou nas rotas HS. Fluxo da HS continua intocado.

## Verificação

- `bun run build` limpo.
- Criar link rotativo com 2 números + 1 URL crua → conferir no banco: `is_rotating=true`, 3 linhas em `short_link_urls` com URLs `wa.me/...` e a URL crua.
- Abrir esse link no modal de edição → as duas primeiras linhas aparecem em modo WhatsApp com número e mensagem preenchidos; a terceira em modo URL.
- `cliques.site/r/<slug>` rotaciona entre os destinos.
