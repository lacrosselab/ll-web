import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createMockNextRequest,
  createMockStripeEvent,
  mockPaymentAthletes,
  mockUser,
  mockProduct,
  mockAthlete,
  mockLineItems,
} from '@/lib/email/__tests__/test-utils'
import type Stripe from 'stripe'

// Use vi.hoisted to create mocks that can be referenced in vi.mock factories
const mocks = vi.hoisted(() => {
  return {
    mockStripeClient: {
      webhooks: {
        constructEvent: vi.fn(),
      },
      customers: {
        retrieve: vi.fn(),
      },
      paymentIntents: {
        retrieve: vi.fn(),
      },
      checkout: {
        sessions: {
          listLineItems: vi.fn(),
        },
      },
    },
    mockSupabaseClient: {
      from: vi.fn(),
      rpc: vi.fn(),
      auth: {
        getUser: vi.fn(),
      },
    },
    mockSendPurchaseConfirmation: vi.fn().mockResolvedValue(undefined),
    logger: {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    },
  }
})

// Mock Stripe
vi.mock('@/lib/stripe', () => ({
  stripe: mocks.mockStripeClient,
}))

// Mock Supabase Service
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseService: vi.fn().mockReturnValue(mocks.mockSupabaseClient),
}))

// Mock Email Service
vi.mock('@/lib/email/service', () => ({
  sendPurchaseConfirmation: mocks.mockSendPurchaseConfirmation,
}))

// Mock Logger
vi.mock('@/lib/utils', () => ({
  logger: mocks.logger,
}))

// Import after mocking
import { POST } from '../route'

// Reference the hoisted mocks
const mockStripeClient = mocks.mockStripeClient
const mockSupabaseClient = mocks.mockSupabaseClient
const mockSendPurchaseConfirmation = mocks.mockSendPurchaseConfirmation

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'
    mockSendPurchaseConfirmation.mockResolvedValue(undefined)
  })

  function createWebhookRequest(event: Stripe.Event, signature: string = 'sig_123') {
    return createMockNextRequest({
      body: JSON.stringify(event),
      headers: { 'stripe-signature': signature },
    })
  }

  it('should process checkout.session.completed event successfully', async () => {
    const mockEvent = createMockStripeEvent({
      type: 'checkout.session.completed',
      sessionId: 'cs_123',
      customerId: 'cus_123',
      paymentIntentId: 'pi_123',
      amountTotal: 10000,
      metadata: {
        athlete_0_id: mockAthlete.id,
        athlete_0_product_id: mockProduct.id,
      },
    })
    mockStripeClient.webhooks.constructEvent.mockReturnValue(mockEvent)

    // Mock Stripe API calls
    mockStripeClient.customers.retrieve.mockResolvedValue({
      id: 'cus_123',
      email: 'test@example.com',
      metadata: { userId: 'user-123' },
    } as any)

    mockStripeClient.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_123',
      amount: 10000,
      currency: 'usd',
    } as any)

    mockStripeClient.checkout.sessions.listLineItems.mockResolvedValue({
      data: mockLineItems,
    } as any)

    // Configure Supabase mocks
    const webhookEventsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
    }

    // Make update().eq() chainable
    webhookEventsQuery.update.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    })

    const productsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: mockProduct,
        error: null,
      }),
    }

    const paymentsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'payment-id-123', email_sent_at: null },
        error: null,
      }),
      update: vi.fn().mockReturnThis(),
    }

    // Make payments update().eq() chainable
    paymentsQuery.update.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    })

    const usersQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: mockUser,
        error: null,
      }),
    }

    const paymentAthletesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: mockPaymentAthletes,
        error: null,
      }),
    }

    mockSupabaseClient.from.mockImplementation((table: string) => {
      switch (table) {
        case 'webhook_events':
          return webhookEventsQuery as any
        case 'products':
          return productsQuery as any
        case 'payments':
          return paymentsQuery as any
        case 'users':
          return usersQuery as any
        case 'payment_athletes':
          return paymentAthletesQuery as any
        default:
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as any
      }
    })

    // Mock RPC method directly on the client
    mockSupabaseClient.rpc = vi.fn().mockResolvedValue({
      data: 'payment-id-123',
      error: null,
    })

    const request = createWebhookRequest(mockEvent)
    const response = await POST(request as any)

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toEqual({ received: true })

    // Verify RPC was called with correct parameters
    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
      'process_payment_webhook',
      expect.objectContaining({
        p_stripe_payment_intent_id: 'pi_123',
        p_user_id: 'user-123',
        p_amount: 10000,
        p_currency: 'usd',
        p_line_items: expect.arrayContaining([
          expect.objectContaining({
            product_id: mockProduct.id,
            athlete_id: mockAthlete.id,
            quantity: 1,
            unit_price_cents: mockProduct.price_cents,
          }),
        ]),
      })
    )

    // Verify email was sent
    expect(mockSendPurchaseConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        customerName: mockUser.full_name,
        orderNumber: expect.stringMatching(/^LAB-/),
        orderDate: expect.any(String),
        items: expect.arrayContaining([
          expect.objectContaining({
            productName: mockProduct.name,
            athleteName: mockAthlete.name,
            quantity: 1,
            unitPriceCents: mockProduct.price_cents,
          }),
        ]),
        totalAmountCents: 10000,
        currency: 'usd',
      })
    )
  })
})
