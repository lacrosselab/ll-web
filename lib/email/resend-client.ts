import { Resend } from 'resend'
import { logger } from '@/lib/utils'

// Don't throw in test environment - allow tests to mock this module
// This guard ensures no side-effects during module initialization in tests
const isTestEnv = process.env.VITEST || process.env.NODE_ENV === 'test'

let resendInstance: Resend | null = null

/**
 * Get Resend client instance, validating API key on first call
 * This avoids throw-on-start and improves diagnosability
 */
export function getResend(): Resend {
  if (resendInstance) {
    return resendInstance
  }
  
  const apiKey = process.env.RESEND_API_KEY
  
  if (!apiKey && !isTestEnv) {
    logger.error('RESEND_API_KEY missing', { env: process.env.NODE_ENV })
    throw new Error('RESEND_API_KEY is not set')
  }
  
  // Validate API key format (Resend API keys typically start with "re_")
  if (apiKey && !isTestEnv) {
    const apiKeyPrefix = apiKey.substring(0, 3)
    const apiKeyLength = apiKey.length
    const isValidFormat = apiKey.startsWith('re_') && apiKeyLength > 10
    
    if (!isValidFormat) {
      logger.warn('RESEND_API_KEY format validation', {
        prefix: apiKeyPrefix,
        length: apiKeyLength,
        expectedPrefix: 're_',
        env: process.env.NODE_ENV,
      })
    } else {
      logger.debug('RESEND_API_KEY validated', {
        prefix: apiKeyPrefix,
        length: apiKeyLength,
        env: process.env.NODE_ENV,
      })
    }
    
    // Log API key presence (without exposing the key itself)
    logger.info('Resend client initialized', {
      apiKeyPresent: true,
      apiKeyPrefix: apiKeyPrefix,
      apiKeyLength: apiKeyLength,
      env: process.env.NODE_ENV,
    })
  } else if (isTestEnv) {
    logger.debug('Resend client initialized (test mode)', {
      apiKeyPresent: false,
      env: process.env.NODE_ENV,
    })
  }
  
  // Use test key in test environment, otherwise use the actual API key
  // Tests should mock this module, but we provide a fallback to prevent import errors
  resendInstance = new Resend(apiKey || (isTestEnv ? 'test-key' : ''))
  
  return resendInstance
}

