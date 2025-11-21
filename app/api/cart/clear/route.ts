import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { logger } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await getSupabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.debug('Cart clear attempted without authentication')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete all cart items for the authenticated user
    const { error: deleteError } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      logger.error('Error clearing cart items', { error: deleteError.message || 'Unknown error' })
      return NextResponse.json(
        { 
          error: 'Failed to clear cart',
          details: deleteError.message 
        },
        { status: 500 }
      )
    }

    logger.debug(`Cart cleared successfully for user: ${user.id}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Unexpected error clearing cart', { error: error instanceof Error ? error.message : 'Unknown error' })
    return NextResponse.json(
      { 
        error: 'Failed to clear cart',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

