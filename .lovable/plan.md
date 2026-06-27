Plano para resolver agora:

1. Gerar uma nova `CLIQUES_API_KEY`.
2. Salvar essa nova chave no secret `CLIQUES_API_KEY`, substituindo a anterior.
3. Criar uma forma prática de você usar a chave no projeto HS sem depender do botão de copiar dessa tela:
   - opção segura recomendada: eu abro o formulário de atualização de secret no projeto HS e você cola/define a mesma chave lá;
   - se você preferir, posso também criar temporariamente um endpoint interno protegido/one-time para mostrar a chave recém-gerada uma única vez, e depois remover esse endpoint.
4. Validar que a API do cliques continua respondendo com a nova chave.

Observação importante: não dá para revelar/copiar um secret já salvo nessa tela porque ele é write-only. A solução é rotacionar para um novo valor e inserir esse novo valor no HS.