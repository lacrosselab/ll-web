"use client"

import { PricingCard } from "@/components/pricing-card"
import { createCheckoutSession } from "@/lib/checkout"
import { useEffect, useState } from "react"

// Types for our dynamic product data
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
  name: string
  description: string | null
  images: string[]
  metadata: Record<string, string>
  prices: ProductPrice[]
}

interface ProductsResponse {
  products: Product[]
  count: number
}

// Date utility functions
function parseEndDate(endsOnString: string): Date | null {
  try {
    // Parse MM/DD/YYYY format
    const [month, day, year] = endsOnString.split('/').map(Number)
    return new Date(year, month - 1, day) // month is 0-indexed in Date constructor
  } catch {
    return null
  }
}

function isProductActive(endsOnString: string | undefined): boolean {
  if (!endsOnString) return true // No end date means always active
  
  const endDate = parseEndDate(endsOnString)
  if (!endDate) return true // Invalid date means always active
  
  const now = new Date()
  // Set time to end of day for the end date to include the full day
  endDate.setHours(23, 59, 59, 999)
  
  return now <= endDate
}

function getDaysUntilEnd(endsOnString: string): number {
  const endDate = parseEndDate(endsOnString)
  if (!endDate) return Infinity
  
  const now = new Date()
  const diffTime = endDate.getTime() - now.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

function formatEndDate(endsOnString: string): string {
  const endDate = parseEndDate(endsOnString)
  if (!endDate) return ''
  
  const daysUntilEnd = getDaysUntilEnd(endsOnString)
  
  if (daysUntilEnd <= 0) return 'Ended'
  if (daysUntilEnd === 1) return 'Ends tomorrow'
  if (daysUntilEnd <= 7) return `Ends in ${daysUntilEnd} days`
  
  // Format as "Ends Dec 25, 2024"
  return `Ends ${endDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  })}`
}

function getEndDateUrgency(endsOnString: string): 'normal' | 'ending-soon' | 'ending-very-soon' {
  const daysUntilEnd = getDaysUntilEnd(endsOnString)
  
  if (daysUntilEnd <= 2) return 'ending-very-soon'
  if (daysUntilEnd <= 7) return 'ending-soon'
  return 'normal'
}

// Client-side function to fetch products
async function fetchProducts(): Promise<Product[]> {
  try {
    const response = await fetch('/api/products', {
      cache: 'no-store' // Ensure fresh data on each request
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch products')
    }
    
    const data: ProductsResponse = await response.json()
    
    // Filter out products that have passed their end date
    const activeProducts = data.products.filter(product => 
      isProductActive(product.metadata['ends-on'])
    )
    
    return activeProducts
  } catch (error) {
    console.error('Error fetching products:', error)
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

// Get features from metadata only - no defaults
function getFeatures(product: Product): string[] {
  const featuresString = product.metadata.features
  if (featuresString) {
    return featuresString.split(',').map(f => f.trim()).filter(f => f.length > 0)
  }
  
  // Return empty array if no features defined in Stripe
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
        setProducts(fetchedProducts)
      } catch (err) {
        console.error('Error loading products:', err)
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
              at <a href="mailto:hello@lacrosselab.com" className="text-primary hover:underline">hello@lacrosselab.com</a>.
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
            <div className={`grid gap-8 max-w-6xl mx-auto ${
              products.length === 1 ? 'grid-cols-1 max-w-md' :
              products.length === 2 ? 'md:grid-cols-2' :
              products.length === 3 ? 'md:grid-cols-3' :
              'md:grid-cols-2 lg:grid-cols-3'
            }`}>
              {products.map((product) => {
                // For now, we'll show the first recurring price, or first price if no recurring
                const recurringPrice = product.prices.find(p => p.type === 'recurring')
                const displayPrice = recurringPrice || product.prices[0]
                
                if (!displayPrice) return null
                
                const endsOn = product.metadata['ends-on']
                const endDateUrgency = endsOn ? getEndDateUrgency(endsOn) : 'normal'
                
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
                    endsOn={endsOn}
                    endDateUrgency={endDateUrgency}
                  />
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No products available at the moment.</p>
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
