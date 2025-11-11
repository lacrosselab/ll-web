import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase/server"
import { stripe } from "@/lib/stripe"
import { logger } from "@/lib/utils"

export async function GET() {
  try {
    const supabase = await getSupabaseServer()
    
    // Fetch all products from database (we'll filter on server)
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .order('session_date', { ascending: true })

    if (error) {
      logger.error("[API] Error fetching products from database:", error)
      const response = NextResponse.json(
        { error: "Failed to fetch products", details: error.message }, 
        { status: 500 }
      )
      response.headers.set('Cache-Control', 'no-store')
      response.headers.set('Pragma', 'no-cache')
      return response
    }

    logger.info(
      `[API] Fetched ${products?.length || 0} products from database`,
      products
        ? `Active states: ${products.map(p => `${p.id}:${(p.is_active)}`).join(', ')}`
        : "No products"
    )

    // Consolidate active/inactive filtering on server
    const now = new Date()
    const nowStartOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    
    const eligibleProducts = []
    for (const product of products || []) {
      // Normalize is_active to boolean
      const normalizedActive = product.is_active === true || product.is_active === 'true' || product.is_active === 't' || product.is_active === 1
      
      if (normalizedActive !== product.is_active) {
        logger.warn(`[API] Product "${product.name}" (ID: ${product.id}) is_active normalized: raw=${product.is_active} (${typeof product.is_active}), normalized=${normalizedActive}`)
      }
      
      // Check if product is active in database
      if (!normalizedActive) {
        logger.info(`[API] Product "${product.name}" (ID: ${product.id}) filtered: is_active is false (normalized)`)
        continue
      }
      
      // Verify Stripe sync
      try {
        const stripeProduct = await stripe.products.retrieve(product.stripe_product_id)
        
        if (!stripeProduct.active) {
          logger.warn(`[API] Product "${product.name}" (ID: ${product.id}) filtered: active in DB but inactive in Stripe`)
          continue
        }
      } catch (stripeError) {
        logger.error(`[API] Product "${product.name}" (ID: ${product.id}, Stripe ID: ${product.stripe_product_id}) filtered: error verifying with Stripe:`, stripeError)
        continue
      }
      
      // Check if session date has passed
      const [year, month, day] = product.session_date.split('-').map(Number)
      const sessionDate = new Date(Date.UTC(year, month - 1, day))
      const sessionStartOfDay = new Date(Date.UTC(sessionDate.getUTCFullYear(), sessionDate.getUTCMonth(), sessionDate.getUTCDate()))
      
      if (nowStartOfDay > sessionStartOfDay) {
        logger.info(`[API] Product "${product.name}" (ID: ${product.id}) filtered: session_date (${product.session_date}) has passed`)
        continue
      }
      
      // Check stock
      if (product.stock_quantity <= 0) {
        logger.info(`[API] Product "${product.name}" (ID: ${product.id}) filtered: out of stock (stock_quantity=${product.stock_quantity})`)
        continue
      }
      
      logger.info(`[API] Product "${product.name}" (ID: ${product.id}) eligible: active=true, session_date=${product.session_date}, stock=${product.stock_quantity}`)
      eligibleProducts.push(product)
    }

    logger.info(`[API] Server filtering complete: ${eligibleProducts.length} of ${products?.length || 0} products eligible`)

    // Transform database products to match the expected format
    const transformedProducts = eligibleProducts.map((product) => {
      // Normalize is_active to boolean
      const normalizedActive = product.is_active === true || product.is_active === 'true' || product.is_active === 't' || product.is_active === 1
      
      return {
        id: product.id,
        stripe_product_id: product.stripe_product_id,
        name: product.name,
        description: product.description,
        images: [], // We can add images later if needed
        metadata: {
          // Use database fields instead of Stripe metadata
          'ends-on': formatDateForMetadata(product.session_date),
          'features': product.description || '', // Use description as features for now
        },
        prices: [{
          id: product.stripe_price_id,
          unit_amount: product.price_cents,
          currency: product.currency,
          interval: null, // These are one-time payments
          interval_count: null,
          type: 'one_time',
          metadata: {}
        }],
        // Add our new fields 
        session_date: product.session_date,
        end_date: product.end_date,
        stock_quantity: product.stock_quantity,
        is_active: normalizedActive, // Normalized to boolean
        is_high_school: product.is_high_school
      }
    })

    logger.info(`[API] Returning ${transformedProducts.length} transformed products to client`)

    const response = NextResponse.json({
      products: transformedProducts,
      count: transformedProducts.length
    })
    
    // Set cache headers on successful responses
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Pragma', 'no-cache')
    
    return response

  } catch (error) {
    logger.error("[API] Error fetching products:", error)
    const response = NextResponse.json(
      { error: "Failed to fetch products", details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    )
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Pragma', 'no-cache')
    return response
  }
}

// Helper function to format session date for metadata compatibility
function formatDateForMetadata(sessionDate: string): string {
  const date = new Date(sessionDate)
  const month = date.getMonth() + 1 // getMonth() is 0-indexed
  const day = date.getDate()
  const year = date.getFullYear()
  return `${month}/${day}/${year}`
}