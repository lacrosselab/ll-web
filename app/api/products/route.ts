import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase/server"
import { stripe } from "@/lib/stripe"
import { logger } from "@/lib/utils"

export async function GET() {
  try {
    const supabase = await getSupabaseServer()
    
    // Fetch active products from database
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('session_date', { ascending: true })

    if (error) {
      logger.error("[API] Error fetching products from database:", error)
      const response = NextResponse.json(
        { error: "Failed to fetch products", details: error.message }, 
        { status: 500 }
      )
      response.headers.set('Cache-Control', 'no-store')
      return response
    }

    logger.info(`[API] Fetched ${products?.length || 0} active products from database`)

    // Verify Stripe sync for each product
    const verifiedProducts = []
    for (const product of products || []) {
      try {
        // Check if Stripe product is also active
        const stripeProduct = await stripe.products.retrieve(product.stripe_product_id)
        
        // If database says active but Stripe says inactive, skip this product
        if (!stripeProduct.active) {
          logger.warn(`[API] Product "${product.name}" (ID: ${product.id}) is active in DB but inactive in Stripe - skipping`)
          continue
        }
        
        logger.info(`[API] Product "${product.name}" (ID: ${product.id}) verified: active in DB and Stripe, session_date: ${product.session_date}, stock: ${product.stock_quantity}`)
        verifiedProducts.push(product)
      } catch (stripeError) {
        logger.error(`[API] Error verifying Stripe product "${product.name}" (ID: ${product.id}, Stripe ID: ${product.stripe_product_id}):`, stripeError)
        // If we can't verify with Stripe, skip this product to be safe
        continue
      }
    }

    logger.info(`[API] Stripe verification complete: ${verifiedProducts.length} of ${products?.length || 0} products verified and will be returned`)

    // Transform database products to match the expected format
    const transformedProducts = verifiedProducts.map((product) => {
      
      logger.debug('Transforming product with active status:', product.is_active, 'type:', typeof product.is_active, 'value:', product.is_active)
      return (
        {
        id: product.id,
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
        is_active: product.is_active, // Explicitly ensure boolean type
        is_high_school: product.is_high_school
    })
    })

    logger.info(`[API] Returning ${transformedProducts.length} transformed products to client`)

    return NextResponse.json({
      products: transformedProducts,
      count: transformedProducts.length
    })

  } catch (error) {
    logger.error("[API] Error fetching products:", error)
    return NextResponse.json(
      { error: "Failed to fetch products", details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    )
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