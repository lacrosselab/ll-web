import { NextRequest, NextResponse } from 'next/server'
import { getResend } from '@/lib/email/resend-client'
import { RESEND_AUDIENCE_ID } from '@/lib/email/service'
import { getSupabaseServer } from '@/lib/supabase/server'
import { logger, maskEmail } from '@/lib/utils'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const traceId = randomUUID()
  logger.info('add_contact.init', { traceId })
  
  try {
    // Log request details
    const requestBody = await request.json().catch(() => ({}))
    logger.debug('add_contact.request_received', {
      traceId,
      requestBody: {
        email: requestBody.email ? maskEmail(requestBody.email) : undefined,
        hasEmail: !!requestBody.email,
        bodyKeys: Object.keys(requestBody),
      },
    })

    const supabase = await getSupabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    // Log authentication details
    logger.debug('add_contact.auth_check', {
      traceId,
      hasUser: !!user,
      userEmail: user?.email ? maskEmail(user.email) : undefined,
      userId: user?.id,
      authError: authError ? {
        message: authError.message,
        status: authError.status,
      } : null,
    })
    
    if (authError || !user) {
      logger.warn('add_contact.unauthorized', {
        traceId,
        authError: authError ? {
          message: authError.message,
          status: authError.status,
        } : null,
        hasUser: !!user,
      })
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      logger.debug('add_contact.response', {
        traceId,
        status: 401,
        responseBody: { error: 'Unauthorized' },
      })
      return response
    }

    const { email } = requestBody

    if (!email) {
      logger.warn('add_contact.validation_failed', {
        reason: 'Email is required',
        traceId,
        requestBody: Object.keys(requestBody),
      })
      const response = NextResponse.json({ error: 'Email is required' }, { status: 400 })
      logger.debug('add_contact.response', {
        traceId,
        status: 400,
        responseBody: { error: 'Email is required' },
      })
      return response
    }

    logger.info('add_contact.calling_api', {
      to: maskEmail(email),
      traceId,
    })

    const resend = getResend()
    const response = await resend.contacts.create({
      audienceId: RESEND_AUDIENCE_ID,
      email,
      unsubscribed: false,
    })

    logger.info('add_contact.success', {
      to: maskEmail(email),
      traceId,
      hasData: !!response.data,
      hasError: !!response.error,
      contactId: response.data?.id,
    })

    return NextResponse.json({
      success: true,
      data: response.data,
      error: response.error,
      traceId,
    })
  } catch (error) {
    // Log complete error object with stack trace
    const errorDetails = error instanceof Error ? {
      message: error.message,
      name: error.name,
      stack: error.stack,
      cause: error.cause,
    } : {
      type: typeof error,
      value: String(error),
    }
    
    logger.error('add_contact.error', {
      traceId,
      error: errorDetails,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    })
    
    // Don't fail the request if Resend fails
    const response = NextResponse.json(
      { success: false, error: 'Failed to add contact' },
      { status: 500 }
    )
    logger.debug('add_contact.response', {
      traceId,
      status: 500,
      responseBody: { success: false, error: 'Failed to add contact' },
    })
    return response
  }
}

