import React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  daysOverdue?: number
  checkoutUrl?: string
}

const Email = ({ name, daysOverdue = 3, checkoutUrl = 'https://www.zpclik.site/clientes/dashboard' }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Sua conta ZPclik foi bloqueada por falta de pagamento</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Conta bloqueada 🔒</Heading>
        <Text style={text}>{name ? `Olá, ${name}.` : 'Olá.'}</Text>
        <Text style={text}>
          Sua assinatura do <strong>ZPclik</strong> está com pagamento em atraso há <strong>{daysOverdue} dias</strong>.
          Por isso, seus links foram <strong>bloqueados</strong> e não estão mais redirecionando.
        </Text>
        <Text style={text}>
          Regularize agora e reative tudo imediatamente. Nenhum dado é perdido —
          seus links e métricas voltam intactos assim que o pagamento for confirmado.
        </Text>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={checkoutUrl} style={button}>Regularizar pagamento</Button>
        </Section>
        <Text style={muted}>
          Dúvidas? Responda este e-mail que nosso time te ajuda.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: '🔒 Sua conta ZPclik foi bloqueada por falta de pagamento',
  displayName: 'Bloqueio por inadimplência',
  previewData: { name: 'Iara', daysOverdue: 3 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0a0a0a' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }
const h1 = { fontSize: '22px', fontWeight: '700', color: '#0a0a0a', margin: '0 0 16px' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#1a1a1a', margin: '0 0 12px' }
const muted = { fontSize: '13px', color: '#6b7280', marginTop: '24px' }
const button = {
  backgroundColor: '#D4AF37',
  color: '#0a0a0a',
  padding: '14px 28px',
  borderRadius: '8px',
  fontWeight: '700',
  textDecoration: 'none',
  fontSize: '15px',
}