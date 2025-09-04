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
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)

        await supabase.from("subscriptions").upsert({
          user_id: session.metadata?.userId,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscription.id,
          status: subscription.status,
          price_id: subscription.items.data[0].price.id,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        })
        break
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice

        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)

          // Update subscription
          await supabase
            .from("subscriptions")
            .update({
              status: subscription.status,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq("stripe_subscription_id", subscription.id)

          // Record payment
          await supabase.from("payments").insert({
            user_id: subscription.metadata?.userId,
            subscription_id: subscription.id,
            stripe_payment_intent_id: invoice.payment_intent as string,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: "succeeded",
          })
        }
        break
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription

        await supabase
          .from("subscriptions")
          .update({
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id)
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription

        await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
          })
          .eq("stripe_subscription_id", subscription.id)
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
