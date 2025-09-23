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
