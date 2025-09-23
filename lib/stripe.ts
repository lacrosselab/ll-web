import Stripe from "stripe"

// Initialize Stripe with secret key
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Price configurations
export const PRICE_CONFIG = {
  monthly: {
    priceId: process.env.STRIPE_MONTHLY_PRICE_ID!,
    amount: 999, // $9.99 in cents
    interval: "month" as const,
  },
  yearly: {
    priceId: process.env.STRIPE_YEARLY_PRICE_ID!,
    amount: 9999, // $99.99 in cents
    interval: "year" as const,
  },
}

export type PriceInterval = keyof typeof PRICE_CONFIG
