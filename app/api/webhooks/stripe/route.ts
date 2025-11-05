import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { getSupabaseService } from "@/lib/supabase/service"
import type Stripe from "stripe"
import { logger } from '@/lib/utils'
import { sendPurchaseConfirmation } from '@/lib/email/service'

export async function POST(request: NextRequest) {
  logger.debug("Webhook endpoint hit")
  logger.debug("Request method:", request.method)
  
  try {
    const body = await request.text()
    const signature = request.headers.get("stripe-signature")!

    logger.debug("Webhook debug info:", {
      webhookSecretExists: !!process.env.STRIPE_WEBHOOK_SECRET,
      signatureExists: !!signature,
      bodyLength: body.length
    })

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
      logger.debug("Webhook signature verified successfully")
    } catch (err) {
      logger.error("Webhook signature verification failed", err)
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    logger.debug("Processing webhook event:", event.type)
    logger.debug("Event ID:", event.id)

    const supabase = getSupabaseService()

    // Check webhook event idempotency at the start
    const { data: existingWebhookEvent, error: webhookEventError } = await supabase
      .from('webhook_events')
      .select('processed_at')
      .eq('stripe_event_id', event.id)
      .single()

    if (webhookEventError && webhookEventError.code !== 'PGRST116') {
      logger.error('Error checking webhook event', webhookEventError)
      throw webhookEventError
    }

    // If event already processed, return early
    if (existingWebhookEvent?.processed_at) {
      logger.debug('Webhook event already processed, skipping')
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
      logger.error('Error upserting webhook event', upsertWebhookError)
      throw upsertWebhookError
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        
        // For one-time payments, record the payment and process cart items
        if (session.payment_status === 'paid') {
          logger.debug('Processing checkout.session.completed for session:', session.id)
          
          // Get the customer to access its metadata
          const customer = await stripe.customers.retrieve(session.customer as string) as Stripe.Customer
          logger.debug('Retrieved customer info')
          
          // Get the payment intent to get more details
          const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string)
          logger.debug('Retrieved payment intent')
          
          // Record the payment - try multiple ways to get userId
          let userId = customer.metadata?.userId || session.metadata?.userId
          
          // If we still don't have userId, try to find it by email
          if (!userId && customer.email) {
            logger.debug('Looking up user by email')
            const { data: userByEmail, error: emailError } = await supabase
              .from('users')
              .select('id')
              .eq('email', customer.email)
              .single()
            
            if (emailError && emailError.code !== 'PGRST116') {
              logger.error('Error looking up user by email', emailError)
            } else if (userByEmail) {
              userId = userByEmail.id
              logger.debug('Found user by email')
            }
          }
          
          if (!userId) {
            logger.error('Could not determine userId for payment processing')
            throw new Error('Could not determine userId for payment processing')
          }
          
          logger.debug('Using userId for payment')

          // Fetch line items from session
          logger.debug('Fetching line items from session')
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
          logger.debug('Processing line items:', lineItems.data.length)

          // Prepare line items data for RPC function
          const lineItemsData = []
          for (let i = 0; i < lineItems.data.length; i++) {
            const lineItem = lineItems.data[i]
            
            // Get athlete info from session metadata
            const athleteId = session.metadata?.[`athlete_${i}_id`]
            const productId = session.metadata?.[`athlete_${i}_product_id`]
            
            if (!athleteId) {
              logger.error(`No athlete_id in session metadata for index ${i}`)
              continue
            }

            // Find the product - try using productId from metadata first, then stripe_price_id
            let product
            let productError
            
            if (productId) {
              logger.debug(`Looking up product by ID`)
              const result = await supabase
                .from('products')
                .select('id, price_cents, stripe_price_id')
                .eq('id', productId)
                .single()
              product = result.data
              productError = result.error
            } else {
              logger.debug(`Looking up product by stripe_price_id`)
              const result = await supabase
                .from('products')
                .select('id, price_cents, stripe_price_id')
                .eq('stripe_price_id', lineItem.price?.id)
                .single()
              product = result.data
              productError = result.error
            }

            if (productError || !product) {
              logger.error(`Error finding product`, productError)
              continue
            }
            
            logger.debug(`Found product for line item ${i}`)

            lineItemsData.push({
              product_id: product.id,
              athlete_id: athleteId,
              quantity: lineItem.quantity || 1,
              unit_price_cents: product.price_cents
            })
          }

          if (lineItemsData.length === 0) {
            logger.error('No valid line items found')
            throw new Error('No valid line items found')
          }

          // Call RPC function to process payment in a transaction
          logger.debug('Calling process_payment_webhook RPC function')
          const { data: paymentId, error: rpcError } = await supabase
            .rpc('process_payment_webhook', {
              p_stripe_payment_intent_id: paymentIntent.id,
              p_user_id: userId,
              p_amount: paymentIntent.amount,
              p_currency: paymentIntent.currency,
              p_line_items: lineItemsData
            })

          if (rpcError) {
            logger.error('Error processing payment via RPC', rpcError)
            throw rpcError
          }

          logger.debug('Payment processed successfully via RPC, payment_id:', paymentId)

          // Update webhook_events.processed_at after successful transaction
          const { error: updateWebhookError } = await supabase
            .from('webhook_events')
            .update({ processed_at: new Date().toISOString() })
            .eq('stripe_event_id', event.id)

          if (updateWebhookError) {
            logger.error('Error updating webhook_events.processed_at', updateWebhookError)
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
              logger.error('Error fetching payment for email check', paymentFetchError)
            } else if (payment && !payment.email_sent_at) {
              // Email not sent yet, proceed with sending
              // Get user details
              const { data: userData, error: userError } = await supabase
                .from('users')
                .select('email, full_name')
                .eq('id', userId)
                .single()

              if (userError || !userData) {
                logger.error('Error fetching user data for email', userError)
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
                      description
                    )
                  `)
                  .eq('payment_id', payment.id)

                if (paymentAthletesError) {
                  logger.error('Error fetching payment details for email', paymentAthletesError)
                } else if (paymentAthletes && paymentAthletes.length > 0) {
                  // Format items for email
                  const emailItems = paymentAthletes.map((pa: any) => ({
                    productName: pa.product.name,
                    athleteName: pa.athlete.name,
                    quantity: pa.quantity,
                    unitPriceCents: pa.unit_price_cents,
                    sessionDate: pa.product.session_date,
                    sessionTime: pa.product.session_time,
                    location: undefined, // Location not stored in DB currently
                  }))

                  // Generate order number from payment ID
                  const orderNumber = `LAB-${payment.id.slice(0, 8).toUpperCase()}`

                  // Send confirmation email
                  await sendPurchaseConfirmation({
                    to: userData.email,
                    customerName: userData.full_name || undefined,
                    orderNumber,
                    orderDate: new Date().toISOString(),
                    items: emailItems,
                    totalAmountCents: paymentIntent.amount,
                    currency: paymentIntent.currency,
                  })

                  // Update email_sent_at to ensure email is sent only once
                  const { error: updateEmailError } = await supabase
                    .from('payments')
                    .update({ email_sent_at: new Date().toISOString() })
                    .eq('id', payment.id)

                  if (updateEmailError) {
                    logger.error('Error updating email_sent_at', updateEmailError)
                  } else {
                    logger.debug(`Sent purchase confirmation email to: ${userData.email}`)
                  }
                }
              }
            } else if (payment?.email_sent_at) {
              logger.debug('Email already sent for this payment, skipping')
            }
          } catch (emailError) {
            logger.error('Error sending purchase confirmation email', emailError)
            // Don't throw - email failures shouldn't block payment processing
          }
        }
        break
      }

      case "payment_intent.succeeded": {
        // Skip this event - we handle payments in checkout.session.completed
        logger.debug("payment_intent.succeeded - Skipping (handled in checkout.session.completed)")
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
        logger.debug("Processing charge.succeeded event")
        const charge = event.data.object as Stripe.Charge
        
        if (charge.payment_intent) {
          const paymentIntent = await stripe.paymentIntents.retrieve(charge.payment_intent as string)
          logger.debug("Payment intent metadata retrieved")
          
          if (paymentIntent.metadata.checkout_session_id) {
            const session = await stripe.checkout.sessions.retrieve(paymentIntent.metadata.checkout_session_id)
            logger.debug("Found checkout session from charge.succeeded")
            
            // Process the session as if it was checkout.session.completed
            if (session.payment_status === 'paid') {
              logger.debug("Processing charge.succeeded as checkout.session.completed")
              // We'll need to call the same processing logic here
            }
          }
        }
        break
      }

      default:
        logger.debug(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error("Webhook error", error)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}
