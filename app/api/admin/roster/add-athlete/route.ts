import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getSupabaseService } from '@/lib/supabase/service'
import { logger } from '@/lib/utils'

interface AddAthleteRequest {
  athleteId: string
  productId: string
  quantity?: number
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

    const body: AddAthleteRequest = await request.json()
    const { athleteId, productId, quantity = 1 } = body

    if (!athleteId || !productId) {
      return NextResponse.json(
        { error: 'athleteId and productId are required' },
        { status: 400 }
      )
    }

    // Use service client for database operations
    const serviceSupabase = getSupabaseService()

    // Get athlete to verify it exists and get user_id
    const { data: athlete, error: athleteError } = await serviceSupabase
      .from('athletes')
      .select('id, name, user_id')
      .eq('id', athleteId)
      .single()

    if (athleteError || !athlete) {
      logger.error('Athlete not found', { athleteId, error: athleteError })
      return NextResponse.json(
        { error: 'Athlete not found' },
        { status: 404 }
      )
    }

    // Check if athlete is already registered for this product
    const { data: existingRegistration, error: existingError } = await serviceSupabase
      .from('payment_athletes')
      .select(`
        id,
        refunded_at,
        payment:payments!inner (
          status
        )
      `)
      .eq('athlete_id', athleteId)
      .eq('product_id', productId)

    if (existingError) {
      logger.error('Error checking existing registration', { error: existingError })
    }

    // Filter to find active (non-refunded) registrations with successful or cash payments
    const activeRegistration = existingRegistration?.find(reg => {
      const payment = reg.payment as any
      const isActivePayment = payment?.status === 'succeeded' || payment?.status === 'cash'
      const isNotRefunded = !reg.refunded_at
      return isActivePayment && isNotRefunded
    })

    if (activeRegistration) {
      return NextResponse.json(
        { error: 'Athlete is already registered for this session' },
        { status: 409 }
      )
    }

    // Get product to verify it exists
    const { data: product, error: productError } = await serviceSupabase
      .from('products')
      .select('id, name, price_cents, stock_quantity')
      .eq('id', productId)
      .single()

    if (productError || !product) {
      logger.error('Product not found', { productId, error: productError })
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Check stock availability
    if (product.stock_quantity < quantity) {
      return NextResponse.json(
        { error: 'Insufficient stock available' },
        { status: 400 }
      )
    }

    // Call RPC function to add athlete to session
    const { data: rpcResult, error: rpcError } = await serviceSupabase
      .rpc('add_athlete_to_session_cash', {
        p_athlete_id: athleteId,
        p_product_id: productId,
        p_user_id: athlete.user_id,
        p_quantity: quantity,
      })

    if (rpcError) {
      logger.error('Database operation failed', { error: rpcError })
      return NextResponse.json(
        { error: 'Failed to add athlete to session', details: rpcError.message },
        { status: 500 }
      )
    }

    if (!rpcResult?.success) {
      return NextResponse.json(
        { error: rpcResult?.error || 'Failed to add athlete to session' },
        { status: 500 }
      )
    }

    logger.info('Athlete added to session (cash payment)', {
      athleteId,
      athleteName: athlete.name,
      productId,
      productName: product.name,
      paymentId: rpcResult.payment_id,
    })

    return NextResponse.json({
      success: true,
      paymentId: rpcResult.payment_id,
      paymentAthleteId: rpcResult.payment_athlete_id,
      athlete: {
        id: athlete.id,
        name: athlete.name,
      },
      product: {
        id: product.id,
        name: product.name,
      },
    })
  } catch (error) {
    logger.error('Error adding athlete to session', { error })
    return NextResponse.json(
      { error: 'Failed to add athlete to session' },
      { status: 500 }
    )
  }
}

// GET endpoint to list athletes available for adding to a session
export async function GET(request: NextRequest) {
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
    const search = searchParams.get('search')

    // Use service client for database operations
    const serviceSupabase = getSupabaseService()

    // Build query for all athletes
    let query = serviceSupabase
      .from('athletes')
      .select(`
        id,
        name,
        age,
        school,
        position,
        grade,
        user:users!athletes_user_id_fkey (
          id,
          email
        )
      `)
      .order('name', { ascending: true })

    // Apply search filter if provided
    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    const { data: athletes, error: athletesError } = await query.limit(50)

    if (athletesError) {
      logger.error('Error fetching athletes', { error: athletesError })
      return NextResponse.json(
        { error: 'Failed to fetch athletes' },
        { status: 500 }
      )
    }

    // If productId provided, filter out athletes already registered for this product
    if (productId && athletes) {
      const { data: registeredAthletes, error: registeredError } = await serviceSupabase
        .from('payment_athletes')
        .select(`
          athlete_id,
          refunded_at,
          payment:payments!inner (
            status
          )
        `)
        .eq('product_id', productId)

      if (registeredError) {
        logger.error('Error fetching registered athletes', { error: registeredError })
      }

      // Get IDs of athletes with active (non-refunded) registrations
      const registeredAthleteIds = new Set(
        (registeredAthletes || [])
          .filter(ra => {
            const payment = ra.payment as any
            const isActivePayment = payment?.status === 'succeeded' || payment?.status === 'cash'
            const isNotRefunded = !ra.refunded_at
            return isActivePayment && isNotRefunded
          })
          .map(ra => ra.athlete_id)
      )

      // Filter out already registered athletes
      const availableAthletes = athletes.filter(a => !registeredAthleteIds.has(a.id))

      return NextResponse.json({
        athletes: availableAthletes,
        count: availableAthletes.length,
      })
    }

    return NextResponse.json({
      athletes: athletes || [],
      count: athletes?.length || 0,
    })
  } catch (error) {
    logger.error('Error fetching athletes', { error })
    return NextResponse.json(
      { error: 'Failed to fetch athletes' },
      { status: 500 }
    )
  }
}

