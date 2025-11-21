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

interface ProductSession {
  id?: string
  session_date: string
  session_time: string
  location?: string | null
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
  endDateUrgency?: 'normal' | 'ending-soon' | 'ending-very-soon'
  stockQuantity?: number
  sessionDate?: string
  gender?: string | null
  minGrade?: string | null
  maxGrade?: string | null
  skillLevel?: string | null
  sessions?: ProductSession[]
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
  endDateUrgency = 'normal',
  stockQuantity = 0,
  sessionDate = '',
  gender,
  minGrade,
  maxGrade,
  skillLevel,
  sessions,
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
      stockQuantity={stockQuantity}
      gender={gender}
      minGrade={minGrade}
      maxGrade={maxGrade}
      skillLevel={skillLevel}
      sessions={sessions}
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
