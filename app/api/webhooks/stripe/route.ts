import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { getSupabaseService } from "@/lib/supabase/service"
import type Stripe from "stripe"
import { logger } from '@/lib/utils'
import { sendPurchaseConfirmation, addContactToResend } from '@/lib/email/service'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const traceId = randomUUID()
  logger.info('webhook.init', { traceId, method: request.method })
  
  try {
    const body = await request.text()
    const signature = request.headers.get("stripe-signature")!

    logger.debug('webhook.request', {
      webhookSecretExists: !!process.env.STRIPE_WEBHOOK_SECRET,
      signatureExists: !!signature,
      bodyLength: body.length,
      traceId,
    })

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
      logger.debug('webhook.signature_verified', { traceId })
    } catch (err) {
      logger.error('webhook.signature_failed', { error: err instanceof Error ? err.message : 'Unknown error', traceId })
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    logger.debug('webhook.event', { eventType: event.type, eventId: event.id, traceId })

    const supabase = getSupabaseService()

    // Check webhook event idempotency at the start
    const { data: existingWebhookEvent, error: webhookEventError } = await supabase
      .from('webhook_events')
      .select('processed_at')
      .eq('stripe_event_id', event.id)
      .single()

    if (webhookEventError && webhookEventError.code !== 'PGRST116') {
      logger.error('webhook.event_check_failed', { error: webhookEventError.message, traceId })
      throw webhookEventError
    }

    // If event already processed, return early
    if (existingWebhookEvent?.processed_at) {
      logger.debug('webhook.event_already_processed', { eventId: event.id, traceId })
      return NextResponse.json({ received: true, message: 'Event already processed' })
    }

    // Upsert webhook event to mark as in-progress
    const { error: upsertWebhookError } = await supabase
      .from('webhook_events')
      .upsert({
        stripe_event_id: event.id,
        type: event.type,
        processed_at: null
      }, {
        onConflict: 'stripe_event_id'
      })

    if (upsertWebhookError) {
      logger.error('webhook.upsert_failed', { error: upsertWebhookError.message, traceId })
      throw upsertWebhookError
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        
          // For one-time payments, record the payment and process cart items
        if (session.payment_status === 'paid') {
          logger.debug('webhook.checkout_processing', { sessionId: session.id, traceId })
          
          // Get the customer to access its metadata
          const customer = await stripe.customers.retrieve(session.customer as string) as Stripe.Customer
          logger.debug('webhook.customer_retrieved', { traceId })
          
          // Get the payment intent to get more details
          const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string)
          logger.debug('webhook.payment_intent_retrieved', { traceId })
          
          // Record the payment - try multiple ways to get userId
          let userId = customer.metadata?.userId || session.metadata?.userId
          
          // If we still don't have userId, try to find it by email
          if (!userId && customer.email) {
            logger.debug('webhook.user_lookup_by_email', { traceId })
            const { data: userByEmail, error: emailError } = await supabase
              .from('users')
              .select('id')
              .eq('email', customer.email)
              .single()
            
            if (emailError && emailError.code !== 'PGRST116') {
              logger.error('webhook.user_lookup_failed', { error: emailError.message, traceId })
            } else if (userByEmail) {
              userId = userByEmail.id
              logger.debug('webhook.user_found', { traceId })
            }
          }
          
          if (!userId) {
            logger.error('webhook.user_id_missing', { traceId })
            throw new Error('Could not determine userId for payment processing')
          }
          
          logger.debug('webhook.user_id_resolved', { traceId })

          // Fetch line items from session
          logger.debug('webhook.fetching_line_items', { traceId })
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
          logger.debug('webhook.line_items_count', { count: lineItems.data.length, traceId })

          // Prepare line items data for RPC function
          const lineItemsData = []
          for (let i = 0; i < lineItems.data.length; i++) {
            const lineItem = lineItems.data[i]
            
            // Get athlete info from session metadata
            const athleteId = session.metadata?.[`athlete_${i}_id`]
            const productId = session.metadata?.[`athlete_${i}_product_id`]
            
            if (!athleteId) {
              logger.error('webhook.athlete_id_missing', { index: i, traceId })
              continue
            }

            // Find the product - try using productId from metadata first, then stripe_price_id
            let product
            let productError
            
            if (productId) {
              logger.debug('webhook.product_lookup_by_id', { index: i, traceId })
              const result = await supabase
                .from('products')
                .select('id, price_cents, stripe_price_id')
                .eq('id', productId)
                .single()
              product = result.data
              productError = result.error
            } else {
              logger.debug('webhook.product_lookup_by_price_id', { index: i, traceId })
              const result = await supabase
                .from('products')
                .select('id, price_cents, stripe_price_id')
                .eq('stripe_price_id', lineItem.price?.id)
                .single()
              product = result.data
              productError = result.error
            }

            if (productError || !product) {
              logger.error('webhook.product_lookup_failed', { index: i, error: productError?.message, traceId })
              continue
            }
            
            logger.debug('webhook.product_found', { index: i, traceId })

            lineItemsData.push({
              product_id: product.id,
              athlete_id: athleteId,
              quantity: lineItem.quantity || 1,
              unit_price_cents: product.price_cents
            })
          }

          if (lineItemsData.length === 0) {
            logger.error('webhook.no_line_items', { traceId })
            throw new Error('No valid line items found')
          }

          // Call RPC function to process payment in a transaction
          logger.debug('webhook.rpc_call', { traceId })
          const { data: paymentId, error: rpcError } = await supabase
            .rpc('process_payment_webhook', {
              p_stripe_payment_intent_id: paymentIntent.id,
              p_user_id: userId,
              p_amount: paymentIntent.amount,
              p_currency: paymentIntent.currency,
              p_line_items: lineItemsData
            })

          if (rpcError) {
            logger.error('webhook.rpc_failed', { error: rpcError.message, traceId })
            throw rpcError
          }

          logger.debug('webhook.payment_processed', { paymentId, traceId })

          // Update webhook_events.processed_at after successful transaction
          const { error: updateWebhookError } = await supabase
            .from('webhook_events')
            .update({ processed_at: new Date().toISOString() })
            .eq('stripe_event_id', event.id)

          if (updateWebhookError) {
            logger.error('webhook.update_processed_at_failed', { error: updateWebhookError.message, traceId })
            // Don't throw - transaction already committed
          }

          // Send purchase confirmation email (after transaction commit)
          // Check if email already sent using email_sent_at field
          try {
            // Get payment record to check email_sent_at
            const { data: payment, error: paymentFetchError } = await supabase
              .from('payments')
              .select('id, email_sent_at')
              .eq('stripe_payment_intent_id', paymentIntent.id)
              .single()

            if (paymentFetchError) {
              logger.error('webhook.payment_fetch_failed', { error: paymentFetchError.message, traceId })
            } else if (payment && !payment.email_sent_at) {
              // Email not sent yet, proceed with sending
              // Get user details
              const { data: userData, error: userError } = await supabase
                .from('users')
                .select('email, full_name')
                .eq('id', userId)
                .single()

              if (userError || !userData) {
                logger.error('webhook.user_fetch_failed', { error: userError?.message, traceId })
              } else {
                // Get payment details with athlete and product info
                const { data: paymentAthletes, error: paymentAthletesError } = await supabase
                  .from('payment_athletes')
                  .select(`
                    quantity,
                    unit_price_cents,
                    athlete:athletes (
                      id,
                      name
                    ),
                    product:products (
                      id,
                      name,
                      session_date,
                      session_time,
                      description,
                      gender,
                      min_grade,
                      max_grade,
                      skill_level,
                      product_sessions (
                        id,
                        session_date,
                        session_time,
                        location
                      )
                    )
                  `)
                  .eq('payment_id', payment.id)

                if (paymentAthletesError) {
                  logger.error('webhook.payment_details_fetch_failed', { error: paymentAthletesError.message, traceId })
                } else if (paymentAthletes && paymentAthletes.length > 0) {
                  // Format items for email
                  const emailItems = paymentAthletes.map((pa: any) => {
                    // Use product_sessions if available, otherwise fall back to legacy fields
                    const sessions = pa.product.product_sessions && pa.product.product_sessions.length > 0
                      ? pa.product.product_sessions.sort((a: any, b: any) => {
                          const dateA = new Date(`${a.session_date}T${a.session_time}`)
                          const dateB = new Date(`${b.session_date}T${b.session_time}`)
                          return dateA.getTime() - dateB.getTime()
                        })
                      : pa.product.session_date 
                        ? [{ session_date: pa.product.session_date, session_time: pa.product.session_time || '00:00:00' }]
                        : []

                    return {
                      productName: pa.product.name,
                      athleteName: pa.athlete.name,
                      quantity: pa.quantity,
                      unitPriceCents: pa.unit_price_cents,
                      sessions: sessions,
                      gender: pa.product.gender,
                      minGrade: pa.product.min_grade,
                      maxGrade: pa.product.max_grade,
                      skillLevel: pa.product.skill_level,
                    }
                  })

                  // Generate order number from payment ID
                  const orderNumber = `LAB-${payment.id.slice(0, 8).toUpperCase()}`

                  // Send confirmation email
                  logger.info('purchase_confirmation.init', {
                    to: userData.email,
                    orderNumber,
                    traceId,
                  })
                  
                  await sendPurchaseConfirmation({
                    to: userData.email,
                    customerName: userData.full_name || undefined,
                    orderNumber,
                    orderDate: new Date().toISOString(),
                    items: emailItems,
                    totalAmountCents: paymentIntent.amount,
                    currency: paymentIntent.currency,
                    context: { traceId },
                  })

                  // Update email_sent_at to ensure email is sent only once
                  const { error: updateEmailError } = await supabase
                    .from('payments')
                    .update({ email_sent_at: new Date().toISOString() })
                    .eq('id', payment.id)

                  if (updateEmailError) {
                    logger.error('webhook.email_sent_at_update_failed', { error: updateEmailError.message, traceId })
                  }
                }
              }
            } else if (payment?.email_sent_at) {
              logger.debug('webhook.email_already_sent', { traceId })
            }

            // Add customer to Resend audience (even if email was already sent)
            // This ensures customers are in the audience regardless of email sending status
            // Only if feature flag is enabled
            if (process.env.ENABLE_RESEND_CONTACT_ADDITION === 'true') {
              try {
                const customerEmail = customer.email
                if (customerEmail) {
                  logger.debug('webhook.adding_to_resend_audience', { traceId })
                  await addContactToResend(customerEmail, { traceId })
                  logger.debug('webhook.resend_audience_added', { traceId })
                } else {
                  logger.warn('webhook.no_email_for_resend', { traceId })
                }
              } catch (resendError) {
                logger.error('webhook.resend_audience_error', {
                  error: resendError instanceof Error ? resendError.message : 'Unknown error',
                  traceId,
                })
                // Don't throw - Resend failures shouldn't block payment processing
              }
            } else {
              logger.debug('webhook.resend_contact_addition_disabled', { traceId })
            }
          } catch (emailError) {
            logger.error('webhook.email_error', { error: emailError instanceof Error ? emailError.message : 'Unknown error', traceId })
            // Don't throw - email failures shouldn't block payment processing
          }
        }
        break
      }

      case "payment_intent.succeeded": {
        // Skip this event - we handle payments in checkout.session.completed
        logger.debug('webhook.payment_intent_succeeded_skipped', { traceId })
        break
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        
        // Record failed payment
        await supabase.from("payments").insert({
          user_id: paymentIntent.metadata?.userId,
          stripe_payment_intent_id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: "failed",
        })
        break
      }

      case "charge.succeeded": {
        logger.debug('webhook.charge_succeeded', { traceId })
        const charge = event.data.object as Stripe.Charge
        
        if (charge.payment_intent) {
          const paymentIntent = await stripe.paymentIntents.retrieve(charge.payment_intent as string)
          logger.debug('webhook.payment_intent_retrieved', { traceId })
          
          if (paymentIntent.metadata.checkout_session_id) {
            const session = await stripe.checkout.sessions.retrieve(paymentIntent.metadata.checkout_session_id)
            logger.debug('webhook.checkout_session_found', { traceId })
            
            // Process the session as if it was checkout.session.completed
            if (session.payment_status === 'paid') {
              logger.debug('webhook.charge_processing', { traceId })
              // We'll need to call the same processing logic here
            }
          }
        }
        break
      }

      default:
        logger.debug('webhook.unhandled_event', { eventType: event.type, traceId })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error('webhook.error', { error: error instanceof Error ? error.message : 'Unknown error', traceId })
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}
