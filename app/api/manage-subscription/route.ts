import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { action, subscriptionId } = await request.json()

    // Get the authenticated user
    const supabase = createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (action === "cancel") {
      // Cancel the subscription at period end
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      })

      // Update subscription status in database
      await supabase
        .from("subscriptions")
        .update({
          status: "canceled",
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscriptionId)

      return NextResponse.json({
        success: true,
        message: "Subscription will be canceled at the end of the current billing period.",
      })
    }

    if (action === "update_payment_method") {
      // Get the customer from the subscription
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const customerId = subscription.customer as string

      // Create a billing portal session for payment method updates
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/member/billing`,
      })

      return NextResponse.json({
        success: true,
        url: portalSession.url,
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Subscription management error:", error)
    return NextResponse.json({ error: "Failed to manage subscription" }, { status: 500 })
  }
}
