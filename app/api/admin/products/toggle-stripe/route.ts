import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSupabaseServer } from '@/lib/supabase/server'
import { logger } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin status
    const supabase = await getSupabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!user.email?.endsWith('@thelacrosselab.com')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { productId, isActive } = body

    if (!productId || typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    // Fetch current product state from DB for idempotency and validation
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('id, stripe_product_id, is_active')
      .eq('stripe_product_id', productId)
      .single()

    if (fetchError || !product) {
      logger.error(`[API] Product not found for Stripe ID ${productId}:`, fetchError)
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Check if already in desired state (idempotency)
    const normalizedCurrentActive = product.is_active === true || product.is_active === 'true' || product.is_active === 't' || product.is_active === 1
    if (normalizedCurrentActive === isActive) {
      logger.info(`[API] Product ${product.id} already in desired state (isActive=${isActive}), skipping update`)
      return NextResponse.json({ success: true, message: 'Already in desired state' })
    }

    // Atomically update: Stripe first, then DB (with rollback on failure)
    let stripeUpdateSucceeded = false
    try {
      // Update Stripe product active status
      await stripe.products.update(productId, {
        active: isActive
      })
      stripeUpdateSucceeded = true
      logger.info(`[API] Stripe product ${productId} updated to active=${isActive}`)
    } catch (stripeError) {
      logger.error(`[API] Failed to update Stripe product ${productId}:`, stripeError)
      return NextResponse.json(
        { 
          error: 'Failed to update Stripe product status',
          details: stripeError instanceof Error ? stripeError.message : 'Unknown error'
        },
        { status: 500 }
      )
    }

    // Only update DB after Stripe success
    try {
      const { error: dbError } = await supabase
        .from('products')
        .update({ is_active: isActive })
        .eq('id', product.id)

      if (dbError) {
        logger.error(`[API] Failed to update DB for product ${product.id} after Stripe success, attempting rollback:`, dbError)
        
        // Rollback Stripe change
        try {
          await stripe.products.update(productId, {
            active: normalizedCurrentActive
          })
          logger.info(`[API] Rolled back Stripe product ${productId} to previous state`)
        } catch (rollbackError) {
          logger.error(`[API] Failed to rollback Stripe product ${productId} after DB failure:`, rollbackError)
        }
        
        return NextResponse.json(
          { 
            error: 'Failed to update database after Stripe update',
            details: dbError.message
          },
          { status: 500 }
        )
      }

      logger.info(`[API] Atomically updated product ${product.id}: DB and Stripe both set to active=${isActive}`)
      return NextResponse.json({ success: true })
    } catch (dbError) {
      logger.error(`[API] Unexpected error updating DB for product ${product.id}:`, dbError)
      
      // Rollback Stripe change
      try {
        await stripe.products.update(productId, {
          active: normalizedCurrentActive
        })
        logger.info(`[API] Rolled back Stripe product ${productId} to previous state`)
      } catch (rollbackError) {
        logger.error(`[API] Failed to rollback Stripe product ${productId} after DB failure:`, rollbackError)
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to update database',
          details: dbError instanceof Error ? dbError.message : 'Unknown error'
        },
        { status: 500 }
      )
    }
  } catch (error) {
    logger.error('[API] Error in toggle-stripe endpoint:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update product status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
