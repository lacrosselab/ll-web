import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSupabaseServer } from '@/lib/supabase/server'

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
    const { name, description, price_cents, currency = 'usd' } = body

    // Create the product in Stripe with tax code
    const product = await stripe.products.create({
      name,
      description: description || undefined,
      active: true,
      tax_code: 'txcd_20030000', // General - Services
    })

    // Create the price for the product
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: price_cents,
      currency,
    })

    return NextResponse.json({
      productId: product.id,
      priceId: price.id,
    })
  } catch (error) {
    console.error('Error creating Stripe product:', error)
    return NextResponse.json(
      { error: 'Failed to create Stripe product' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
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
    const { 
      productId, 
      priceId, 
      name, 
      description, 
      price_cents, 
      currency = 'usd',
      nameChanged = false,
      descriptionChanged = false,
      priceChanged = false
    } = body

    let newPriceId = priceId // Default to existing price ID

    // Only update product if something changed
    if (nameChanged || descriptionChanged) {
      const updateData: any = {
        active: true,
        tax_code: 'txcd_20030000', // Always ensure tax code is set
      }

      // Only include fields that actually changed
      if (nameChanged) updateData.name = name
      if (descriptionChanged) updateData.description = description || undefined

      await stripe.products.update(productId, updateData)
    }

    // Only create new price if price changed
    if (priceChanged) {
      // Create the new price first
      const newPrice = await stripe.prices.create({
        product: productId,
        unit_amount: price_cents,
        currency,
      })

      // Set the new price as the default price for the product
      await stripe.products.update(productId, {
        default_price: newPrice.id,
      })

      // Try to archive the old price (but don't fail if we can't)
      try {
        await stripe.prices.update(priceId, { active: false })
      } catch (archiveError) {
        // If we can't archive it (because it's the default), that's okay
        console.log('Could not archive old price (likely default price):', archiveError)
      }

      newPriceId = newPrice.id
    }

    return NextResponse.json({
      productId,
      priceId: newPriceId,
    })
  } catch (error) {
    console.error('Error updating Stripe product:', error)
    return NextResponse.json(
      { error: 'Failed to update Stripe product' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 })
    }

    // Archive the product in Stripe (don't delete to preserve history)
    await stripe.products.update(productId, { active: false })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting Stripe product:', error)
    return NextResponse.json(
      { error: 'Failed to delete Stripe product' },
      { status: 500 }
    )
  }
}
