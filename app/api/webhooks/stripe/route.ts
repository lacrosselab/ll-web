import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { getSupabaseService } from "@/lib/supabase/service"
import type Stripe from "stripe"
import { logger } from '@/lib/utils'

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
          
          // Check if payment already exists (handle duplicate webhook calls)
          const { data: existingPayment, error: existingPaymentError } = await supabase
            .from("payments")
            .select("id")
            .eq("stripe_payment_intent_id", paymentIntent.id)
            .single()

          let payment
          if (existingPayment) {
            logger.debug('Payment already exists, using existing record')
            payment = existingPayment
          } else {
            // Create new payment record
            const { data: newPayment, error: paymentError } = await supabase
              .from("payments")
              .insert({
                user_id: userId,
                stripe_payment_intent_id: paymentIntent.id,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                status: "succeeded",
              })
              .select()
              .single()

            if (paymentError) {
              logger.error("Error creating payment record", paymentError)
              throw paymentError
            }
            payment = newPayment
            logger.debug('Created new payment record')
          }

          // Process each line item to create payment_athletes records and reduce stock
          try {
            logger.debug('Fetching line items from session')
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
            logger.debug('Processing line items:', lineItems.data.length)
              
            for (let i = 0; i < lineItems.data.length; i++) {
              const lineItem = lineItems.data[i]
              logger.debug(`Processing line item ${i}`)
              
              // Get athlete info from session metadata (not line item metadata)
              const athleteId = session.metadata?.[`athlete_${i}_id`]
              const athleteName = session.metadata?.[`athlete_${i}_name`]
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
                  .select('id, name, price_cents, stock_quantity, stripe_price_id')
                  .eq('id', productId)
                  .single()
                product = result.data
                productError = result.error
              } else {
                logger.debug(`Looking up product by stripe_price_id`)
                const result = await supabase
                  .from('products')
                  .select('id, name, price_cents, stock_quantity, stripe_price_id')
                  .eq('stripe_price_id', lineItem.price?.id)
                  .single()
                product = result.data
                productError = result.error
              }

              if (productError || !product) {
                logger.error(`Error finding product`, productError)
                continue
              }
              
              logger.debug(`Found product:`, product.name)

              // Check if payment_athletes record already exists
              const { data: existingPaymentAthlete, error: existingError } = await supabase
                .from('payment_athletes')
                .select('id')
                .eq('payment_id', payment.id)
                .eq('athlete_id', athleteId)
                .eq('product_id', product.id)
                .single()

              if (existingError && existingError.code !== 'PGRST116') {
                logger.error(`Error checking existing payment_athletes record`, existingError)
                continue
              }

              if (existingPaymentAthlete) {
                logger.debug(`Payment_athletes record already exists`)
              } else {
                // Create payment_athletes record
                logger.debug(`Creating payment_athletes record`)
                const { error: paymentAthleteError } = await supabase
                  .from('payment_athletes')
                  .insert({
                    payment_id: payment.id,
                    athlete_id: athleteId,
                    product_id: product.id,
                    quantity: lineItem.quantity || 1,
                    unit_price_cents: product.price_cents
                  })

                if (paymentAthleteError) {
                  logger.error(`Error creating payment_athletes record`, paymentAthleteError)
                  continue
                } else {
                  logger.debug(`Successfully created payment_athletes record`)
                }
              }

              // Only reduce stock if this is the first time processing this payment
              if (!existingPaymentAthlete) {
                const quantityToReduce = lineItem.quantity || 1
                const newStockQuantity = Math.max(0, product.stock_quantity - quantityToReduce)
                logger.debug(`Updating stock: ${product.stock_quantity} - ${quantityToReduce} = ${newStockQuantity}`)
                
                const { error: stockError } = await supabase
                  .from('products')
                  .update({ stock_quantity: newStockQuantity })
                  .eq('id', product.id)

                if (stockError) {
                  logger.error(`Error updating stock`, stockError)
                  continue
                } else {
                  logger.debug(`Successfully updated stock for product`)
                }
              } else {
                logger.debug(`Skipping stock update - already processed for this payment`)
              }

              logger.debug(`Processed payment for athlete and product`)
            }
          } catch (lineItemError) {
            logger.error('Error processing line items', lineItemError)
            throw lineItemError
          }

          // Clear the user's cart after successful payment
          if (userId) {
            logger.debug(`Attempting to clear cart for user`)
            
            const { error: clearCartError } = await supabase
              .from('cart_items')
              .delete()
              .eq('user_id', userId)

            if (clearCartError) {
              logger.error(`Error clearing cart for user`, clearCartError)
            } else {
              logger.debug(`Successfully cleared cart for user`)
            }
          } else {
            logger.debug(`No user ID found, skipping cart clear`)
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
