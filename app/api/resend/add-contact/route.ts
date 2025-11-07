import { NextRequest, NextResponse } from 'next/server'
import { addContactToResend } from '@/lib/email/service'
import { getSupabaseServer } from '@/lib/supabase/server'
import { logger, maskEmail } from '@/lib/utils'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const traceId = randomUUID()
  logger.info('add_contact.init', { traceId })
  
  try {
    const supabase = await getSupabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.warn('add_contact.unauthorized', { traceId })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email } = await request.json()

    if (!email) {
      logger.warn('add_contact.validation_failed', { reason: 'Email is required', traceId })
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Add contact to Resend (non-blocking)
    await addContactToResend(email, { traceId })

    logger.info('add_contact.success', { to: maskEmail(email), traceId })
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('add_contact.error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      traceId,
    })
    // Don't fail the request if Resend fails
    return NextResponse.json({ success: false, error: 'Failed to add contact' }, { status: 500 })
  }
}

