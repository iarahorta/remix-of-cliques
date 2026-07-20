import React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  daysLeft?: number
  checkoutUrl?: string
}

const Email = ({ name, daysLeft = 1, checkoutUrl = 'https://www.zpclik.site/clientes/dashboard' }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Sua assinatura ZPclik vence em breve</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Sua assinatura vence em {daysLeft} {daysLeft === 1 ? 'dia' : 'dias'}</Heading>
        <Text style={text}>{name ? `Olá, ${name}!` : 'Olá!'}</Text>
        <Text style={text}>
          Sua assinatura do <strong>ZPclik</strong> está próxima do vencimento.
          Renove agora e evite interrupção nas suas campanhas ativas.
        </Text>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={checkoutUrl} style={button}>Renovar assinatura</Button>
        </Section>
        <Text style={muted}>
          Após o vencimento, você terá 3 dias para regularizar antes do bloqueio automático.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Sua assinatura ZPclik vence em breve',
  displayName: 'Assinatura vencendo',
  previewData: { name: 'Iara', daysLeft: 1 },
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