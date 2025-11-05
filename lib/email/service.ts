import React from 'react'
import { resend } from './resend-client'
import { renderEmailTemplate } from './utils'
import { PurchaseConfirmationEmail } from '@/emails/purchase-confirmation'
import { BroadcastEmail } from '@/emails/broadcast-template'
import { logger } from '@/lib/utils'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@thelacrosselab.com'

/**
 * Add or update a contact in Resend
 */
export async function addContactToResend(
  email: string,
  name?: string
): Promise<void> {
  try {
    await resend.contacts.create({
      email,
      firstName: name?.split(' ')[0],
      lastName: name?.includes(' ') ? name.split(' ').slice(1).join(' ') : undefined,
    })
    logger.debug(`Added contact to Resend: ${email}`)
  } catch (error) {
    // If contact already exists, that's fine - Resend will update it
    if (error instanceof Error && error.message.includes('already exists')) {
      logger.debug(`Contact already exists in Resend: ${email}`)
      return
    }
    logger.error(`Error adding contact to Resend: ${email}`, error)
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
}): Promise<void> {
  try {
    const html = renderEmailTemplate(
      <PurchaseConfirmationEmail
        orderNumber={data.orderNumber}
        orderDate={data.orderDate}
        customerName={data.customerName}
        items={data.items}
        totalAmountCents={data.totalAmountCents}
        currency={data.currency}
      />
    )

    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject: `Order Confirmation - ${data.orderNumber}`,
      html,
    })

    logger.debug(`Sent purchase confirmation email to: ${data.to}`)
  } catch (error) {
    logger.error(`Error sending purchase confirmation email to: ${data.to}`, error)
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
}): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  // Resend has rate limits, so we'll batch send
  const BATCH_SIZE = 10 // Adjust based on Resend rate limits

  for (let i = 0; i < data.to.length; i += BATCH_SIZE) {
    const batch = data.to.slice(i, i + BATCH_SIZE)
    
    try {
      const html = renderEmailTemplate(
        <BroadcastEmail
          subject={data.subject}
          bodyText={data.bodyText}
          preview={data.subject}
        />
      )

      // Send to batch
      const promises = batch.map(async (email) => {
        try {
          await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: data.subject,
            html,
          })
          sent++
          logger.debug(`Sent broadcast email to: ${email}`)
        } catch (error) {
          failed++
          logger.error(`Error sending broadcast email to: ${email}`, error)
        }
      })

      await Promise.all(promises)

      // Rate limiting: wait between batches
      if (i + BATCH_SIZE < data.to.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000)) // 1 second delay
      }
    } catch (error) {
      logger.error(`Error processing broadcast batch`, error)
      failed += batch.length
    }
  }

  return { sent, failed }
}

