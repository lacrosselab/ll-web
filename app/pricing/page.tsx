"use client"

import { PricingCard } from "@/components/pricing-card"
import { createCheckoutSession } from "@/lib/checkout"
import { useEffect, useState } from "react"
import { formatDateOnly, formatDateRange, logger, parseDateOnlyUTC } from "@/lib/utils"

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
  end_date?: string
  stock_quantity: number
  is_active: boolean
  is_high_school?: boolean | null
}

interface ProductsResponse {
  products: Product[]
  count: number
}

// Date utility functions - simplified for database-first approach
function isProductActive(product: Product): boolean {
  logger.warn('Checking active status on stripe product ID:', product?.stripe_product_id)
  // Check if product is active in database - use strict boolean check to avoid type coercion issues
  if (product.is_active !== true) {
    logger.warn(`[PAGE] Product "${product.name}" (ID: ${product.id}) filtered: is_active is not true. Value: ${product.is_active}, Type: ${typeof product.is_active}`)
    return false
  }
  
  // Check if session date has passed using UTC to avoid timezone issues
  const parseDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day))
  }
  
  const sessionDate = parseDate(product.session_date)
  const now = new Date()
  
  // Compare dates at start of day to include the full session day
  const sessionStartOfDay = new Date(Date.UTC(sessionDate.getUTCFullYear(), sessionDate.getUTCMonth(), sessionDate.getUTCDate()))
  const nowStartOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  
  const isActive = nowStartOfDay <= sessionStartOfDay
  if (!isActive) {
    logger.debug(`[PAGE] Product "${product.name}" (ID: ${product.id}) filtered: session_date (${product.session_date}) has passed. Now: ${nowStartOfDay.toISOString()}, Session: ${sessionStartOfDay.toISOString()}`)
  } else {
    logger.debug(`[PAGE] Product "${product.name}" (ID: ${product.id}) active check passed: session_date=${product.session_date}, is_active=true`)
  }
  
  return isActive
}

function isProductInStock(product: Product): boolean {
  const inStock = product.stock_quantity > 0
  if (!inStock) {
    logger.debug(`[PAGE] Product "${product.name}" (ID: ${product.id}) filtered: out of stock (stock_quantity=${product.stock_quantity})`)
  } else {
    logger.debug(`[PAGE] Product "${product.name}" (ID: ${product.id}) stock check passed: stock_quantity=${product.stock_quantity}`)
  }
  return inStock
}

function getDaysUntilSession(sessionDate: string): number {
  const session = parseDateOnlyUTC(sessionDate)
  const now = new Date()
  const sessionStartOfDay = new Date(Date.UTC(session.getUTCFullYear(), session.getUTCMonth(), session.getUTCDate()))
  const nowStartOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const diffTime = sessionStartOfDay.getTime() - nowStartOfDay.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

function formatSessionDate(sessionDate: string, endDate?: string): string {
  const session = parseDateOnlyUTC(sessionDate)
  const daysUntilSession = getDaysUntilSession(sessionDate)
  
  // If we have an end date, show the date range
  if (endDate) {
    const end = parseDateOnlyUTC(endDate)
    const startFormatted = session.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    })
    const endFormatted = end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    })
    
    if (daysUntilSession <= 0) return `Session ${startFormatted} - ${endFormatted} (has passed)`
    if (daysUntilSession === 1) return `Session ${startFormatted} - ${endFormatted} (soon)`
    if (daysUntilSession <= 7) return `Session ${startFormatted} - ${endFormatted} (in ${daysUntilSession} days)`
    
    return `Session ${startFormatted} - ${endFormatted}`
  }
  
  // Original single date logic
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

function getSessionUrgency(sessionDate: string): 'normal' | 'ending-soon' | 'ending-very-soon' {
  const daysUntilSession = getDaysUntilSession(sessionDate)
  
  if (daysUntilSession <= 2) return 'ending-very-soon'
  if (daysUntilSession <= 7) return 'ending-soon'
  return 'normal'
}

// Client-side function to fetch products
async function fetchProducts(): Promise<Product[]> {
  try {
    const response = await fetch('/api/products', {
      cache: 'no-store' // Ensure fresh data on each request
    })
    
    if (!response.ok) {
      logger.error(`[PAGE] Failed to fetch products: ${response.status} ${response.statusText}`)
      return []
    }
    
    const data: ProductsResponse = await response.json()
    logger.info(`[PAGE] Received ${data.products.length} products from API (IDs: ${data.products.map(p => p.id).join(', ')})`)
    
    // Filter products based on new logic
    const activeProducts = data.products.filter(product => {
      const isActive = isProductActive(product)
      const inStock = isProductInStock(product)
      const passesFilter = isActive && inStock
      
      if (!passesFilter) {
        logger.warn(`[PAGE] Product "${product.name}" (ID: ${product.id}) filtered out: isActive=${isActive}, inStock=${inStock}`)
      } else {
        logger.debug(`[PAGE] Product "${product.name}" (ID: ${product.id}) passed all filters`)
      }
      
      return passesFilter
    })
    
    logger.info(`[PAGE] Filtering complete: ${activeProducts.length} of ${data.products.length} products will be displayed`)
    
    return activeProducts
  } catch (error) {
    logger.error(`[PAGE] Error fetching products:`, error)
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

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true)
        setError(null)
        const fetchedProducts = await fetchProducts()
        logger.info(`[PAGE] Setting ${fetchedProducts.length} products for display`)
        setProducts(fetchedProducts)
      } catch (err) {
        logger.error(`[PAGE] Error loading products:`, err)
        setError('Failed to load products. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    loadProducts()
  }, [])
  
  return (
    <div className="min-h-screen bg-background">
      <div className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">Available Sessions</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our available sessions are listed below. If you don't see a session that works for you, please contact us
              at <a href="mailto:hello@thelacrosselab.com" className="text-primary hover:underline">hello@thelacrosselab.com</a>.
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4" />
              <p className="text-muted-foreground">Loading available sessions...</p>
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
                
                const sessionUrgency = getSessionUrgency(product.session_date)
                
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
                    // Use session date for display
                    endsOn={formatSessionDate(product.session_date, product.end_date)}
                    endDateUrgency={sessionUrgency}
                    // Add new props for stock and session info
                    stockQuantity={product.stock_quantity}
                    sessionDate={product.session_date}
                    endDate={product.end_date}
                    isHighSchool={product.is_high_school}
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
