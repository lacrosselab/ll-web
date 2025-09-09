import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { getSupabaseServer } from "@/lib/supabase/server"
import type Stripe from "stripe"

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get("stripe-signature")!

    console.log("[v0] Webhook secret exists:", !!webhookSecret)
    console.log("[v0] Webhook secret length:", webhookSecret?.length)
    console.log("[v0] Signature header exists:", !!signature)
    console.log("[v0] Body length:", body.length)

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

    const supabase = await getSupabaseServer()

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        
        // For one-time payments, record the payment directly
        if (session.payment_status === 'paid') {
          // Get the payment intent to get more details
          const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string)
          
          // Record the payment
          await supabase.from("payments").insert({
            user_id: session.metadata?.userId,
            stripe_payment_intent_id: paymentIntent.id,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: "succeeded",
          })
        }
        break
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        
        // Record successful payment
        await supabase.from("payments").insert({
          user_id: paymentIntent.metadata?.userId,
          stripe_payment_intent_id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: "succeeded",
        })
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

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}
