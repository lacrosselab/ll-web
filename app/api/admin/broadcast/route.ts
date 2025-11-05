import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { sendBroadcastEmail } from '@/lib/email/service'
import { logger } from '@/lib/utils'

interface BroadcastRequest {
  audienceType: 'all' | 'session' | 'dateRange'
  productId?: string
  startDate?: string
  endDate?: string
  subject: string
  bodyText: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (!user.email?.endsWith('@thelacrosselab.com')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body: BroadcastRequest = await request.json()
    const { audienceType, productId, startDate, endDate, subject, bodyText } = body

    if (!subject || !bodyText) {
      return NextResponse.json(
        { error: 'Subject and body text are required' },
        { status: 400 }
      )
    }

    // Get audience based on filters
    let userEmails: string[] = []

    if (audienceType === 'all') {
      // Get all users with successful payments
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('user_id, users!inner(email)')
        .eq('status', 'succeeded')

      if (paymentsError) {
        logger.error('Error fetching payments for broadcast', paymentsError)
        return NextResponse.json(
          { error: 'Failed to fetch audience' },
          { status: 500 }
        )
      }

      // Extract unique emails
      const emailSet = new Set<string>()
      payments?.forEach((payment: any) => {
        if (payment.users?.email) {
          emailSet.add(payment.users.email)
        }
      })
      userEmails = Array.from(emailSet)
    } else if (audienceType === 'session' && productId) {
      // Get users who purchased a specific session/product
      const { data: paymentAthletes, error: paError } = await supabase
        .from('payment_athletes')
        .select(`
          payment:payments!inner (
            user_id,
            status,
            users!inner (
              email
            )
          )
        `)
        .eq('product_id', productId)
        .eq('payment.status', 'succeeded')

      if (paError) {
        logger.error('Error fetching payment athletes for broadcast', paError)
        return NextResponse.json(
          { error: 'Failed to fetch audience' },
          { status: 500 }
        )
      }

      // Extract unique emails
      const emailSet = new Set<string>()
      paymentAthletes?.forEach((pa: any) => {
        if (pa.payment?.users?.email) {
          emailSet.add(pa.payment.users.email)
        }
      })
      userEmails = Array.from(emailSet)
    } else if (audienceType === 'dateRange' && startDate && endDate) {
      // Get users who purchased sessions within date range
      const { data: paymentAthletes, error: paError } = await supabase
        .from('payment_athletes')
        .select(`
          payment:payments!inner (
            user_id,
            status,
            users!inner (
              email
            )
          ),
          product:products!inner (
            session_date
          )
        `)
        .eq('payment.status', 'succeeded')
        .gte('product.session_date', startDate)
        .lte('product.session_date', endDate)

      if (paError) {
        logger.error('Error fetching payment athletes for broadcast', paError)
        return NextResponse.json(
          { error: 'Failed to fetch audience' },
          { status: 500 }
        )
      }

      // Extract unique emails
      const emailSet = new Set<string>()
      paymentAthletes?.forEach((pa: any) => {
        if (pa.payment?.users?.email) {
          emailSet.add(pa.payment.users.email)
        }
      })
      userEmails = Array.from(emailSet)
    } else {
      return NextResponse.json(
        { error: 'Invalid audience filter parameters' },
        { status: 400 }
      )
    }

    if (userEmails.length === 0) {
      return NextResponse.json(
        { error: 'No recipients found for the selected audience' },
        { status: 400 }
      )
    }

    logger.debug(`Sending broadcast email to ${userEmails.length} recipients`)

    // Send broadcast emails
    const result = await sendBroadcastEmail({
      to: userEmails,
      subject,
      bodyText,
    })

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      total: userEmails.length,
    })
  } catch (error) {
    logger.error('Error sending broadcast email', error)
    return NextResponse.json(
      { error: 'Failed to send broadcast email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

