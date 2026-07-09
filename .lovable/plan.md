## O que já está pronto no projeto cliques

Foi adicionado o endpoint público:

```
GET https://cliques.site/api/public/links/{slug}/clicks
```

- Autenticação: header `x-api-key: $CLIQUES_API_KEY` (ou `Authorization: Bearer ...`)
- Query params opcionais: `limit` (default 500, máx 2000), `since`, `until` (ISO)
- Retorno: `{ slug, count, clicks: [{ id, slug, target_url, ip, country, region, city, user_agent, referer, created_at }] }`

Observação: o endpoint só existe depois que a nova versão do cliques for publicada. Em preview ele responde no domínio de preview, não em `https://cliques.site`. Se o hs está batendo em `cliques.site` e recebendo 404, é porque o cliques ainda não foi republicado.

## O que o projeto hs precisa fazer

1. Publicar/garantir que o cliques está com a versão nova no ar (`https://cliques.site`).
2. No hs, ter os secrets:
   - `CLIQUES_API_URL = https://cliques.site`
   - `CLIQUES_API_KEY = <mesma chave configurada no cliques>`
3. Criar (ou ajustar) no hs uma server function que faz:

```
GET `${CLIQUES_API_URL}/api/public/links/${slug}/clicks?limit=500`
headers: { 'x-api-key': CLIQUES_API_KEY }
```

e devolve `clicks` para a UI.

4. Na tela onde as métricas devem aparecer, chamar essa server function (via `useQuery`) e renderizar a tabela com data, IP, país/região/cidade, dispositivo (parse do user_agent), referrer e URL de destino — mesmo formato do painel do cliques.

## Passos para eu executar no hs (quando você trocar de projeto)

- Adicionar os secrets `CLIQUES_API_URL` e `CLIQUES_API_KEY`.
- Criar `src/lib/cliques.functions.ts` com `getLinkClicks({ slug, limit?, since?, until? })`.
- Adicionar a UI de métricas (modal/aba) no lugar onde o link é listado, consumindo essa função.
- Tratar erros comuns: 401 (chave errada), 404 (slug não existe no cliques ainda), rede.

## Como confirmar rapidamente que o cliques está respondendo

Depois de publicado, no terminal do hs:

```
curl -H "x-api-key: $CLIQUES_API_KEY" \
  "https://cliques.site/api/public/links/yn0683/clicks?limit=5"
```

Se voltar JSON com `clicks`, o cliques está ok e o problema fica só no hs. Se voltar 404/HTML, o cliques ainda não subiu a nova versão.

## Preciso confirmar antes de seguir

- O consumo das métricas vai ser feito no projeto hs (troco de projeto)? Ou você quer que eu apenas prepare aqui no cliques algo a mais?
- A chave `CLIQUES_API_KEY` já está configurada como secret aqui no cliques? Se não, precisamos gerar e cadastrar em ambos os projetos.
