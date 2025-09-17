import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSupabaseServer } from '@/lib/supabase/server'

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

    // Get or create Stripe customer for this user
    let stripeCustomerId: string
    
    try {
      // Check if user already has a Stripe customer ID in their profile
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching user profile:', profileError)
        throw profileError
      }

      if (userProfile?.stripe_customer_id) {
        // User already has a Stripe customer ID
        stripeCustomerId = userProfile.stripe_customer_id
        console.log('Using existing Stripe customer:', stripeCustomerId)
      } else {
        // Create new Stripe customer
        console.log('Creating new Stripe customer for user:', user.email)
        const customer = await stripe.customers.create({
          email: user.email!,
          metadata: {
            userId: user.id,
            email: user.email!
          }
        })
        
        stripeCustomerId = customer.id
        
        // Save the Stripe customer ID to the user's profile
        const { error: updateError } = await supabase
          .from('users')
          .upsert({
            id: user.id,
            email: user.email,
            stripe_customer_id: stripeCustomerId,
            updated_at: new Date().toISOString()
          })

        if (updateError) {
          console.error('Error saving Stripe customer ID:', updateError)
          // Don't throw here - we can still proceed with the checkout
        } else {
          console.log('Saved Stripe customer ID to user profile')
        }
      }
    } catch (error) {
      console.error('Error handling Stripe customer:', error)
      // Fallback to using email (creates guest customer)
      console.log('Falling back to customer_email approach')
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
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
