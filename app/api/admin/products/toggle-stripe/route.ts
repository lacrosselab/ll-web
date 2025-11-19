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

    // Update Stripe product active status
    await stripe.products.update(productId, {
      active: isActive
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error updating Stripe product status', { error })
    return NextResponse.json(
      { 
        error: 'Failed to update Stripe product status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
