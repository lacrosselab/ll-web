"use client"

import type { PriceInterval } from "./stripe"
import { logger } from "./utils"

export async function createCheckoutSession(priceInterval: PriceInterval) {
  try {
    const response = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ priceInterval }),
    })

    if (!response.ok) {
      throw new Error("Failed to create checkout session")
    }

    const { sessionId } = await response.json()

    // Redirect to Stripe Checkout
    const stripe = (await import("@stripe/stripe-js")).loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

    const stripeInstance = await stripe
    if (stripeInstance) {
      await stripeInstance.redirectToCheckout({ sessionId })
    }
  } catch (error) {
    logger.error("Error creating checkout session", { error })
    throw error
  }
}
