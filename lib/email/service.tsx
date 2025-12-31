import React from 'react'
import { Resend } from 'resend'
import { validate as uuidValidate } from 'uuid'
import { getResend } from './resend-client'
import { renderEmailTemplate } from './utils'
import { PurchaseConfirmationEmail } from '@/emails/purchase-confirmation'
import { BroadcastEmail } from '@/emails/broadcast-template'
import { logger, maskEmail } from '@/lib/utils'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'hello@thelacrosselab.com'

// Audience ID from environment variable - used for both contacts and broadcasts
export const RESEND_AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID || ''

// Validate audience ID at startup if set
if (RESEND_AUDIENCE_ID && !uuidValidate(RESEND_AUDIENCE_ID)) {
  throw new Error(`Invalid RESEND_AUDIENCE_ID: "${RESEND_AUDIENCE_ID}" is not a valid UUID`)
}

/**
 * Type for Resend email send response
 * Resend SDK v4.0.0 returns { data: { id: string } | null, error: any }
 */
type ResendEmailResponse = {
  data: { id: string } | null
  error: any
}

/**
 * Add contact to Resend audience
 * Creates a contact in the audience specified by RESEND_AUDIENCE_ID
 */
export async function addContactToResend(
  email: string,
  context?: { traceId?: string }
): Promise<void> {
  // Check feature flag - graceful degradation if disabled
  if (process.env.ENABLE_RESEND_CONTACT_ADDITION !== 'true') {
    logger.debug('contact.add_disabled', {
      to: maskEmail(email),
      traceId: context?.traceId,
      reason: 'ENABLE_RESEND_CONTACT_ADDITION feature flag is not enabled',
    })
    return
  }

  // Validate audience ID is configured
  if (!RESEND_AUDIENCE_ID) {
    logger.warn('contact.add_skipped', {
      to: maskEmail(email),
      traceId: context?.traceId,
      reason: 'RESEND_AUDIENCE_ID environment variable is not set',
    })
    return
  }

  logger.info('contact.add_init', {
    to: maskEmail(email),
    traceId: context?.traceId,
  })

  try {
    const resend = getResend()

    // Create contact in audience
    const createResponse = await resend.contacts.create({
      email,
      unsubscribed: false,
      audienceId: RESEND_AUDIENCE_ID,
    })

    if (createResponse.error) {
      const errorMessage = createResponse.error.message || createResponse.error.toString()

      // Contact already exists is fine - they're already in the audience
      if (errorMessage.includes('already exists') || errorMessage.includes('already_exist')) {
        logger.info('contact.already_exists', {
          to: maskEmail(email),
          traceId: context?.traceId,
        })
        return
      }

      logger.error('contact.create_failed', {
        to: maskEmail(email),
        error: errorMessage,
        traceId: context?.traceId,
      })
      return
    }

    logger.info('contact.created', {
      to: maskEmail(email),
      contactId: createResponse.data?.id,
      traceId: context?.traceId,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Contact already exists is fine
    if (errorMessage.includes('already') || errorMessage.includes('exists')) {
      logger.info('contact.already_exists', {
        to: maskEmail(email),
        traceId: context?.traceId,
      })
      return
    }

    logger.error('contact.add_failed', {
      to: maskEmail(email),
      error: errorMessage,
      traceId: context?.traceId,
    })
    // Don't throw - email failures shouldn't block signup or purchase
  }
}

/**
 * Send a purchase confirmation email
 */
export async function sendPurchaseConfirmation(data: {
  to: string
  customerName?: string
  orderNumber: string
  orderDate: string
  items: Array<{
    productName: string
    athleteName: string
    quantity: number
    unitPriceCents: number
    sessionDate?: string // Legacy field, kept for backward compatibility
    sessionTime?: string // Legacy field, kept for backward compatibility
    sessions?: Array<{ session_date: string; session_time: string }> // New field for multiple sessions
    gender?: string | null
    minGrade?: string | null
    maxGrade?: string | null
    skillLevel?: string | null
    location?: string
  }>
  totalAmountCents: number
  currency?: string
  context?: { traceId?: string }
}): Promise<void> {
  const { context } = data

  // Validate inputs
  if (!data.to || typeof data.to !== 'string' || data.to.trim().length === 0) {
    logger.warn('purchase_confirmation.validation_failed', {
      reason: 'Invalid or empty email address',
      traceId: context?.traceId,
    })
    return
  }

  if (!data.orderNumber || !data.orderDate) {
    logger.warn('purchase_confirmation.validation_failed', {
      reason: 'Missing orderNumber or orderDate',
      traceId: context?.traceId,
    })
    return
  }

  if (!data.items || data.items.length === 0) {
    logger.warn('purchase_confirmation.validation_failed', {
      reason: 'Items array is empty',
      traceId: context?.traceId,
    })
    return
  }

  let html: string
  const subject = `Order Confirmation - ${data.orderNumber}`

  // Render template with separate try/catch
  try {
    html = await renderEmailTemplate(
      <PurchaseConfirmationEmail
        orderNumber={data.orderNumber}
        orderDate={data.orderDate}
        customerName={data.customerName}
        items={data.items}
        totalAmountCents={data.totalAmountCents}
        currency={data.currency}
      />
    )

    logger.debug('purchase_confirmation.render_ok', {
      to: maskEmail(data.to),
      subject,
      traceId: context?.traceId,
    })
  } catch (error) {
    logger.error('purchase_confirmation.render_failed', {
      to: maskEmail(data.to),
      templateName: 'PurchaseConfirmationEmail',
      error: error instanceof Error ? error.message : 'Unknown error',
      traceId: context?.traceId,
    })
    return
  }

  // Send email with separate try/catch
  try {
    const resend = getResend()
    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject,
      html,
    }) as ResendEmailResponse

    // Check response object for errors (Resend SDK returns { data, error })
    if (response.error) {
      logger.error('purchase_confirmation.send_failed', {
        to: maskEmail(data.to),
        subject,
        error: response.error instanceof Error
          ? response.error.message
          : typeof response.error === 'string'
            ? response.error
            : JSON.stringify(response.error),
        responseError: response.error,
        traceId: context?.traceId,
      })
      // Don't throw - email failures shouldn't block payment processing
      return
    }

    // Validate that we have data (email ID) indicating success
    if (!response.data || !response.data.id) {
      logger.error('purchase_confirmation.send_failed', {
        to: maskEmail(data.to),
        subject,
        error: 'Response missing email ID',
        responseData: response.data,
        traceId: context?.traceId,
      })
      // Don't throw - email failures shouldn't block payment processing
      return
    }

    logger.info('purchase_confirmation.send_ok', {
      to: maskEmail(data.to),
      subject,
      emailId: response.data.id,
      traceId: context?.traceId,
    })
  } catch (error) {
    logger.error('purchase_confirmation.send_failed', {
      to: maskEmail(data.to),
      subject,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      traceId: context?.traceId,
    })
    // Don't throw - email failures shouldn't block payment processing
  }
}

