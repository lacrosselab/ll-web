import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { logger } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await getSupabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get client IP address from headers
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown'

    // Update user record with waiver signature
    const { error: updateError } = await supabase
      .from('users')
      .update({
        waiver_signed: true,
        waiver_signed_at: new Date().toISOString(),
        waiver_ip_address: ip
      })
      .eq('id', user.id)

    if (updateError) {
      logger.error('Error signing waiver', { error: updateError })
      return NextResponse.json(
        { error: 'Failed to sign waiver' },
        { status: 500 }
      )
    }

    logger.info('Waiver signed', { userId: user.id, ip })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error in waiver signing', { error })
    return NextResponse.json(
      { error: 'Failed to sign waiver' },
      { status: 500 }
    )
  }
}
