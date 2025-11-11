import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase/server"
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

    // Consolidate active/inactive filtering on server
    const now = new Date()
    const nowStartOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    
    const eligibleProducts = []
    const skipReasons: Record<string, number> = {
      inactive: 0,
      date_passed: 0,
      out_of_stock: 0
    }
    
    for (const product of products || []) {
      // Treat is_active as strict boolean
      const isActive = !!product.is_active
      
      // Check if product is active in database
      if (!isActive) {
        logger.info(`[API] Product skipped: id=${product.id}, name="${product.name}", is_active=${product.is_active} (${typeof product.is_active}), session_date=${product.session_date}, end_date=${product.end_date || 'null'}, stock_quantity=${product.stock_quantity}, reason=inactive`)
        skipReasons.inactive++
        continue
      }
      
      // Parse session_date and optional end_date for eligibility check
      const [sessionYear, sessionMonth, sessionDay] = product.session_date.split('-').map(Number)
      const sessionDate = new Date(Date.UTC(sessionYear, sessionMonth - 1, sessionDay))
      
      // Compute eligibilityEnd = end_date ?? session_date
      const eligibilityDate = product.end_date || product.session_date
      const [eligibilityYear, eligibilityMonth, eligibilityDay] = eligibilityDate.split('-').map(Number)
      const eligibilityEndDate = new Date(Date.UTC(eligibilityYear, eligibilityMonth - 1, eligibilityDay))
      const eligibilityEndStartOfDay = new Date(Date.UTC(eligibilityEndDate.getUTCFullYear(), eligibilityEndDate.getUTCMonth(), eligibilityEndDate.getUTCDate()))
      
      // Compare nowStartOfDay against eligibilityEndStartOfDay
      if (nowStartOfDay > eligibilityEndStartOfDay) {
        const cutoffUsed = product.end_date ? 'end_date' : 'session_date'
        logger.info(`[API] Product skipped: id=${product.id}, name="${product.name}", is_active=${product.is_active} (${typeof product.is_active}), session_date=${product.session_date}, end_date=${product.end_date || 'null'}, stock_quantity=${product.stock_quantity}, reason=date_passed, cutoff_used=${cutoffUsed}`)
        skipReasons.date_passed++
        continue
      }
      
      // Check stock
      if (product.stock_quantity <= 0) {
        logger.info(`[API] Product skipped: id=${product.id}, name="${product.name}", is_active=${product.is_active} (${typeof product.is_active}), session_date=${product.session_date}, end_date=${product.end_date || 'null'}, stock_quantity=${product.stock_quantity}, reason=out_of_stock`)
        skipReasons.out_of_stock++
        continue
      }
      
      // Log included product with transformation details
      const eligibilityWindow = product.end_date 
        ? `${product.session_date} to ${product.end_date}`
        : product.session_date
      logger.info(`[API] Product included: id=${product.id}, name="${product.name}", is_active_raw=${product.is_active} (${typeof product.is_active}), is_active_transformed=${isActive}, session_date=${product.session_date}, end_date=${product.end_date || 'null'}, eligibility_window=${eligibilityWindow}`)
      eligibleProducts.push(product)
    }

    logger.info(`[API] Filtering summary: total_fetched=${products?.length || 0}, included=${eligibleProducts.length}, skipped_inactive=${skipReasons.inactive}, skipped_date_passed=${skipReasons.date_passed}, skipped_out_of_stock=${skipReasons.out_of_stock}`)

    // Transform database products to match the expected format
    const transformedProducts = eligibleProducts.map((product) => {
      // Treat is_active as strict boolean
      const isActive = !!product.is_active
      
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
        is_active: isActive, // Strict boolean
        is_high_school: product.is_high_school
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