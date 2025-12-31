// Backfill script to add existing users to Resend audience
// Run this with: node scripts/backfill-resend-audience.js
//
// This script is idempotent - safe to run multiple times.
// It will skip users that are already in the audience.
//
// Required environment variables:
//   NEXT_PUBLIC_SUPABASE_URL - Supabase project URL
//   SUPABASE_SECRET_KEY - Supabase service role key
//   RESEND_API_KEY - Resend API key
//   RESEND_AUDIENCE_ID - Resend audience UUID

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// Simple logger for script
const logger = {
  info: (msg, data) => console.log(`[INFO] ${msg}`, data ? JSON.stringify(data) : ''),
  warn: (msg, data) => console.warn(`[WARN] ${msg}`, data ? JSON.stringify(data) : ''),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, data ? JSON.stringify(data) : ''),
  debug: (msg, data) => console.log(`[DEBUG] ${msg}`, data ? JSON.stringify(data) : ''),
}

const maskEmail = (email) => {
  if (!email) return '[no email]'
  const [local, domain] = email.split('@')
  if (!domain) return email
  return `${local.slice(0, 2)}***@${domain}`
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY
const resendApiKey = process.env.RESEND_API_KEY
const audienceId = process.env.RESEND_AUDIENCE_ID

if (!supabaseUrl || !supabaseServiceKey) {
  logger.error('backfill.missing_env_vars', {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseSecretKey: !!process.env.SUPABASE_SECRET_KEY,
  })
  process.exit(1)
}

if (!resendApiKey) {
  logger.error('backfill.missing_resend_api_key')
  process.exit(1)
}

if (!audienceId) {
  logger.error('backfill.missing_audience_id', {
    message: 'Please set RESEND_AUDIENCE_ID environment variable to your Resend audience UUID.',
    example: 'RESEND_AUDIENCE_ID=43a6084d-7071-46dd-8eae-357f96ed66f0',
  })
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const resend = new Resend(resendApiKey)

/**
 * Add a contact to Resend audience
 */
async function addContactToAudience(email) {
  try {
    const response = await resend.contacts.create({
      email,
      unsubscribed: false,
      audienceId,
    })

    if (response.error) {
      const errorMessage = response.error.message || response.error.toString()
      // If contact already exists, that's fine
      if (errorMessage.includes('already exists') || errorMessage.includes('already_exist')) {
        return { success: true, error: null, skipped: true }
      }
      return { success: false, error: errorMessage }
    }

    return { success: true, error: null, contactId: response.data?.id }
  } catch (error) {
    // If contact already exists, that's fine
    if (error.message && (error.message.includes('already') || error.message.includes('exists'))) {
      return { success: true, error: null, skipped: true }
    }
    return { success: false, error: error.message || 'Unknown error' }
  }
}

async function backfillResendAudience() {
  try {
    logger.info('backfill.start', { audienceId })

    // Get all users from database
    logger.info('backfill.fetching_users')
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, created_at')
      .order('created_at', { ascending: true })

    if (usersError) {
      logger.error('backfill.fetch_users_failed', {
        error: usersError.message,
      })
      process.exit(1)
    }

    if (!users || users.length === 0) {
      logger.info('backfill.no_users')
      return
    }

    logger.info('backfill.users_found', {
      count: users.length,
    })

    let added = 0
    let skipped = 0
    let failed = 0
    const errors = []

    // Process users in batches to avoid rate limits
    const BATCH_SIZE = 10
    const DELAY_MS = 1000 // 1 second delay between batches

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(users.length / BATCH_SIZE)

      logger.info('backfill.batch_start', {
        batchNum,
        totalBatches,
        batchSize: batch.length,
      })

      const batchPromises = batch.map(async (user) => {
        if (!user.email) {
          logger.warn('backfill.skip_no_email', {
            userId: user.id,
          })
          skipped++
          return
        }

        const result = await addContactToAudience(user.email)

        if (result.success) {
          if (result.skipped) {
            skipped++
            logger.debug('backfill.already_in_audience', {
              email: maskEmail(user.email),
            })
          } else {
            added++
            logger.debug('backfill.added_to_audience', {
              email: maskEmail(user.email),
              contactId: result.contactId,
            })
          }
        } else {
          failed++
          const errorMsg = `Failed to add ${maskEmail(user.email)}: ${result.error}`
          errors.push(errorMsg)
          logger.error('backfill.add_failed', {
            email: maskEmail(user.email),
            error: result.error,
          })
        }
      })

      await Promise.all(batchPromises)

      // Wait between batches to respect rate limits
      if (i + BATCH_SIZE < users.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS))
      }
    }

    logger.info('backfill.summary', {
      added,
      skipped,
      failed,
      total: users.length,
    })

    if (errors.length > 0) {
      logger.warn('backfill.errors_encountered', {
        errorCount: errors.length,
        errors: errors.slice(0, 10), // Limit to first 10 errors to avoid huge logs
      })
    }

    if (failed === 0) {
      logger.info('backfill.completed_successfully', {
        added,
        skipped,
        total: users.length,
      })
    } else {
      logger.error('backfill.completed_with_errors', {
        added,
        skipped,
        failed,
        total: users.length,
      })
      process.exit(1)
    }
  } catch (error) {
    logger.error('backfill.fatal_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })
    process.exit(1)
  }
}

backfillResendAudience()
