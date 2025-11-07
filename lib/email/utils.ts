import { render } from '@react-email/render'
import type { ReactElement } from 'react'

/**
 * Renders a React Email template to HTML
 */
export async function renderEmailTemplate(template: ReactElement): Promise<string> {
  return render(template)
}

/**
 * Formats currency amount in cents to dollar string
 */
export function formatCurrency(amountCents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amountCents / 100)
}

/**
 * Formats a date string or Date object for email display
 */
export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(dateObj)
}

/**
 * Formats a date and time for email display
 */
export function formatDateTime(date: string | Date, time?: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const dateStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(dateObj)
  
  if (time) {
    return `${dateStr} at ${time}`
  }
  
  return dateStr
}

