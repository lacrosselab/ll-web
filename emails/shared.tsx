/**
 * Shared styles and utilities for email templates
 */

// Default session location - can be overridden via environment variable
export const DEFAULT_SESSION_LOCATION = process.env.SESSION_LOCATION || '3006 Impala Place, Unit B, Henrico, VA 23228'

/**
 * Generate a Google Maps search link for a location
 */
export function getGoogleMapsLink(location: string): string {
  const encodedLocation = encodeURIComponent(location)
  return `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`
}

/**
 * Format time string (HH:MM:SS) to readable format (H:MM AM/PM)
 */
export function formatTime(time?: string): string | null {
  if (!time || time === '00:00:00') return null
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

/**
 * Format date string to readable format
 */
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

/**
 * Format currency amount in cents to dollar string
 */
export function formatCurrency(cents: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(cents / 100)
}

/**
 * Shared email styles
 */
export const emailStyles = {
  main: {
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  },

  container: {
    margin: '0 auto',
    padding: '0 48px',
    marginBottom: '64px',
    color: 'hsl(250 100% 13%)' as const, // Navy
  },

  h1: {
    color: 'hsl(350 89% 50%)' as const, // Strawberry
    fontSize: '24px',
    fontWeight: 'bold' as const,
    margin: '20px 0',
    padding: '0',
  },

  h2: {
    fontSize: '20px',
    fontWeight: 'bold' as const,
    margin: '10px 0',
    padding: '0',
  },

  h3: {
    fontSize: '18px',
    fontWeight: 'bold' as const,
    margin: '5px 0',
    padding: '0',
  },

  text: {
    fontSize: '16px',
    lineHeight: '20px',
  },

  section: {
    padding: '20px 0',
  },

  itemSection: {
    padding: '15px 0',
    borderBottom: '1px solid #e0e0e0',
  },

  registrationSection: {
    padding: '15px',
    borderRadius: '4px',
    margin: '10px 0',
  },

  itemText: {
    color: '#333',
    fontSize: '14px',
    lineHeight: '22px',
    margin: '5px 0',
  },

  totalText: {
    fontSize: '18px',
    lineHeight: '26px',
    textAlign: 'right' as const,
  },

  hr: {
    borderColor: '#e0e0e0',
    margin: '20px 0',
  },

  success: {
    color: '#28a745',
    fontWeight: 'bold' as const,
  },

  footer: {
    fontSize: '12px',
    lineHeight: '16px',
    marginTop: '20px',
  },

  linkStyle: {
    color: '#0066cc',
    textDecoration: 'underline' as const,
  },

  locationText: {
    fontSize: '12px',
    lineHeight: '18px',
    marginTop: '8px',
  },
} as const

