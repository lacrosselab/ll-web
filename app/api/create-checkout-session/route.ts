import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSupabaseServer } from '@/lib/supabase/server'
import { logger } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { priceId, lineItems } = body

    // Check authentication
    const supabase = await getSupabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check waiver status (server-side validation)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('waiver_signed, stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (userError && userError.code !== 'PGRST116') {
      logger.error('Error fetching user profile for waiver check', { error: userError.message || 'Unknown error' })
    }

    if (!userData?.waiver_signed) {
      return NextResponse.json(
        { error: 'Waiver must be signed before checkout' },
        { status: 403 }
      )
    }

    // Get or create Stripe customer for this user
    let stripeCustomerId: string

    try {
      // Use stripe_customer_id from the waiver check query above
      if (userData?.stripe_customer_id) {
        // User already has a Stripe customer ID
        stripeCustomerId = userData.stripe_customer_id
        logger.debug('Using existing Stripe customer')
      } else {
        // Create new Stripe customer
        logger.debug('Creating new Stripe customer')
        const customer = await stripe.customers.create({
          email: user.email!,
          metadata: {
            user_id: user.id,
          },
        })
        stripeCustomerId = customer.id

        // Save customer ID to user profile
        const { error: updateError } = await supabase
          .from('users')
          .upsert({
            id: user.id,
            email: user.email,
            stripe_customer_id: stripeCustomerId,
          })

        if (updateError) {
          logger.error('Error saving Stripe customer ID', { error: updateError.message || 'Unknown error' })
          // Don't throw here - we can still proceed with the checkout
        } else {
          logger.debug('Saved Stripe customer ID to user profile')
        }
      }
    } catch (customerError) {
      logger.error('Error handling Stripe customer', { error: customerError instanceof Error ? customerError.message : 'Unknown error' })
      // Fallback to using email (creates guest customer)
      logger.debug('Falling back to customer_email approach')
      stripeCustomerId = ''
    }

    let sessionData: any = {
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/member/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/cart?canceled=true`,
    }

    // Use customer ID if we have one, otherwise fall back to email
    if (stripeCustomerId) {
      sessionData.customer = stripeCustomerId
    } else {
      sessionData.customer_email = user.email
    }

    // Handle multiple line items (cart checkout)
    if (lineItems && Array.isArray(lineItems)) {
      // Validate line items
      if (lineItems.length === 0) {
        return NextResponse.json({ error: 'No items in cart' }, { status: 400 })
      }

      // Verify each product is still active in both DB and Stripe
      for (const item of lineItems) {
        try {
          // Check database
          const { data: dbProduct, error: dbError } = await supabase
            .from('products')
            .select('is_active, stripe_product_id')
            .eq('stripe_price_id', item.price)
            .single()

          if (dbError || !dbProduct?.is_active) {
            return NextResponse.json({ 
              error: 'One or more items are no longer available',
              details: 'Product is inactive in database'
            }, { status: 400 })
          }

          // Check Stripe
          const stripeProduct = await stripe.products.retrieve(dbProduct.stripe_product_id)
          if (!stripeProduct.active) {
            return NextResponse.json({ 
              error: 'One or more items are no longer available',
              details: 'Product is inactive in Stripe'
            }, { status: 400 })
          }
        } catch (verifyError) {
          logger.error('Error verifying product', { error: verifyError instanceof Error ? verifyError.message : 'Unknown error' })
          return NextResponse.json({ 
            error: 'Unable to verify product availability',
            details: 'Please refresh and try again'
          }, { status: 400 })
        }
      }

      // FIXED: Remove metadata from line items, add to session metadata instead
      sessionData.line_items = lineItems.map((item: any) => ({
        price: item.price,
        quantity: item.quantity,
        // Remove metadata from line items - Stripe doesn't support this
      }))

      // Add athlete information to session metadata instead
      const athleteInfo = lineItems.map((item: any, index: number) => ({
        [`athlete_${index}_id`]: item.metadata?.athlete_id || '',
        [`athlete_${index}_name`]: item.metadata?.athlete_name || '',
        [`athlete_${index}_product_id`]: item.metadata?.product_id || ''
      })).reduce((acc, curr) => ({ ...acc, ...curr }), {})

      sessionData.metadata = {
        user_id: user.id,
        ...athleteInfo
      }
    } 
    // Handle single price ID (legacy support)
    else if (priceId) {
      sessionData.line_items = [
        {
          price: priceId,
          quantity: 1,
        },
      ]
    } else {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.create(sessionData)

    return NextResponse.json({ sessionId: session.id })
  } catch (error) {
    logger.error('Error creating checkout session', { error: error instanceof Error ? error.message : 'Unknown error' })
    return NextResponse.json(
      { 
        error: 'Failed to create checkout session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
