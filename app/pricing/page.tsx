"use client"

import { PricingCard, PricingCardSkeleton } from "@/components/pricing-card"
import { createCheckoutSession } from "@/lib/checkout"
import { useEffect, useState, useMemo } from "react"
import { formatDateOnly, formatDateRange, parseDateOnlyUTC, logger } from "@/lib/utils"

// Types for our database product data
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

interface Product {
  id: string
  stripe_product_id: string,
  name: string
  description: string | null
  images: string[]
  metadata: Record<string, string>
  prices: ProductPrice[]
  // New fields from our database
  session_date: string
  stock_quantity: number
  is_active: boolean
  gender?: string | null
  min_grade?: string | null
  max_grade?: string | null
  skill_level?: string | null
  sessions?: ProductSession[]
}

interface ProductsResponse {
  products: Product[]
  count: number
}

// Date utility functions - simplified for database-first approach
// These functions use new Date() and should only be called client-side after mount
function isProductActive(product: Product, now?: Date): boolean {
  // Check if product is active in database
  if (!product.is_active) return false
  
  // If no date provided (SSR), return true to avoid filtering out products
  if (!now) return true
  
  // Check if session date has passed using UTC to avoid timezone issues
  const parseDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day))
  }
  
  const sessionDate = parseDate(product.session_date)
  
  // Compare dates at start of day to include the full session day
  const sessionStartOfDay = new Date(Date.UTC(sessionDate.getUTCFullYear(), sessionDate.getUTCMonth(), sessionDate.getUTCDate()))
  const nowStartOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  
  return nowStartOfDay <= sessionStartOfDay
}

function isProductInStock(product: Product): boolean {
  return product.stock_quantity > 0
}

function getDaysUntilSession(sessionDate: string, now?: Date): number {
  if (!now) return 0 // Default during SSR
  
  const session = parseDateOnlyUTC(sessionDate)
  const sessionStartOfDay = new Date(Date.UTC(session.getUTCFullYear(), session.getUTCMonth(), session.getUTCDate()))
  const nowStartOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const diffTime = sessionStartOfDay.getTime() - nowStartOfDay.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

function formatSessionDate(sessionDate: string, now?: Date): string {
  if (!now) return 'Session date' // Default during SSR
  
  const session = parseDateOnlyUTC(sessionDate)
  const daysUntilSession = getDaysUntilSession(sessionDate, now)
  
  if (daysUntilSession <= 0) return 'Session has passed'
  if (daysUntilSession === 1) return 'Session soon'
  if (daysUntilSession <= 7) return `Session in ${daysUntilSession} days`
  
  return `Session ${session.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    timeZone: 'UTC'
  })}`
}

function getSessionUrgency(sessionDate: string, now?: Date): 'normal' | 'ending-soon' | 'ending-very-soon' {
  if (!now) return 'normal' // Default during SSR
  
  const daysUntilSession = getDaysUntilSession(sessionDate, now)
  
  if (daysUntilSession <= 2) return 'ending-very-soon'
  if (daysUntilSession <= 7) return 'ending-soon'
  return 'normal'
}

// Client-side function to fetch products
async function fetchProducts(now?: Date): Promise<Product[]> {
  try {
    const response = await fetch('/api/products', {
      cache: 'no-store' // Ensure fresh data on each request
    })
    
    if (!response.ok) {
      logger.error('Failed to fetch products', { status: response.status, statusText: response.statusText })
      return []
    }
    
    const data: ProductsResponse = await response.json()
    
    // Filter products based on new logic
    // Only filter by date if we have a date (client-side)
    const activeProducts = data.products.filter(product => 
      isProductActive(product, now) && isProductInStock(product)
    )
    
    return activeProducts
  } catch (error) {
    logger.error('Error fetching products', { error })
    return []
  }
}

// Format price for display
function formatPrice(amount: number | null, currency: string): string {
  if (!amount) return 'Contact us'
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  })
  
  return formatter.format(amount / 100)
}

