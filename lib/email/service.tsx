import React from 'react'
import { getResend } from './resend-client'
import { renderEmailTemplate, isValidEmail } from './utils'
import { PurchaseConfirmationEmail } from '@/emails/purchase-confirmation'
import { BroadcastEmail } from '@/emails/broadcast-template'
import { logger, maskEmail } from '@/lib/utils'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@thelacrosselab.com'

/**
 * Type for Resend email send response
 * Resend SDK v4.0.0 returns { data: { id: string } | null, error: any }
 */
type ResendEmailResponse = {
  data: { id: string } | null
  error: any
}

/**
 * Retry configuration for email sends
 */
interface RetryOptions {
  attempts: number
  baseDelayMs: number
  timeoutMs: number
}

/**
 * Send email with retry and exponential backoff
 */
async function sendWithRetry(
  email: string,
  payload: Parameters<Awaited<ReturnType<typeof getResend>>['emails']['send']>[0],
  options: RetryOptions,
  context?: { traceId?: string }
): Promise<void> {
  const { attempts, baseDelayMs, timeoutMs } = options
  
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const resend = getResend()
      
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Email send timeout')), timeoutMs)
      })
      
      // Race the send against timeout
      const sendPromise = resend.emails.send(payload)
      const response = await Promise.race([
        sendPromise,
        timeoutPromise,
      ]) as ResendEmailResponse
      
      // Check response object for errors (Resend SDK returns { data, error })
      if (response.error) {
        const errorMessage = response.error instanceof Error 
          ? response.error.message 
          : typeof response.error === 'string' 
            ? response.error 
            : JSON.stringify(response.error)
        
        const isLastAttempt = attempt === attempts
        
        if (isLastAttempt) {
          throw new Error(`Resend API error: ${errorMessage}`)
        }
        
        // Calculate exponential backoff delay
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1)
        
        logger.warn('Email send retry', {
          to: maskEmail(email),
          attempt,
          reason: `Resend API error: ${errorMessage}`,
          nextDelayMs: delayMs,
          traceId: context?.traceId,
        })
        
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        continue
      }
      
      // Validate that we have data (email ID) indicating success
      if (!response.data || !response.data.id) {
        const isLastAttempt = attempt === attempts
        
        if (isLastAttempt) {
          throw new Error('Response missing email ID')
        }
        
        // Calculate exponential backoff delay
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1)
        
        logger.warn('Email send retry', {
          to: maskEmail(email),
          attempt,
          reason: 'Response missing email ID',
          responseData: response.data,
          nextDelayMs: delayMs,
          traceId: context?.traceId,
        })
        
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        continue
      }
      
      // Success - log email ID for debugging
      logger.debug('Email send success', {
        to: maskEmail(email),
        emailId: response.data.id,
        attempt,
        traceId: context?.traceId,
      })
      
      return // Success
    } catch (error) {
      const isLastAttempt = attempt === attempts
      
      if (isLastAttempt) {
        throw error
      }
      
      // Calculate exponential backoff delay
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1)
      
      logger.warn('Email send retry', {
        to: maskEmail(email),
        attempt,
        reason: error instanceof Error ? error.message : 'Unknown error',
        nextDelayMs: delayMs,
        traceId: context?.traceId,
      })
      
      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  
  throw new Error('All retry attempts exhausted')
}

/**
 * Add or update a contact in Resend
 */
export async function addContactToResend(
  email: string,
  context?: { traceId?: string }
): Promise<void> {
  try {
    const resend = getResend()
    await resend.contacts.create({
      email,
      audienceId: 'default',
    })
    logger.debug('contact.added', {
      to: maskEmail(email),
      traceId: context?.traceId,
    })
  } catch (error) {
    // If contact already exists, that's fine - Resend will update it
    if (error instanceof Error && error.message.includes('already exists')) {
      logger.debug('contact.exists', {
        to: maskEmail(email),
        traceId: context?.traceId,
      })
      return
    }
    logger.error('contact.add_failed', {
      to: maskEmail(email),
      error: error instanceof Error ? error.message : 'Unknown error',
      traceId: context?.traceId,
    })
    // Don't throw - email failures shouldn't block signup
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
    sessionDate: string
    sessionTime?: string
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
 * Send a broadcast email to multiple recipients
 */
export async function sendBroadcastEmail(data: {
  to: string[]
  subject: string
  bodyText: string
  context?: { traceId?: string }
}): Promise<{ sent: number; failed: number }> {
  const { context } = data
  
  // Filter and validate email addresses
  const validEmails = data.to.filter(email => isValidEmail(email))
  const invalidCount = data.to.length - validEmails.length
  
  if (invalidCount > 0) {
    logger.warn('broadcast.validation', {
      invalidCount,
      totalCount: data.to.length,
      traceId: context?.traceId,
    })
  }
  
  if (validEmails.length === 0) {
    logger.warn('broadcast.no_valid_recipients', {
      totalCount: data.to.length,
      traceId: context?.traceId,
    })
    return { sent: 0, failed: 0 }
  }
  
  let sent = 0
  let failed = 0
  
  // Resend has rate limits, so we'll batch send
  const BATCH_SIZE = 10 // Adjust based on Resend rate limits
  const totalRecipients = validEmails.length
  const batches = Math.ceil(totalRecipients / BATCH_SIZE)
  
  // Render template once before batch sending
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
    return { sent: 0, failed: totalRecipients }
  }
  
  // Send in batches
  for (let i = 0; i < validEmails.length; i += BATCH_SIZE) {
    const batch = validEmails.slice(i, i + BATCH_SIZE)
    const batchIndex = Math.floor(i / BATCH_SIZE) + 1
    const batchStartTime = Date.now()
    let sentInBatch = 0
    let failedInBatch = 0
    
    logger.info('broadcast.batch.start', {
      batchIndex,
      size: batch.length,
      traceId: context?.traceId,
    })
    
    // Send to batch with retry
    const promises = batch.map(async (email) => {
      try {
        const resend = getResend()
        await sendWithRetry(
          email,
          {
            from: FROM_EMAIL,
            to: email,
            subject: data.subject,
            html,
          },
          {
            attempts: 3,
            baseDelayMs: 300,
            timeoutMs: 8000,
          },
          context
        )
        sentInBatch++
        sent++
      } catch (error) {
        failedInBatch++
        failed++
        logger.error('broadcast.send_failed', {
          to: maskEmail(email),
          subject: data.subject,
          batchIndex,
          error: error instanceof Error ? error.message : 'Unknown error',
          traceId: context?.traceId,
        })
      }
    })
    
    await Promise.all(promises)
    
    const batchDurationMs = Date.now() - batchStartTime
    
    logger.info('broadcast.batch.done', {
      batchIndex,
      sentInBatch,
      failedInBatch,
      durationMs: batchDurationMs,
      traceId: context?.traceId,
    })
    
    // Rate limiting: wait between batches
    if (i + BATCH_SIZE < validEmails.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000)) // 1 second delay
    }
  }
  
  logger.info('broadcast.done', {
    totalRecipients,
    sent,
    failed,
    batches,
    traceId: context?.traceId,
  })
  
  return { sent, failed }
}
