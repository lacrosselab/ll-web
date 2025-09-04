"use client"

import { Navigation } from "@/components/navigation"
import { PricingCard } from "@/components/pricing-card"
import { createCheckoutSession } from "@/lib/checkout"
import type { PriceInterval } from "@/lib/stripe"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"

export default function PricingPage() {
  const [loading, setLoading] = useState<PriceInterval | null>(null)
  const router = useRouter()

  const handleSubscribe = async (interval: PriceInterval) => {
    try {
      setLoading(interval)

      // Check if user is authenticated
      const supabase = getSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login?redirect=/pricing")
        return
      }

      await createCheckoutSession(interval)
    } catch (error) {
      console.error("Error creating checkout session:", error)
      alert("Failed to start checkout. Please try again.")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">Simple, transparent pricing</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that works best for you. All plans include our core features with no hidden fees.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <PricingCard
              title="Monthly"
              description="Perfect for getting started"
              price="$9.99"
              interval="monthly"
              features={[
                "Access to all premium content",
                "Priority customer support",
                "Advanced analytics dashboard",
                "Team collaboration tools",
                "API access",
                "Custom integrations",
              ]}
              onSubscribe={handleSubscribe}
              loading={loading === "monthly"}
            />

            <PricingCard
              title="Yearly"
              description="Best value for committed users"
              price="$99.99"
              interval="yearly"
              features={[
                "Everything in Monthly plan",
                "2 months free (save 17%)",
                "Priority feature requests",
                "Dedicated account manager",
                "Advanced security features",
                "Custom onboarding",
              ]}
              popular
              onSubscribe={handleSubscribe}
              loading={loading === "yearly"}
            />
          </div>

          {/* FAQ Section */}
          <div className="mt-20">
            <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div>
                <h3 className="font-semibold mb-2">Can I cancel anytime?</h3>
                <p className="text-muted-foreground">
                  Yes, you can cancel your subscription at any time. You'll continue to have access until the end of
                  your billing period.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Is there a free trial?</h3>
                <p className="text-muted-foreground">
                  We offer a 14-day free trial for all new users. No credit card required to get started.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
                <p className="text-muted-foreground">
                  We accept all major credit cards, PayPal, and bank transfers for annual plans.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Do you offer refunds?</h3>
                <p className="text-muted-foreground">
                  Yes, we offer a 30-day money-back guarantee if you're not satisfied with our service.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
