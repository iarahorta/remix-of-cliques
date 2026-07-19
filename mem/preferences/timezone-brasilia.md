---
name: Timezone Brasília em todo o produto
description: Toda exibição de data/hora usa America/Sao_Paulo, inclusive métricas do cliente
type: preference
---
Regra global: todas as datas/horas exibidas (admin e cliente) usam America/Sao_Paulo.

Aplicar em: dashboard cliente, MetricsModal, exports CSV, painel admin, landing, e-mails.

Como: Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', ... }) ou toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }). Banco em UTC (timestamptz); converter só na apresentação. Agrupamentos por dia/hora feitos em BRT, não UTC.

Nunca: toLocaleString() sem timeZone, nem toISOString() para exibição.
