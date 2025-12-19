import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { logger } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user waiver status
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('waiver_signed, waiver_signed_at')
      .eq('id', user.id)
      .single()

    if (userError) {
      logger.error('Error fetching user waiver status', { error: userError })
      return NextResponse.json(
        { error: 'Failed to fetch waiver status' },
        { status: 500 }
      )
    }

    // Get all athletes for this user to determine if any are minors
    const { data: athletes, error: athletesError } = await supabase
      .from('athletes')
      .select('id, name, age')
      .eq('user_id', user.id)

    if (athletesError) {
      logger.error('Error fetching athletes', { error: athletesError })
      return NextResponse.json(
        { error: 'Failed to fetch athletes' },
        { status: 500 }
      )
    }

    // Determine minor status: age < 18 OR age is null
    const hasMinors = (athletes || []).some(
      athlete => athlete.age === null || athlete.age < 18
    )

    // Get names of minor athletes for display in waiver
    const minorAthleteNames = (athletes || [])
      .filter(athlete => athlete.age === null || athlete.age < 18)
      .map(athlete => athlete.name)

    return NextResponse.json({
      waiverSigned: userData?.waiver_signed || false,
      waiverSignedAt: userData?.waiver_signed_at || null,
      hasMinors,
      minorAthleteNames,
      athletes: athletes || []
    })
  } catch (error) {
    logger.error('Error checking waiver status', { error })
    return NextResponse.json(
      { error: 'Failed to check waiver status' },
      { status: 500 }
    )
  }
}
