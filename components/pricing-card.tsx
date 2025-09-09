"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Clock } from "lucide-react"
import { useState } from "react"
import { createCheckoutSession } from "@/lib/checkout"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import Image from "next/image"

interface ProductPrice {
  id: string
  unit_amount: number | null
  currency: string
  interval: string | null
  interval_count: number | null
  type: string
  metadata: Record<string, string>
}

interface PricingCardProps {
  productId: string
  title: string
  description: string
  price: string
  interval: string
  intervalCount?: number | null
  features: string[]
  popular?: boolean
  image?: string
  allPrices: ProductPrice[]
  endsOn?: string
  endDateUrgency?: 'normal' | 'ending-soon' | 'ending-very-soon'
}

export function PricingCard({
  productId,
  title,
  description,
  price,
  interval,
  intervalCount,
  features,
  popular = false,
  image,
  allPrices,
  endsOn,
  endDateUrgency = 'normal',
}: PricingCardProps) {
  const [loading, setLoading] = useState(false)
  const [selectedPriceId, setSelectedPriceId] = useState(allPrices[0]?.id)
  const router = useRouter()

  // Get interval display text
  const getIntervalText = (interval: string, intervalCount?: number | null): string => {
    if (interval === 'one-time') return ''
    
    if (intervalCount && intervalCount > 1) {
      return `/${intervalCount} ${interval}s`
    }
    
    return `/${interval}`
  }

  // Format end date display
  const formatEndDate = (endsOnString: string): string => {
    try {
      const [month, day, year] = endsOnString.split('/').map(Number)
      const endDate = new Date(year, month - 1, day)
      const now = new Date()
      const diffTime = endDate.getTime() - now.getTime()
      const daysUntilEnd = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      if (daysUntilEnd <= 0) return 'Ended'
      if (daysUntilEnd === 1) return 'Ends tomorrow'
      if (daysUntilEnd <= 7) return `Ends in ${daysUntilEnd} days`
      
      return `Ends ${endDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      })}`
    } catch {
      return ''
    }
  }

  // Get card styling based on urgency
  const getCardStyling = () => {
    switch (endDateUrgency) {
      case 'ending-very-soon':
        return {
          cardClass: "relative border-red-500 shadow-lg",
          badgeClass: "bg-primary text-primary-foreground",
          badgeText: "Ends tomorrow"
        }
      case 'ending-soon':
        return {
          cardClass: "relative border-red-500 shadow-lg",
          badgeClass: "bg-primary text-primary-foreground",
          badgeText: "Ending this week"
        }
      default:
        return {
          cardClass: popular ? "relative border-primary shadow-lg" : "relative",
          badgeClass: "bg-primary text-primary-foreground",
          badgeText: "Most Popular"
        }
    }
  }

  const handleSubscribe = async () => {
    try {
      setLoading(true)

      // Check if user is authenticated
      const supabase = getSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login?redirect=/pricing")
        return
      }

      // Use the selected price ID or the first available price
      const priceId = selectedPriceId || allPrices[0]?.id
      if (!priceId) {
        throw new Error("No price available for this product")
      }

      // Create checkout session with the specific price ID
      await createCheckoutSessionWithPriceId(priceId)
    } catch (error) {
      console.error("Error creating checkout session:", error)
      alert("Failed to start checkout. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const styling = getCardStyling()

  return (
    <Card className={styling.cardClass}>
      {/* Badge for popular or urgency */}
      {(popular || endDateUrgency !== 'normal') && (
        <Badge className={`absolute -top-2 left-1/2 -translate-x-1/2 ${styling.badgeClass}`}>
          {endDateUrgency !== 'normal' ? styling.badgeText : 'Most Popular'}
        </Badge>
      )}
      
      {image && (
        <div className="relative h-32 w-full">
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover rounded-t-lg"
          />
        </div>
      )}
      
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        
        {/* Price Display */}
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">{price}</span>
          <span className="text-muted-foreground">
            {getIntervalText(interval, intervalCount)}
          </span>
        </div>

        {/* End Date Display */}
        {endsOn && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{formatEndDate(endsOn)}</span>
          </div>
        )}

        {/* Multiple Price Options */}
        {allPrices.length > 1 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Billing options:</p>
            <div className="flex flex-wrap gap-2">
              {allPrices.map((priceOption) => (
                <Button
                  key={priceOption.id}
                  variant={selectedPriceId === priceOption.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPriceId(priceOption.id)}
                  className="text-xs"
                >
                  {priceOption.interval ? 
                    `${priceOption.interval}${priceOption.interval_count && priceOption.interval_count > 1 ? ` (${priceOption.interval_count})` : ''}` : 
                    'One-time'
                  }
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {features.length > 0 && (
          <ul className="space-y-3">
            {features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm">{feature}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      
      <CardFooter>
        <Button
          className="w-full"
          onClick={handleSubscribe}
          disabled={loading}
          variant={popular ? "default" : "outline"}
        >
          {loading ? "Processing..." : "Get Started"}
        </Button>
      </CardFooter>
    </Card>
  )
}

// Helper function to create checkout session with specific price ID
async function createCheckoutSessionWithPriceId(priceId: string) {
  try {
    const response = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ priceId }),
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
    console.error("Error creating checkout session:", error)
    throw error
  }
}
