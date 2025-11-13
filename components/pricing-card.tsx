"use client"
import { ProductCard } from "@/components/product-card"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

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
  stockQuantity?: number
  sessionDate?: string
  endDate?: string
  isHighSchool?: boolean | null
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
  stockQuantity = 0,
  sessionDate = '',
  endDate,
  isHighSchool,
}: PricingCardProps) {
  return (
    <ProductCard
      mode="user"
      productId={productId}
      title={title}
      description={description}
      price={price}
      interval={interval}
      intervalCount={intervalCount}
      features={features}
      popular={popular}
      image={image}
      allPrices={allPrices}
      endDateUrgency={endDateUrgency}
      sessionDate={sessionDate}
      endDate={endDate}
      stockQuantity={stockQuantity}
      isHighSchool={isHighSchool}
    />
  )
}

export function PricingCardSkeleton() {
  return (
    <Card className="relative">
      <CardHeader>
        <Skeleton className="h-8 w-3/4 mb-4" />
        <Skeleton className="h-6 w-24 mb-2" />
        <div className="flex items-center gap-2 py-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-9 w-32 mb-4" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <Skeleton className="h-4 w-24 mt-4" />
      </CardHeader>
      <CardFooter>
        <Skeleton className="h-10 w-full" />
      </CardFooter>
    </Card>
  )
}
