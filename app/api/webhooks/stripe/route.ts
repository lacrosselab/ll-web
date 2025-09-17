import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { getSupabaseService } from "@/lib/supabase/service"
import type Stripe from "stripe"

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  console.log("🚨 WEBHOOK ENDPOINT HIT! 🚨")
  console.log("🚨 Request method:", request.method)
  console.log("🚨 Request URL:", request.url)
  console.log("🚨 Headers:", Object.fromEntries(request.headers.entries()))
  
  try {
    const body = await request.text()
    const signature = request.headers.get("stripe-signature")!

    console.log("🚨 WEBHOOK DEBUG INFO:")
    console.log("🚨 Webhook secret exists:", !!webhookSecret)
    console.log("🚨 Webhook secret length:", webhookSecret?.length)
    console.log("🚨 Signature header exists:", !!signature)
    console.log("🚨 Body length:", body.length)
    console.log("🚨 Body preview:", body.substring(0, 200))

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      console.log("[v0] Webhook signature verified successfully")
    } catch (err) {
      console.error("[v0] Webhook signature verification failed:", err)
      console.error("[v0] Error details:", {
        message: err instanceof Error ? err.message : "Unknown error",
        webhookSecretPrefix: webhookSecret?.substring(0, 8) + "...",
        signaturePrefix: signature?.substring(0, 20) + "...",
      })
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    console.log("[v0] Processing webhook event:", event.type)
    console.log("[v0] Event ID:", event.id)
    console.log("[v0] Event data object type:", event.data.object.object)

    const supabase = getSupabaseService()

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        
        // For one-time payments, record the payment and process cart items
        if (session.payment_status === 'paid') {
          console.log('[WEBHOOK] Processing checkout.session.completed for session:', session.id)
          console.log('[WEBHOOK] Session customer:', session.customer)
          console.log('[WEBHOOK] Session metadata:', session.metadata)
          
          // Get the customer to access its metadata
          const customer = await stripe.customers.retrieve(session.customer as string) as Stripe.Customer
          console.log('[WEBHOOK] Retrieved customer:', {
            id: customer.id,
            email: customer.email,
            metadata: customer.metadata
          })
          
          // Get the payment intent to get more details
          const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string)
          console.log('[WEBHOOK] Payment intent amount:', paymentIntent.amount)
          
          // Record the payment - try multiple ways to get userId
          let userId = customer.metadata?.userId || session.metadata?.userId
          
          // If we still don't have userId, try to find it by email
          if (!userId && customer.email) {
            console.log('[WEBHOOK] No userId in metadata, looking up by email:', customer.email)
            const { data: userByEmail, error: emailError } = await supabase
              .from('users')
              .select('id')
              .eq('email', customer.email)
              .single()
            
            if (emailError) {
              console.error('[WEBHOOK] Error looking up user by email:', emailError)
            } else if (userByEmail) {
              userId = userByEmail.id
              console.log('[WEBHOOK] Found user by email:', userId)
            }
          }
          
          if (!userId) {
            console.error('[WEBHOOK] Could not determine userId for payment processing')
            throw new Error('Could not determine userId for payment processing')
          }
          
          console.log('[WEBHOOK] Using userId for payment:', userId)
          
          // Test database connection and table access
          console.log('[WEBHOOK] Testing database connection...')
          const { data: testQuery, error: testError } = await supabase
            .from('payment_athletes')
            .select('id')
            .limit(1)
          
          if (testError) {
            console.error('[WEBHOOK] payment_athletes table test failed:', testError)
          } else {
            console.log('[WEBHOOK] payment_athletes table accessible')
          }
          
          // Test payments table access
          const { data: paymentsTest, error: paymentsError } = await supabase
            .from('payments')
            .select('id')
            .limit(1)
          
          if (paymentsError) {
            console.error('[WEBHOOK] payments table test failed:', paymentsError)
          } else {
            console.log('[WEBHOOK] payments table accessible')
          }
          
          // Check if payment already exists (handle duplicate webhook calls)
          const { data: existingPayment, error: existingPaymentError } = await supabase
            .from("payments")
            .select("id")
            .eq("stripe_payment_intent_id", paymentIntent.id)
            .single()

          let payment
          if (existingPayment) {
            console.log('[WEBHOOK] Payment already exists, using existing record:', existingPayment.id)
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
              console.error("Error creating payment record:", paymentError)
              throw paymentError
            }
            payment = newPayment
            console.log('[WEBHOOK] Created new payment record:', payment.id)
          }

          // Process each line item to create payment_athletes records and reduce stock
          // Always fetch line items from the session (session.line_items might be null)
          try {
            console.log('[WEBHOOK] Fetching line items from session...')
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
            console.log('[WEBHOOK] Processing line items:', lineItems.data.length)
            console.log('[WEBHOOK] Line items data:', JSON.stringify(lineItems.data, null, 2))
              
              for (let i = 0; i < lineItems.data.length; i++) {
              const lineItem = lineItems.data[i]
              console.log(`[WEBHOOK] Processing line item ${i}:`, {
                price_id: lineItem.price?.id,
                quantity: lineItem.quantity
              })
              
              // Get athlete info from session metadata (not line item metadata)
              const athleteId = session.metadata?.[`athlete_${i}_id`]
              const athleteName = session.metadata?.[`athlete_${i}_name`]
              const productId = session.metadata?.[`athlete_${i}_product_id`]
              
              console.log(`[WEBHOOK] Athlete info for index ${i}:`, {
                athleteId,
                athleteName,
                productId
              })
              
              if (!athleteId) {
                console.error(`[WEBHOOK] No athlete_id in session metadata for index ${i}:`, session.metadata)
                continue
              }

              // Find the product - try using productId from metadata first, then stripe_price_id
              let product
              let productError
              
              if (productId) {
                console.log(`[WEBHOOK] Looking up product by ID: ${productId}`)
                const result = await supabase
                  .from('products')
                  .select('id, name, price_cents, stock_quantity, stripe_price_id')
                  .eq('id', productId)
                  .single()
                product = result.data
                productError = result.error
              } else {
                console.log(`[WEBHOOK] Looking up product by stripe_price_id: ${lineItem.price?.id}`)
                const result = await supabase
                  .from('products')
                  .select('id, name, price_cents, stock_quantity, stripe_price_id')
                  .eq('stripe_price_id', lineItem.price?.id)
                  .single()
                product = result.data
                productError = result.error
              }

              if (productError || !product) {
                console.error(`[WEBHOOK] Error finding product:`, productError)
                continue
              }
              
              console.log(`[WEBHOOK] Found product:`, {
                id: product.id,
                name: product.name,
                current_stock: product.stock_quantity
              })

              // Check if payment_athletes record already exists
              const { data: existingPaymentAthlete } = await supabase
                .from('payment_athletes')
                .select('id')
                .eq('payment_id', payment.id)
                .eq('athlete_id', athleteId)
                .eq('product_id', product.id)
                .single()

              if (existingPaymentAthlete) {
                console.log(`[WEBHOOK] Payment_athletes record already exists for athlete ${athleteId}, product ${product.id}`)
              } else {
                // Create payment_athletes record
                console.log(`[WEBHOOK] Creating payment_athletes record for athlete ${athleteId}, product ${product.id}`)
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
                  console.error(`[WEBHOOK] Error creating payment_athletes record:`, paymentAthleteError)
                  continue
                } else {
                  console.log(`[WEBHOOK] Successfully created payment_athletes record`)
                }
              }

              // Only reduce stock if this is the first time processing this payment
              if (!existingPaymentAthlete) {
                // Reduce stock quantity
                const quantityToReduce = lineItem.quantity || 1
                const newStockQuantity = Math.max(0, product.stock_quantity - quantityToReduce)
                console.log(`[WEBHOOK] Updating stock: ${product.stock_quantity} - ${quantityToReduce} = ${newStockQuantity}`)
                
                const { error: stockError } = await supabase
                  .from('products')
                  .update({ stock_quantity: newStockQuantity })
                  .eq('id', product.id)

                if (stockError) {
                  console.error(`[WEBHOOK] Error updating stock:`, stockError)
                  continue
                } else {
                  console.log(`[WEBHOOK] Successfully updated stock for product ${product.name}`)
                }
              } else {
                console.log(`[WEBHOOK] Skipping stock update - already processed for this payment`)
              }

              console.log(`[WEBHOOK] Processed payment for athlete ${athleteName} (${athleteId}) for product ${product.name}`)
            }
            } catch (lineItemError) {
              console.error('[WEBHOOK] Error processing line items:', lineItemError)
              throw lineItemError
            }

          // Clear the user's cart after successful payment
          // We need to get the session_id from the cart_items table for this user
          if (userId) {
            console.log(`[WEBHOOK] Attempting to clear cart for user: ${userId}`)
            
            // Get all cart sessions for this user and clear them
            const { data: userCartItems, error: cartQueryError } = await supabase
              .from('cart_items')
              .select('session_id, product_id, athlete_id')
              .eq('user_id', userId)

            if (cartQueryError) {
              console.error(`[WEBHOOK] Error querying cart items:`, cartQueryError)
            } else {
              console.log(`[WEBHOOK] Found ${userCartItems?.length || 0} cart items for user`)
              
              if (userCartItems && userCartItems.length > 0) {
                // Get unique session IDs
                const sessionIds = [...new Set(userCartItems.map(item => item.session_id))]
                console.log(`[WEBHOOK] Found ${sessionIds.length} unique cart sessions:`, sessionIds)
                
                // Clear all cart sessions for this user
                for (const sessionId of sessionIds) {
                  console.log(`[WEBHOOK] Clearing cart session: ${sessionId}`)
                  const { error: clearCartError } = await supabase
                    .from('cart_items')
                    .delete()
                    .eq('session_id', sessionId)

                  if (clearCartError) {
                    console.error(`[WEBHOOK] Error clearing cart session ${sessionId}:`, clearCartError)
                  } else {
                    console.log(`[WEBHOOK] Successfully cleared cart session: ${sessionId}`)
                  }
                }
              } else {
                console.log(`[WEBHOOK] No cart items found for user ${userId}`)
              }
            }
          } else {
            console.log(`[WEBHOOK] No userId available for cart clearing`)
          }
        }
        break
      }

      case "payment_intent.succeeded": {
        // Skip this event - we handle payments in checkout.session.completed
        // where we have access to customer metadata with the correct userId
        console.log("[DEBUG] payment_intent.succeeded - Skipping (handled in checkout.session.completed)")
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
        console.log("[WEBHOOK] Processing charge.succeeded event")
        const charge = event.data.object as Stripe.Charge
        
        // Get the payment intent to find the checkout session
        if (charge.payment_intent) {
          const paymentIntent = await stripe.paymentIntents.retrieve(charge.payment_intent as string)
          console.log("[WEBHOOK] Payment intent metadata:", paymentIntent.metadata)
          
          // Try to find the checkout session from the payment intent
          if (paymentIntent.metadata?.checkout_session_id) {
            const session = await stripe.checkout.sessions.retrieve(paymentIntent.metadata.checkout_session_id)
            console.log("[WEBHOOK] Found checkout session from charge.succeeded:", session.id)
            
            // Process the session as if it was checkout.session.completed
            if (session.payment_status === 'paid') {
              console.log("[WEBHOOK] Processing charge.succeeded as checkout.session.completed")
              // We'll need to call the same processing logic here
              // For now, let's just log that we found it
            }
          }
        }
        break
      }

      default:
        console.log(`[WEBHOOK] Unhandled event type: ${event.type}`)
        console.log(`[WEBHOOK] Event data:`, JSON.stringify(event.data, null, 2))
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}