// Get interval display text
function getIntervalText(interval: string | null, intervalCount: number | null): string {
  if (interval === 'one-time') return ''
  
  if (intervalCount && intervalCount > 1) {
    return `/${intervalCount} ${interval}s`
  }
  
  return `/${interval}`
}

// Check if a product should be marked as popular
function isPopular(product: Product): boolean {
  return product.metadata.popular === 'true'
}

// Get features from metadata - simplified
function getFeatures(product: Product): string[] {
  const featuresString = product.metadata.features
  if (featuresString) {
    return featuresString.split(',').map(f => f.trim()).filter(f => f.length > 0)
  }
  
  // Return empty array if no features defined
  return []
}

export default function PricingPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // Track when component has mounted (client-side only)
  useEffect(() => {
    setMounted(true)
    
    // Fetch products only after mount to avoid hydration issues
    const loadProducts = async () => {
      try {
        setLoading(true)
        setError(null)
        // Use current date for filtering (client-side only)
        const now = new Date()
        const fetchedProducts = await fetchProducts(now)
        setProducts(fetchedProducts)
      } catch (err) {
        logger.error('Error loading products', { error: err })
        setError('Failed to load products. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    loadProducts()
  }, [])
  
  // Get current date only after mount (client-side) for date-dependent calculations
  const now = useMemo(() => {
    return mounted ? new Date() : undefined
  }, [mounted])
  
  return (
    <div className="min-h-screen bg-background">
      <div className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">Available Sessions</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our available sessions are listed below. If you don't see a session that works for you, please contact us
              at <a href="mailto:carter@thelacrosselab.com" className="text-primary hover:underline">carter@thelacrosselab.com</a>.
            </p>
          </div>

          {loading ? (
            <div className="grid gap-8 max-w-7xl mx-auto">
              <PricingCardSkeleton />
              <PricingCardSkeleton />
              <PricingCardSkeleton />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          ) : products.length > 0 ? (
            <div className="grid gap-8 max-w-7xl mx-auto">
              {products.map((product) => {
                // Show the first (and likely only) price
                const displayPrice = product.prices[0]
                
                if (!displayPrice) return null
                
                // Only compute date-dependent values after mount
                const sessionUrgency = mounted ? getSessionUrgency(product.session_date, now) : 'normal'
                
                return (
                  <PricingCard
                    key={product.id}
                    productId={product.id}
                    title={product.name}
                    description={product.description || ""}
                    price={formatPrice(displayPrice.unit_amount, displayPrice.currency)}
                    interval={displayPrice.interval || 'one-time'}
                    intervalCount={displayPrice.interval_count}
                    features={getFeatures(product)}
                    popular={isPopular(product)}
                    image={product.images[0]}
                    allPrices={product.prices}
                    endDateUrgency={sessionUrgency}
                    // Add new props for stock and session info
                    stockQuantity={product.stock_quantity}
                    sessionDate={product.session_date}
                    gender={product.gender}
                    minGrade={product.min_grade}
                    maxGrade={product.max_grade}
                    skillLevel={product.skill_level}
                    sessions={product.sessions}
                  />
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No sessions available at the moment.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Check back soon for new training sessions!
              </p>
            </div>
          )}

          {/* FAQ Section */}
          <div className="mt-20">
            <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div>
                <h3 className="font-semibold mb-2">What's included in each session?</h3>
                <p className="text-muted-foreground">
                  Each session includes personalized coaching, skill development, and access to our training facilities.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">How do I book a session?</h3>
                <p className="text-muted-foreground">
                  Simply select the session you want and complete the purchase. You'll receive confirmation details via email.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
                <p className="text-muted-foreground">
                  We accept all major credit cards through our secure payment system.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Do you offer refunds?</h3>
                <p className="text-muted-foreground">
                  Yes, we offer refunds for sessions cancelled at least 24 hours in advance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
