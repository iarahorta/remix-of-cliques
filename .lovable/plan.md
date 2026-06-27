Apontar o slug `kk44pd` para `https://www.metodospark.com/DA2`.

Passos:
1. Verificar se `kk44pd` já existe na tabela `short_links`.
2. Se existir: `UPDATE short_links SET target_url='https://www.metodospark.com/DA2', is_rotating=false, status='active' WHERE slug='kk44pd'` e limpar `short_link_urls` desse id.
3. Se não existir: `INSERT INTO short_links (slug, target_url, status, is_rotating) VALUES ('kk44pd', 'https://www.metodospark.com/DA2', 'active', false)`.
4. Testar com curl que `https://cliques.site/r/kk44pd` retorna 302 → destino correto.