import { NextRequest, NextResponse } from 'next/server'
import { getResend } from '@/lib/email/resend-client'
import { RESEND_AUDIENCE_ID } from '@/lib/email/service'
import { getSupabaseServer } from '@/lib/supabase/server'
import { logger } from '@/lib/utils'
import { randomUUID } from 'crypto'

export async function GET(request: NextRequest) {
  const traceId = randomUUID()
  logger.info('list_contacts.init', { traceId })
  
  try {
    const supabase = await getSupabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.warn('list_contacts.unauthorized', { traceId })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('list_contacts.calling_api', { traceId })

    const resend = getResend()
    const response = await resend.contacts.list({
      audienceId: RESEND_AUDIENCE_ID,
    })

    logger.info('list_contacts.success', {
      traceId,
      hasData: !!response.data,
      hasError: !!response.error,
    })

    return NextResponse.json({
      success: true,
      data: response.data,
      error: response.error,
      traceId,
    })
  } catch (error) {
    const errorDetails = error instanceof Error ? {
      message: error.message,
      name: error.name,
      stack: error.stack,
    } : {
      type: typeof error,
      value: String(error),
    }
    
    logger.error('list_contacts.error', {
      traceId,
      error: errorDetails,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    })
    
    return NextResponse.json(
      { success: false, error: 'Failed to list contacts', details: errorDetails },
      { status: 500 }
    )
  }
}

