---
name: Checkout sem CPF
description: Pagamento do assinante não pode pedir CPF nem bloquear assinatura por ausência de documento.
type: preference
---
O checkout/pagamento do assinante deve funcionar sem exigir CPF.

**Por quê:** a Iara rejeitou a fricção de CPF no fluxo de assinatura.

**Como aplicar:** não adicionar modal/campo obrigatório de CPF no painel do cliente. Se o gateway retornar erro relacionado a documento, ajustar o payload, configuração ou provedor — não pedir CPF ao cliente como solução padrão.