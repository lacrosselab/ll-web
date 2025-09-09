import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"

export async function GET() {
  try {
    // Fetch all active products from Stripe
    const products = await stripe.products.list({
      active: true,
      expand: ['data.default_price']
    })

    // Fetch all active prices to get complete pricing information
    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product']
    })

    // Group prices by product
    const productsWithPrices = products.data.map(product => {
      const productPrices = prices.data.filter(price => 
        typeof price.product === 'object' && price.product.id === product.id
      )

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        images: product.images,
        metadata: product.metadata,
        prices: productPrices.map(price => ({
          id: price.id,
          unit_amount: price.unit_amount,
          currency: price.currency,
          interval: price.recurring?.interval || null,
          interval_count: price.recurring?.interval_count || null,
          type: price.type,
          metadata: price.metadata
        }))
      }
    })

    // Filter out products that don't have any active prices
    const activeProducts = productsWithPrices.filter(product => product.prices.length > 0)

    return NextResponse.json({
      products: activeProducts,
      count: activeProducts.length
    })

  } catch (error) {
    console.error("Error fetching Stripe products:", error)
    return NextResponse.json(
      { error: "Failed to fetch products" }, 
      { status: 500 }
    )
  }
}