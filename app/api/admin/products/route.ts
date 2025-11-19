import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSupabaseServer } from '@/lib/supabase/server'
import { logger } from '@/lib/utils'

/**
 * Normalize location string by capitalizing properly
 * Handles common address abbreviations and multi-word addresses
 */
function normalizeLocation(location: string | null | undefined): string | null {
  if (!location || typeof location !== 'string' || location.trim() === '') {
    return null
  }

  // Common address abbreviations that should be uppercase
  const abbreviations = ['VA', 'NC', 'SC', 'MD', 'DC', 'NY', 'NJ', 'PA', 'DE', 'WV', 'KY', 'TN']
  
  // Split by common delimiters and process each part
  const parts = location.split(',').map(part => part.trim())
  
  const normalizedParts = parts.map(part => {
    // Split by spaces to process each word
    const words = part.split(/\s+/)
    
    const normalizedWords = words.map((word, index) => {
      // Check if it's an abbreviation (2-3 uppercase letters)
      const upperWord = word.toUpperCase()
      if (abbreviations.includes(upperWord)) {
        return upperWord
      }
      
      // Check if it's "Unit" followed by a letter/number (e.g., "Unit B", "Unit 1")
      if (word.toLowerCase() === 'unit' && index < words.length - 1) {
        return 'Unit'
      }
      
      // Capitalize first letter, lowercase the rest
      if (word.length === 0) return word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    
    return normalizedWords.join(' ')
  })
  
  return normalizedParts.join(', ')
}

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
    const { 
      name, 
      description, 
      price_cents, 
      currency = 'usd',
      session_date,
      stock_quantity,
      is_active = true,
      gender,
      min_grade,
      max_grade,
      skill_level,
      sessions = [] // Array of { session_date, session_time }
    } = body

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

    // Insert into database with Stripe IDs
    const { data: dbProduct, error: dbError } = await supabase
      .from('products')
      .insert({
        name,
        description,
        price_cents,
        currency,
        session_date,
        stock_quantity,
        is_active,
        gender,
        min_grade,
        max_grade,
        skill_level,
        stripe_product_id: product.id,
        stripe_price_id: price.id,
      })
      .select()
      .single()

    if (dbError) {
      logger.error('Database insert error', { error: dbError })
      // Try to clean up Stripe products if database insert fails
      try {
        await stripe.products.update(product.id, { active: false })
      } catch (cleanupError) {
        logger.error('Failed to cleanup Stripe product', { error: cleanupError })
      }
      throw dbError
    }

    // Create product_sessions if provided
    if (sessions && sessions.length > 0) {
      const sessionRecords = sessions.map((session: { session_date: string, session_time: string, location?: string | null }) => ({
        product_id: dbProduct.id,
        session_date: session.session_date,
        session_time: session.session_time || '00:00:00',
        location: normalizeLocation(session.location)
      }))

      const { error: sessionsError } = await supabase
        .from('product_sessions')
        .insert(sessionRecords)

      if (sessionsError) {
        logger.error('Error creating product sessions', { error: sessionsError })
        // Don't fail the whole request, but log the error
      }
    } else if (session_date) {
      // If no sessions provided but session_date exists, create one session for backward compatibility
      const { error: sessionsError } = await supabase
        .from('product_sessions')
        .insert({
          product_id: dbProduct.id,
          session_date,
          session_time: '00:00:00'
        })

      if (sessionsError) {
        logger.error('Error creating default product session', { error: sessionsError })
      }
    }

    return NextResponse.json({
      success: true,
      product: dbProduct,
      stripeProductId: product.id,
      stripePriceId: price.id,
    })
  } catch (error) {
    logger.error('Error creating product', { error })
    return NextResponse.json(
      { error: 'Failed to create product' },
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
      priceChanged = false,
      gender,
      min_grade,
      max_grade,
      skill_level,
      sessions // Array of { id?, session_date, session_time } for updating sessions
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
        logger.debug('Could not archive old price (likely default price)', { error: archiveError })
      }

      newPriceId = newPrice.id
    }

    // Update product fields in database if provided
    const updateFields: any = {}
    if (gender !== undefined) updateFields.gender = gender
    if (min_grade !== undefined) updateFields.min_grade = min_grade
    if (max_grade !== undefined) updateFields.max_grade = max_grade
    if (skill_level !== undefined) updateFields.skill_level = skill_level

    if (Object.keys(updateFields).length > 0) {
      const { error: updateError } = await supabase
        .from('products')
        .update(updateFields)
        .eq('stripe_product_id', productId)

      if (updateError) {
        logger.error('Error updating product fields', { error: updateError })
      }
    }

    // Update product_sessions if provided
    if (sessions && Array.isArray(sessions)) {
      // Get current product ID from database
      const { data: productData, error: productDataError } = await supabase
        .from('products')
        .select('id')
        .eq('stripe_product_id', productId)
        .single()

      if (productDataError) {
        logger.error('Error fetching product data for session update', { error: productDataError })
        return NextResponse.json(
          { error: 'Failed to fetch product data for session update' },
          { status: 500 }
        )
      }

      if (productData) {
        // Delete all existing sessions for this product
        const { error: deleteError } = await supabase
          .from('product_sessions')
          .delete()
          .eq('product_id', productData.id)

        if (deleteError) {
          logger.error('Error deleting product sessions', { error: deleteError })
          return NextResponse.json(
            { error: 'Failed to delete existing product sessions' },
            { status: 500 }
          )
        }

        // Insert new sessions
        if (sessions.length > 0) {
          const sessionRecords = sessions.map((session: { session_date: string, session_time: string, location?: string | null }) => ({
            product_id: productData.id,
            session_date: session.session_date,
            session_time: session.session_time || '00:00:00',
            location: normalizeLocation(session.location)
          }))

          const { error: sessionsError } = await supabase
            .from('product_sessions')
            .insert(sessionRecords)

          if (sessionsError) {
            logger.error('Error inserting product sessions', { error: sessionsError })
            return NextResponse.json(
              { error: 'Failed to insert product sessions', details: sessionsError.message },
              { status: 500 }
            )
          }
        }
      } else {
        logger.error('Product data not found for session update')
        return NextResponse.json(
          { error: 'Product not found for session update' },
          { status: 404 }
        )
      }
    }

    return NextResponse.json({
      productId,
      priceId: newPriceId,
    })
  } catch (error) {
    logger.error('Error updating Stripe product', { error })
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
    logger.error('Error deleting Stripe product', { error })
    return NextResponse.json(
      { error: 'Failed to delete Stripe product' },
      { status: 500 }
    )
  }
}
