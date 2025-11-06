import { Resend } from 'resend'

// Don't throw in test environment - allow tests to mock this module
// This guard ensures no side-effects during module initialization in tests
const isTestEnv = process.env.VITEST || process.env.NODE_ENV === 'test'

if (!process.env.RESEND_API_KEY && !isTestEnv) {
  throw new Error('RESEND_API_KEY is not set')
}

// Use test key in test environment, otherwise use the actual API key
// Tests should mock this module, but we provide a fallback to prevent import errors
// Creating Resend instance is safe even in test env as it's just an object creation
export const resend = new Resend(
  process.env.RESEND_API_KEY || (isTestEnv ? 'test-key' : '')
)

