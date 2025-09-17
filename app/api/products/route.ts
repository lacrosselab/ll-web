import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase/server"

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
      console.error("Error fetching products from database:", error)
      return NextResponse.json(
        { error: "Failed to fetch products", details: error.message }, 
        { status: 500 }
      )
    }

    // Transform database products to match the expected format
    const transformedProducts = products.map(product => ({
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
      stock_quantity: product.stock_quantity,
      is_active: product.is_active
    }))

    return NextResponse.json({
      products: transformedProducts,
      count: transformedProducts.length
    })

  } catch (error) {
    console.error("Error fetching products:", error)
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