"use client"
import { ProductCard } from "@/components/product-card"

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
    />
  )
}
