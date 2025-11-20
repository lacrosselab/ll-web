import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { sendBroadcastToAudience } from '@/lib/email/service'
import { logger } from '@/lib/utils'
import { randomUUID } from 'crypto'

interface BroadcastRequest {
  subject: string
  bodyText: string
}

export async function POST(request: NextRequest) {
  const traceId = randomUUID()
  logger.info('broadcast.init', { traceId })
  
  // Check feature flag early
  if (process.env.ENABLE_BROADCAST_FEATURE !== 'true') {
    logger.warn('broadcast.feature_disabled', { traceId })
    return NextResponse.json(
      { error: 'Broadcast feature is disabled. Set ENABLE_BROADCAST_FEATURE=true to enable.' },
      { status: 503 }
    )
  }
  
  try {
    const supabase = await getSupabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (!user.email?.endsWith('@thelacrosselab.com')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body: BroadcastRequest = await request.json()
    const { subject, bodyText } = body

    if (!subject || !bodyText) {
      return NextResponse.json(
        { error: 'Subject and body text are required' },
        { status: 400 }
      )
    }

    logger.info('broadcast.start', {
      subject,
      traceId,
    })

    // Send broadcast to Resend audience
    const result = await sendBroadcastToAudience({
      audienceId: 'default',
      subject,
      bodyText,
      context: { traceId },
    })

    return NextResponse.json({
      success: true,
      broadcastId: result.broadcastId,
      message: 'Broadcast sent to all users in Resend audience',
    })
  } catch (error) {
    logger.error('broadcast.error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      traceId,
    })
    return NextResponse.json(
      { error: 'Failed to send broadcast email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

