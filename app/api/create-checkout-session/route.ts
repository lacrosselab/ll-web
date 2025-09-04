import { type NextRequest, NextResponse } from "next/server"
import { stripe, PRICE_CONFIG, type PriceInterval } from "@/lib/stripe"
import { getSupabaseServer } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { priceInterval }: { priceInterval: PriceInterval } = await request.json()

    // Get authenticated user
    const supabase = await getSupabaseServer()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get or create Stripe customer
    let customerId: string

    // Check if user already has a Stripe customer ID
    const { data: existingUser } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single()

    if (existingUser?.stripe_customer_id) {
      customerId = existingUser.stripe_customer_id
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: {
          userId: user.id,
        },
      })
      customerId = customer.id
    }

    const priceConfig = PRICE_CONFIG[priceInterval]

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceConfig.priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/member/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/pricing?canceled=true`,
      metadata: {
        userId: user.id,
      },
    })

    return NextResponse.json({ sessionId: session.id })
  } catch (error) {
    console.error("Error creating checkout session:", error)
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
  }
}
