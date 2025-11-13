// Backfill script to add existing users to Resend audience
// Run this with: node scripts/backfill-resend-audience.js
//
// This script is idempotent - safe to run multiple times.
// It will skip users that already exist in Resend.

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY
const resendApiKey = process.env.RESEND_API_KEY
const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@thelacrosselab.com'

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:')
  console.error('- NEXT_PUBLIC_SUPABASE_URL:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.error('- SUPABASE_SECRET_KEY:', !!process.env.SUPABASE_SECRET_KEY)
  process.exit(1)
}

if (!resendApiKey) {
  console.error('❌ Missing environment variable: RESEND_API_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const resend = new Resend(resendApiKey)

// Get audience ID from environment variable or use 'default' (which will need to be resolved)
const AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID || 'default'

if (AUDIENCE_ID === 'default') {
  console.warn('⚠️  RESEND_AUDIENCE_ID not set. Using "default" which may not work.')
  console.warn('   Please set RESEND_AUDIENCE_ID environment variable to your Resend audience UUID.')
  console.warn('   You can find this in your Resend dashboard under Audiences.\n')
}

/**
 * Add a contact to Resend audience
 */
async function addContactToResend(email) {
  try {
    await resend.contacts.create({
      email,
      audienceId: AUDIENCE_ID,
    })
    return { success: true, error: null }
  } catch (error) {
    // If contact already exists, that's fine
    if (error.message && error.message.includes('already exists')) {
      return { success: true, error: null, skipped: true }
    }
    return { success: false, error: error.message || 'Unknown error' }
  }
}

async function backfillResendAudience() {
  try {
    console.log('🚀 Starting Resend audience backfill...\n')
    
    // Get all users from database
    console.log('📡 Fetching users from database...')
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, created_at')
      .order('created_at', { ascending: true })

    if (usersError) {
      console.error('❌ Error fetching users:', usersError.message)
      process.exit(1)
    }

    if (!users || users.length === 0) {
      console.log('ℹ️  No users found in database')
      return
    }

    console.log(`📊 Found ${users.length} users in database\n`)

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

      console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} users)...`)

      const batchPromises = batch.map(async (user) => {
        if (!user.email) {
          console.log(`  ⚠️  Skipping user ${user.id} - no email`)
          skipped++
          return
        }

        const result = await addContactToResend(user.email)
        
        if (result.success) {
          if (result.skipped) {
            skipped++
            console.log(`  ✓ ${user.email} (already exists)`)
          } else {
            added++
            console.log(`  ✓ ${user.email} (added)`)
          }
        } else {
          failed++
          const errorMsg = `Failed to add ${user.email}: ${result.error}`
          errors.push(errorMsg)
          console.log(`  ✗ ${errorMsg}`)
        }
      })

      await Promise.all(batchPromises)

      // Wait between batches to respect rate limits
      if (i + BATCH_SIZE < users.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS))
      }
    }

    console.log('\n📊 Summary:')
    console.log(`  ✅ Added: ${added}`)
    console.log(`  ⏭️  Skipped (already exists): ${skipped}`)
    console.log(`  ❌ Failed: ${failed}`)
    console.log(`  📧 Total processed: ${users.length}`)

    if (errors.length > 0) {
      console.log('\n⚠️  Errors encountered:')
      errors.forEach(error => console.log(`  - ${error}`))
    }

    if (failed === 0) {
      console.log('\n✅ Backfill completed successfully!')
    } else {
      console.log(`\n⚠️  Backfill completed with ${failed} errors`)
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Fatal error:', error.message)
    console.error('Stack:', error.stack)
    process.exit(1)
  }
}

backfillResendAudience()

