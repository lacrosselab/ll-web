import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Masks email addresses for logging (keeps first char, last char before @, and domain)
 * Example: test@example.com -> t**t@example.com
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return email
  }
  
  const [localPart, domain] = email.split('@')
  if (localPart.length <= 2) {
    return `${localPart[0]}**@${domain}`
  }
  
  const firstChar = localPart[0]
  const lastChar = localPart[localPart.length - 1]
  return `${firstChar}**${lastChar}@${domain}`
}

/**
 * Sanitizes known sensitive fields in meta objects
 */
function sanitizeMeta(meta?: Record<string, any>): Record<string, any> | undefined {
  if (!meta) return meta
  
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization']
  const sanitized = { ...meta }
  
  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase()
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]'
    } else if (lowerKey.includes('email') && typeof sanitized[key] === 'string') {
      // Mask emails unless ENABLE_PII_LOGS is true
      if (process.env.ENABLE_PII_LOGS !== 'true') {
        sanitized[key] = maskEmail(sanitized[key])
      }
    }
  }
  
  return sanitized
}

/**
 * Serializes log payload consistently for console transport
 */
function serializeLog(message: string, meta?: Record<string, any>): string {
  const sanitized = sanitizeMeta(meta)
  if (!sanitized || Object.keys(sanitized).length === 0) {
    return message
  }
  
  try {
    return `${message} ${JSON.stringify(sanitized)}`
  } catch {
    return `${message} [Unable to serialize meta]`
  }
}

// Secure logging utility with structured payloads
export const logger = {
  // Log in development or when ENABLE_DEBUG_LOGS is true
  debug: (message: string, meta?: Record<string, any>) => {
    if (process.env.NODE_ENV === 'development' || process.env.ENABLE_DEBUG_LOGS === 'true') {
      console.log(serializeLog(message, meta))
    }
  },
  
  // Always log errors (but sanitize sensitive data)
  error: (message: string, meta?: Record<string, any>) => {
    const sanitized = sanitizeMeta(meta)
    if (meta?.error instanceof Error) {
      const errorMeta = {
        ...sanitized,
        error: {
          message: meta.error.message,
          name: meta.error.name,
          stack: process.env.NODE_ENV === 'development' ? meta.error.stack : undefined,
        }
      }
      console.error(serializeLog(message, errorMeta))
    } else {
      console.error(serializeLog(message, sanitized))
    }
  },
  
  // Always log warnings
  warn: (message: string, meta?: Record<string, any>) => {
    console.warn(serializeLog(message, meta))
  },
  
  // Always log info (but be careful with sensitive data)
  info: (message: string, meta?: Record<string, any>) => {
    console.info(serializeLog(message, meta))
  }
}

// Date-only helpers to avoid timezone shifts for YYYY-MM-DD fields
// These ensure the rendered calendar date matches what's stored in the DB
export function parseDateOnlyUTC(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function formatDateOnly(
  dateString: string,
  locale: string = 'en-US',
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
): string {
  try {
    const date = parseDateOnlyUTC(dateString)
    return date.toLocaleDateString(locale, { ...options, timeZone: 'UTC' })
  } catch {
    return dateString
  }
}

export function formatDateRange(
  startDateString: string,
  endDateString?: string,
  locale: string = 'en-US',
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
): { start: string; end?: string } {
  const start = formatDateOnly(startDateString, locale, options)
  if (!endDateString) return { start }
  const end = formatDateOnly(endDateString, locale, options)
  return { start, end }
}
