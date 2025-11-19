import { stripe } from './stripe'
import { logger } from './utils'

export interface CreateProductData {
  name: string
  description: string | null
  price_cents: number
  currency?: string
}

export interface StripeProductResult {
  productId: string
  priceId: string
}

export async function createStripeProduct(data: CreateProductData): Promise<StripeProductResult> {
  try {
    // Create the product in Stripe
    const product = await stripe.products.create({
      name: data.name,
      description: data.description || undefined,
      active: true,
    })

    // Create the price for the product
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: data.price_cents,
      currency: data.currency || 'usd',
    })

    return {
      productId: product.id,
      priceId: price.id,
    }
  } catch (error) {
    logger.error('Error creating Stripe product', { error })
    throw new Error('Failed to create Stripe product')
  }
}

export async function updateStripeProduct(
  productId: string, 
  priceId: string, 
  data: CreateProductData
): Promise<StripeProductResult> {
  try {
    // Update the product in Stripe
    await stripe.products.update(productId, {
      name: data.name,
      description: data.description || undefined,
      active: true,
    })

    // For price updates, we need to create a new price (Stripe prices are immutable)
    // First, deactivate the old price
    await stripe.prices.update(priceId, { active: false })

    // Create a new price
    const newPrice = await stripe.prices.create({
      product: productId,
      unit_amount: data.price_cents,
      currency: data.currency || 'usd',
    })

    return {
      productId,
      priceId: newPrice.id,
    }
  } catch (error) {
    logger.error('Error updating Stripe product', { error })
    throw new Error('Failed to update Stripe product')
  }
}

export async function deleteStripeProduct(productId: string): Promise<void> {
  try {
    // Archive the product in Stripe (don't delete to preserve history)
    await stripe.products.update(productId, { active: false })
  } catch (error) {
    logger.error('Error deleting Stripe product', { error })
    throw new Error('Failed to delete Stripe product')
  }
}
