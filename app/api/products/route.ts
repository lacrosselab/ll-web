import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase/server"
import { logger } from "@/lib/utils"
import { stripe } from "@/lib/stripe"

export async function GET() {
  try {
    const supabase = await getSupabaseServer()
    
    // Fetch active products from database with product_sessions
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        *,
        product_sessions (
          id,
          session_date,
          session_time,
          location
        )
      `)
      .eq('is_active', true)

    if (error) {
      logger.error("Error fetching products from database:", { error: error.message || 'Unknown error' })
      const response = NextResponse.json(
        { error: "Failed to fetch products", details: error.message }, 
        { status: 500 }
      )
      response.headers.set('Cache-Control', 'no-store')
      response.headers.set('Pragma', 'no-cache')
      return response
    }

    logger.info("Products fetched from database:", { products: products })
    // Verify Stripe sync for each product
    const verifiedProducts = []
    for (const product of products) {
      try {
        // Check if Stripe product is also active
        const stripeProduct = await stripe.products.retrieve(product.stripe_product_id)
        
        // If database says active but Stripe says inactive, skip this product
        if (!stripeProduct.active) {
          logger.warn(`Product is active in DB but inactive in Stripe - skipping`)
          continue
        }
        
        verifiedProducts.push(product)
        
        // Log included product with transformation details
        const eligibilityWindow = product.end_date 
          ? `${product.session_date} to ${product.end_date}`
          : product.session_date
        logger.info(`[API] Product included: id=${product.id}, name="${product.name}", is_active=${product.is_active}, session_date=${product.session_date}, end_date=${product.end_date || 'null'}, eligibility_window=${eligibilityWindow}`)
      } catch (stripeError) {
        logger.error(`Error verifying Stripe product`, { error: stripeError instanceof Error ? stripeError.message : 'Unknown error' })
        // If we can't verify with Stripe, skip this product to be safe
        continue
      }
    }

    logger.info(`[API] Filtering summary: total_fetched=${products?.length || 0}, included=${verifiedProducts.length}`)

    // Transform database products to match the expected format
    const transformedProducts = verifiedProducts.map(product => {
      // Sort sessions by date and time
      const sessions = (product.product_sessions || []).sort((a: any, b: any) => {
        const dateA = new Date(`${a.session_date}T${a.session_time}`)
        const dateB = new Date(`${b.session_date}T${b.session_time}`)
        return dateA.getTime() - dateB.getTime()
      })

      // Use first session date for metadata compatibility (if sessions exist)
      const firstSessionDate = sessions.length > 0 ? sessions[0].session_date : product.session_date

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        images: [], // We can add images later if needed
        metadata: {
          // Use database fields instead of Stripe metadata
          'ends-on': formatDateForMetadata(firstSessionDate),
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
        session_date: product.session_date, // Keep for backward compatibility
        stock_quantity: product.stock_quantity,
        is_active: product.is_active,
        gender: product.gender,
        min_grade: product.min_grade,
        max_grade: product.max_grade,
        skill_level: product.skill_level,
        sessions: sessions // Array of all session times
      }
    })

    const response = NextResponse.json({
      products: transformedProducts,
      count: transformedProducts.length
    })
    
    // Set cache headers on successful responses
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Pragma', 'no-cache')
    
    return response

  } catch (error) {
    logger.error("Error fetching products:", { error: error instanceof Error ? error.message : 'Unknown error' })
    const errorResponse = NextResponse.json(
      { error: "Failed to fetch products", details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    )
    errorResponse.headers.set('Cache-Control', 'no-store')
    errorResponse.headers.set('Pragma', 'no-cache')
    return errorResponse
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