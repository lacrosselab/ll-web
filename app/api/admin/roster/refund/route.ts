import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSupabaseServer } from '@/lib/supabase/server'
import { getSupabaseService } from '@/lib/supabase/service'
import { logger } from '@/lib/utils'

interface RefundRequest {
  paymentAthleteIds: string[]
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

    const body: RefundRequest = await request.json()
    const { paymentAthleteIds } = body

    if (!paymentAthleteIds || paymentAthleteIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one payment_athlete ID is required' },
        { status: 400 }
      )
    }

    // Use service client for database operations
    const serviceSupabase = getSupabaseService()

    // Get payment_athletes details to calculate refund amount and get payment info
    const { data: paymentAthletes, error: fetchError } = await serviceSupabase
      .from('payment_athletes')
      .select(`
        id,
        payment_id,
        athlete_id,
        product_id,
        quantity,
        unit_price_cents,
        refunded_at,
        payment:payments!inner (
          id,
          stripe_payment_intent_id,
          status,
          user_id
        )
      `)
      .in('id', paymentAthleteIds)

    if (fetchError) {
      logger.error('Error fetching payment_athletes', { error: fetchError })
      return NextResponse.json(
        { error: 'Failed to fetch payment details' },
        { status: 500 }
      )
    }

    if (!paymentAthletes || paymentAthletes.length === 0) {
      return NextResponse.json(
        { error: 'No valid payment records found' },
        { status: 404 }
      )
    }

    // Filter out already refunded items
    const unrefundedItems = paymentAthletes.filter(pa => !pa.refunded_at)
    
    if (unrefundedItems.length === 0) {
      return NextResponse.json(
        { error: 'All selected items have already been refunded' },
        { status: 400 }
      )
    }

    // Calculate total refund amount
    const totalRefundCents = unrefundedItems.reduce(
      (sum, pa) => sum + (pa.unit_price_cents * pa.quantity),
      0
    )

    // Get the payment intent ID for Stripe refund
    // All items should be from the same payment for a proper refund
    const payment = unrefundedItems[0].payment as any
    const stripePaymentIntentId = payment?.stripe_payment_intent_id

    let stripeRefundId: string | null = null

    // Only process Stripe refund if there's a payment intent (not a cash payment)
    if (stripePaymentIntentId && payment?.status !== 'cash') {
      try {
        // Create Stripe refund
        const refund = await stripe.refunds.create({
          payment_intent: stripePaymentIntentId,
          amount: totalRefundCents,
          reason: 'requested_by_customer',
        })

        stripeRefundId = refund.id
        logger.info('Stripe refund created', {
          refundId: refund.id,
          amount: totalRefundCents,
          paymentIntent: stripePaymentIntentId,
        })
      } catch (stripeError) {
        logger.error('Stripe refund failed', {
          error: stripeError instanceof Error ? stripeError.message : 'Unknown error',
          paymentIntent: stripePaymentIntentId,
        })
        return NextResponse.json(
          { 
            error: 'Failed to process Stripe refund',
            details: stripeError instanceof Error ? stripeError.message : 'Unknown error'
          },
          { status: 500 }
        )
      }
    } else {
      // For cash payments, we just need to mark as refunded in database
      stripeRefundId = `cash_refund_${Date.now()}`
      logger.info('Processing cash payment refund', {
        refundId: stripeRefundId,
        amount: totalRefundCents,
      })
    }

    // Call RPC function to update database records
    const { data: rpcResult, error: rpcError } = await serviceSupabase
      .rpc('process_refund', {
        p_payment_athlete_ids: unrefundedItems.map(pa => pa.id),
        p_stripe_refund_id: stripeRefundId,
      })

    if (rpcError) {
      logger.error('Database refund processing failed', { error: rpcError })
      // Note: Stripe refund already processed - may need manual reconciliation
      return NextResponse.json(
        { 
          error: 'Failed to update database records',
          stripeRefundId,
          details: rpcError.message,
        },
        { status: 500 }
      )
    }

    logger.info('Refund processed successfully', {
      stripeRefundId,
      totalRefundCents,
      itemsRefunded: unrefundedItems.length,
      rpcResult,
    })

    return NextResponse.json({
      success: true,
      refundId: stripeRefundId,
      totalRefundedCents: totalRefundCents,
      itemsRefunded: unrefundedItems.length,
      allItemsRefunded: rpcResult?.all_refunded ?? false,
    })
  } catch (error) {
    logger.error('Error processing refund', { error })
    return NextResponse.json(
      { error: 'Failed to process refund' },
      { status: 500 }
    )
  }
}

