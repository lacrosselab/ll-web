// Backfill script to add existing users to Resend segment
// Run this with: node scripts/backfill-resend-audience.js
//
// This script is idempotent - safe to run multiple times.
// It will skip users that are already in the segment.

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { logger, maskEmail } from '@/lib/utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY
const resendApiKey = process.env.RESEND_API_KEY
const fromEmail = process.env.RESEND_FROM_EMAIL || 'hello@experimentlacrosse.com'

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

const segmentId = process.env.RESEND_SEGMENT_ID

if (!segmentId) {
  logger.error('backfill.missing_segment_id', {
    message: 'Please set RESEND_SEGMENT_ID environment variable to your Resend segment UUID. You can find this in your Resend dashboard under Audiences/Segments.',
    example: 'RESEND_SEGMENT_ID=43a6084d-7071-46dd-8eae-357f96ed66f0',
  })
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const resend = new Resend(resendApiKey)
const SEGMENT_ID = segmentId

/**
 * Add a contact to Resend segment
 */
async function addContactToResend(email) {
  try {
    const segmentResponse = await resend.contacts.segments.add({
      email,
      segmentId: SEGMENT_ID,
    })
    
    if (segmentResponse.error) {
      // If contact is already in segment, that's fine
      const errorMessage = segmentResponse.error.message || segmentResponse.error.toString()
      if (errorMessage.includes('already') || errorMessage.includes('exists')) {
        return { success: true, error: null, skipped: true }
      }
      return { success: false, error: errorMessage }
    }
    
    return { success: true, error: null }
  } catch (error) {
    // If contact is already in segment, that's fine
    if (error.message && (error.message.includes('already') || error.message.includes('exists'))) {
      return { success: true, error: null, skipped: true }
    }
    return { success: false, error: error.message || 'Unknown error' }
  }
}

async function backfillResendAudience() {
  try {
    logger.info('backfill.start')
    
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

        const result = await addContactToResend(user.email)
        
        if (result.success) {
          if (result.skipped) {
            skipped++
            logger.debug('backfill.already_in_segment', {
              email: maskEmail(user.email),
            })
          } else {
            added++
            logger.debug('backfill.added_to_segment', {
              email: maskEmail(user.email),
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

