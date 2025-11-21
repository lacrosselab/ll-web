import { NextRequest, NextResponse } from 'next/server'
import { getResend } from '@/lib/email/resend-client'
import { getSupabaseServer } from '@/lib/supabase/server'
import { logger } from '@/lib/utils'
import { randomUUID } from 'crypto'

export async function GET(request: NextRequest) {
  const traceId = randomUUID()
  logger.info('list_segments.init', { traceId })
  
  try {
    const supabase = await getSupabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.warn('list_segments.unauthorized', { traceId })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('list_segments.calling_api', { traceId })

    const resend = getResend()
    const resendAny = resend as any
    
    // Check if segments API exists
    if (!resendAny.segments || typeof resendAny.segments.list !== 'function') {
      logger.error('list_segments.api_not_available', {
        traceId,
        hasSegments: !!resendAny.segments,
        segmentsType: typeof resendAny.segments,
        segmentsKeys: resendAny.segments ? Object.keys(resendAny.segments) : [],
      })
      return NextResponse.json({
        success: false,
        error: 'Segments API not available',
        hasSegments: !!resendAny.segments,
        segmentsType: typeof resendAny.segments,
      }, { status: 500 })
    }

    const response = await resendAny.segments.list({
      limit: 10,
    })

    logger.info('list_segments.success', {
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
    
    logger.error('list_segments.error', {
      traceId,
      error: errorDetails,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    })
    
    return NextResponse.json(
      { success: false, error: 'Failed to list segments', details: errorDetails },
      { status: 500 }
    )
  }
}