/**
 * Send a broadcast email to Resend audience using Broadcasts API
 */
export async function sendBroadcastToAudience(data: {
  audienceId?: string // Optional - uses RESEND_AUDIENCE_ID if not provided or 'default'
  subject: string
  bodyText: string
  context?: { traceId?: string }
}): Promise<{ broadcastId: string }> {
  const { context } = data

  // Check feature flag - throw error if disabled
  if (process.env.ENABLE_BROADCAST_FEATURE !== 'true') {
    logger.error('broadcast.disabled', {
      subject: data.subject,
      traceId: context?.traceId,
      reason: 'ENABLE_BROADCAST_FEATURE feature flag is not enabled',
    })
    throw new Error('Broadcast feature is disabled. Set ENABLE_BROADCAST_FEATURE=true to enable.')
  }

  // Determine audience ID to use
  const audienceId = (data.audienceId && data.audienceId !== 'default')
    ? data.audienceId
    : RESEND_AUDIENCE_ID

  if (!audienceId) {
    logger.error('broadcast.no_audience_id', {
      subject: data.subject,
      traceId: context?.traceId,
    })
    throw new Error('RESEND_AUDIENCE_ID environment variable is not set')
  }

  // Validate audience ID is a valid UUID
  if (!uuidValidate(audienceId)) {
    logger.error('broadcast.invalid_audience_id', {
      subject: data.subject,
      audienceId,
      traceId: context?.traceId,
    })
    throw new Error(`Invalid audience ID: "${audienceId}" is not a valid UUID`)
  }

  // Render email template
  let html: string
  try {
    html = await renderEmailTemplate(
      <BroadcastEmail
        subject={data.subject}
        bodyText={data.bodyText}
        preview={data.subject}
      />
    )

    logger.debug('broadcast.render_ok', {
      subject: data.subject,
      traceId: context?.traceId,
    })
  } catch (error) {
    logger.error('broadcast.render_failed', {
      templateName: 'BroadcastEmail',
      subject: data.subject,
      error: error instanceof Error ? error.message : 'Unknown error',
      traceId: context?.traceId,
    })
    throw new Error('Failed to render email template')
  }

  try {
    const resend = getResend()

    // Create broadcast with a small delay to avoid rate limits
    // Resend allows only 2 requests per second
    await new Promise(resolve => setTimeout(resolve, 500))

    // Create broadcast
    const createResponse = await resend.broadcasts.create({
      audienceId,
      from: FROM_EMAIL,
      subject: data.subject,
      html,
    }) as { data: { id: string } | null; error: any }

    if (createResponse.error) {
      logger.error('broadcast.create_failed', {
        subject: data.subject,
        audienceId,
        error: createResponse.error,
        traceId: context?.traceId,
      })
      throw new Error(`Failed to create broadcast: ${createResponse.error}`)
    }

    if (!createResponse.data?.id) {
      logger.error('broadcast.create_no_id', {
        subject: data.subject,
        audienceId,
        traceId: context?.traceId,
      })
      throw new Error('Broadcast created but no ID returned')
    }

    const broadcastId = createResponse.data.id

    // Send broadcast
    const sendResponse = await resend.broadcasts.send(broadcastId) as { data: any; error: any }

    if (sendResponse.error) {
      logger.error('broadcast.send_failed', {
        broadcastId,
        subject: data.subject,
        audienceId,
        error: sendResponse.error,
        traceId: context?.traceId,
      })
      throw new Error(`Failed to send broadcast: ${sendResponse.error}`)
    }

    logger.info('broadcast.sent', {
      broadcastId,
      subject: data.subject,
      audienceId,
      traceId: context?.traceId,
    })

    return { broadcastId }
  } catch (error) {
    logger.error('broadcast.error', {
      subject: data.subject,
      audienceId,
      error: error instanceof Error ? error.message : 'Unknown error',
      traceId: context?.traceId,
    })
    throw error
  }
}
