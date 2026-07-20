import React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  hoursLeft?: number
  checkoutUrl?: string
}

const Email = ({ name, hoursLeft = 6, checkoutUrl = 'https://www.zpclik.site/clientes/dashboard' }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu teste grátis do ZPclik está acabando</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Seu teste grátis está acabando ⏰</Heading>
        <Text style={text}>{name ? `Olá, ${name}!` : 'Olá!'}</Text>
        <Text style={text}>
          Seu teste grátis do <strong>ZPclik</strong> termina em aproximadamente <strong>{hoursLeft}h</strong>.
          Depois disso, seus links deixam de redirecionar e as métricas ficam pausadas.
        </Text>
        <Text style={text}>
          Assine agora por apenas <strong>R$ 19,90/mês</strong> (de R$ 39,90) e mantenha
          suas campanhas rodando sem interrupção.
        </Text>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={checkoutUrl} style={button}>Assinar agora</Button>
        </Section>
        <Text style={muted}>Se você já assinou, ignore este e-mail.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Seu teste grátis do ZPclik termina em breve',
  displayName: 'Trial expirando',
  previewData: { name: 'Iara', hoursLeft: 6 },
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