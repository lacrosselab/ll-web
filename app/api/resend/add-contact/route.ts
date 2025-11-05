import { NextRequest, NextResponse } from 'next/server'
import { addContactToResend } from '@/lib/email/service'
import { getSupabaseServer } from '@/lib/supabase/server'
import { logger } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email, name } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Add contact to Resend (non-blocking)
    await addContactToResend(email, name)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error adding contact to Resend', error)
    // Don't fail the request if Resend fails
    return NextResponse.json({ success: false, error: 'Failed to add contact' }, { status: 500 })
  }
}

