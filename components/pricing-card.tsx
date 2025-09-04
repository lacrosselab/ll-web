"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check } from "lucide-react"
import type { PriceInterval } from "@/lib/stripe"

interface PricingCardProps {
  title: string
  description: string
  price: string
  interval: PriceInterval
  features: string[]
  popular?: boolean
  onSubscribe: (interval: PriceInterval) => void
  loading?: boolean
}

export function PricingCard({
  title,
  description,
  price,
  interval,
  features,
  popular = false,
  onSubscribe,
  loading = false,
}: PricingCardProps) {
  return (
    <Card className={`relative ${popular ? "border-primary shadow-lg" : ""}`}>
      {popular && <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">Most Popular</Badge>}
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">{price}</span>
          <span className="text-muted-foreground">/{interval}</span>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={() => onSubscribe(interval)}
          disabled={loading}
          variant={popular ? "default" : "outline"}
        >
          {loading ? "Processing..." : "Get Started"}
        </Button>
      </CardFooter>
    </Card>
  )
}
