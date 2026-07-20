import type { ComponentType } from 'react'
import { template as trialExpiring } from './trial-expiring'
import { template as subscriptionExpiring } from './subscription-expiring'
import { template as subscriptionBlocked } from './subscription-blocked'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'trial-expiring': trialExpiring,
  'subscription-expiring': subscriptionExpiring,
  'subscription-blocked': subscriptionBlocked,
}
