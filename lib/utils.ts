import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Secure logging utility
export const logger = {
  // Only log in development
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(...args)
    }
  },
  
  // Always log errors (but sanitize sensitive data)
  error: (message: string, error?: any) => {
    const sanitizedError = error instanceof Error 
      ? { message: error.message, name: error.name }
      : error
    console.error(message, sanitizedError)
  },
  
  // Always log warnings
  warn: (...args: any[]) => {
    console.warn(...args)
  },
  
  // Always log info (but be careful with sensitive data)
  info: (...args: any[]) => {
    console.info(...args)
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
