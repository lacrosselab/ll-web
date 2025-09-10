import { type NextRequest, NextResponse } from "next/server"
import { stripe, PRICE_CONFIG, type PriceInterval } from "@/lib/stripe"
import { getSupabaseService } from "@/lib/supabase/service"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { priceInterval, priceId }: { priceInterval?: PriceInterval; priceId?: string } = body

    // Get authenticated user
    const supabase = getSupabaseService()    
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get or create Stripe customer
    let customerId: string

    // Check if user already has a Stripe customer ID in the users table
    const { data: existingUser } = await supabase
      .from("users")
      .select("stripe_customer_id")
      .eq("id", user.id)
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

      // Store the customer ID in the users table
      await supabase
        .from("users")
        .upsert({
          id: user.id,
          email: user.email!,
          stripe_customer_id: customerId,
        })
    }

    // Determine which price to use
    let finalPriceId: string

    if (priceId) {
      // Use the specific price ID from the dynamic product
      finalPriceId = priceId
    } else if (priceInterval) {
      // Fallback to the legacy price interval system
      const priceConfig = PRICE_CONFIG[priceInterval]
      finalPriceId = priceConfig.priceId
    } else {
      return NextResponse.json({ error: "No price specified" }, { status: 400 })
    }

    // Create checkout session for one-time payment
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: finalPriceId,
          quantity: 1,
        },
      ],
      mode: "payment", // Changed from "subscription" to "payment"
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
