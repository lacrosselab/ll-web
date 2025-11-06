import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createMockSupabaseClient,
  createMockNextRequest,
  createMockStripeEvent,
  mockPayment,
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
    mockSupabaseClient: createMockSupabaseClient(),
    mockSendPurchaseConfirmation: vi.fn().mockResolvedValue(undefined),
    logger: {
      debug: vi.fn(),
      error: vi.fn(),
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
import { sendPurchaseConfirmation } from '@/lib/email/service'
import { logger } from '@/lib/utils'

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

  describe('Signature Verification Tests', () => {
    it('should return 400 when signature verification fails', async () => {
      const mockEvent = createMockStripeEvent({ type: 'checkout.session.completed' })
      mockStripeClient.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const request = createWebhookRequest(mockEvent, 'invalid_signature')
      const response = await POST(request as any)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json).toEqual({ error: 'Invalid signature' })
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('signature verification failed'),
        expect.any(Error)
      )
    })

    it('should verify webhook signature successfully', async () => {
      const mockEvent = createMockStripeEvent({ type: 'checkout.session.completed' })
      mockStripeClient.webhooks.constructEvent.mockReturnValue(mockEvent)

      // Configure idempotency check (new event)
      const webhookEventsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      }
      mockSupabaseClient.from.mockReturnValue(webhookEventsQuery as any)

      // Mock upsert
      const upsertQuery = {
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
      mockSupabaseClient.from.mockReturnValue(upsertQuery as any)

      const request = createWebhookRequest(mockEvent)
      await POST(request as any)

      expect(mockStripeClient.webhooks.constructEvent).toHaveBeenCalledWith(
        expect.any(String),
        'sig_123',
        'whsec_test_secret'
      )
      expect(logger.debug).toHaveBeenCalledWith('Webhook signature verified successfully')
    })
  })

  describe('Idempotency Tests', () => {
    it('should return early when event already processed', async () => {
      const mockEvent = createMockStripeEvent({ type: 'checkout.session.completed' })
      mockStripeClient.webhooks.constructEvent.mockReturnValue(mockEvent)

      const webhookEventsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            stripe_event_id: mockEvent.id,
            processed_at: '2024-01-15T10:00:00Z',
          },
          error: null,
        }),
      }
      mockSupabaseClient.from.mockReturnValue(webhookEventsQuery as any)

      const request = createWebhookRequest(mockEvent)
      const response = await POST(request as any)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toEqual({
        received: true,
        message: 'Event already processed',
      })
      expect(logger.debug).toHaveBeenCalledWith(
        'Webhook event already processed, skipping'
      )
      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('rpc')
    })

    it('should upsert webhook event when processing new event', async () => {
      const mockEvent = createMockStripeEvent({
        type: 'checkout.session.completed',
      })
      mockEvent.id = 'evt_new_123'
      mockStripeClient.webhooks.constructEvent.mockReturnValue(mockEvent)

      const webhookEventsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      }

      const upsertQuery = {
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'webhook_events') {
          return webhookEventsQuery as any
        }
        return upsertQuery as any
      })

      const request = createWebhookRequest(mockEvent)
      await POST(request as any)

      expect(upsertQuery.upsert).toHaveBeenCalledWith(
        {
          stripe_event_id: 'evt_new_123',
          type: 'checkout.session.completed',
          processed_at: null,
        },
        { onConflict: 'stripe_event_id' }
      )
    })

    it('should return 500 when webhook event upsert fails', async () => {
      const mockEvent = createMockStripeEvent({ type: 'checkout.session.completed' })
      mockStripeClient.webhooks.constructEvent.mockReturnValue(mockEvent)

      const webhookEventsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      }

      const upsertQuery = {
        upsert: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'webhook_events') {
          return webhookEventsQuery as any
        }
        return upsertQuery as any
      })

      const request = createWebhookRequest(mockEvent)
      const response = await POST(request as any)

      expect(response.status).toBe(500)
      expect(logger.error).toHaveBeenCalledWith(
        'Error upserting webhook event',
        expect.any(Object)
      )
    })
  })

  describe('Checkout Session Completed - Happy Path', () => {
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
      const tableQueries = new Map()
      tableQueries.set('webhook_events', {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnThis(),
      })

      tableQueries.set('products', {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockProduct,
          error: null,
        }),
      })

      tableQueries.set('rpc:process_payment_webhook', 'payment-id-123')

      tableQueries.set('payments', {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'payment-id-123', email_sent_at: null },
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
      })

      tableQueries.set('users', {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockUser,
          error: null,
        }),
      })

      tableQueries.set('payment_athletes', {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: mockPaymentAthletes,
          error: null,
        }),
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        const query = tableQueries.get(table) || {}
        return query as any
      })

      // Mock RPC
      const rpcQuery = {
        rpc: vi.fn().mockResolvedValue({
          data: 'payment-id-123',
          error: null,
        }),
      }
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'rpc') {
          return rpcQuery as any
        }
        return tableQueries.get(table) || {}
      })

      // Fix the RPC mock - it should be called on the query builder
      const baseQuery = {
        rpc: vi.fn().mockResolvedValue({
          data: 'payment-id-123',
          error: null,
        }),
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'rpc') {
          return baseQuery as any
        }
        const query = { ...tableQueries.get(table), ...baseQuery } || baseQuery
        return query as any
      })

      const request = createWebhookRequest(mockEvent)
      const response = await POST(request as any)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toEqual({ received: true })

      // Verify RPC was called with correct parameters
      expect(baseQuery.rpc).toHaveBeenCalledWith(
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
      expect(sendPurchaseConfirmation).toHaveBeenCalledWith(
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

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Sent purchase confirmation email to: test@example.com')
      )
    })
  })

  describe('Checkout Session - User Lookup Tests', () => {
    it('should lookup user by email when userId not in metadata', async () => {
      const mockEvent = createMockStripeEvent({
        type: 'checkout.session.completed',
        customerId: 'cus_123',
        paymentIntentId: 'pi_123',
      })
      mockStripeClient.webhooks.constructEvent.mockReturnValue(mockEvent)

      mockStripeClient.customers.retrieve.mockResolvedValue({
        id: 'cus_123',
        email: 'test@example.com',
        metadata: {}, // No userId
      } as any)

      mockStripeClient.paymentIntents.retrieve.mockResolvedValue({
        id: 'pi_123',
        amount: 10000,
        currency: 'usd',
      } as any)

      mockStripeClient.checkout.sessions.listLineItems.mockResolvedValue({
        data: mockLineItems,
      } as any)

      // Mock user lookup by email
      const usersQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'user-found-123' },
          error: null,
        }),
      }

      // Minimal mocks for other operations
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

      const productsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockProduct,
          error: null,
        }),
      }

      const rpcQuery = {
        rpc: vi.fn().mockResolvedValue({
          data: 'payment-id-123',
          error: null,
        }),
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') return usersQuery as any
        if (table === 'webhook_events') return webhookEventsQuery as any
        if (table === 'products') return productsQuery as any
        return rpcQuery as any
      })

      const request = createWebhookRequest(mockEvent)
      await POST(request as any)

      expect(usersQuery.single).toHaveBeenCalled()
      expect(rpcQuery.rpc).toHaveBeenCalledWith(
        'process_payment_webhook',
        expect.objectContaining({
          p_user_id: 'user-found-123',
        })
      )
      expect(logger.debug).toHaveBeenCalledWith('Found user by email')
    })

    it('should return 500 when userId cannot be determined', async () => {
      const mockEvent = createMockStripeEvent({
        type: 'checkout.session.completed',
        customerId: 'cus_123',
      })
      mockStripeClient.webhooks.constructEvent.mockReturnValue(mockEvent)

      mockStripeClient.customers.retrieve.mockResolvedValue({
        id: 'cus_123',
        email: 'test@example.com',
        metadata: {}, // No userId
      } as any)

      const usersQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      }

      const webhookEventsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'users') return usersQuery as any
        return webhookEventsQuery as any
      })

      const request = createWebhookRequest(mockEvent)
      const response = await POST(request as any)

      expect(response.status).toBe(500)
      expect(logger.error).toHaveBeenCalledWith(
        'Could not determine userId for payment processing'
      )
    })
  })

  describe('Checkout Session - Line Items Processing', () => {
    beforeEach(() => {
      const mockEvent = createMockStripeEvent({
        type: 'checkout.session.completed',
        customerId: 'cus_123',
        paymentIntentId: 'pi_123',
      })
      mockStripeClient.webhooks.constructEvent.mockReturnValue(mockEvent)

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

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'webhook_events') return webhookEventsQuery as any
        return {} as any
      })
    })

    it('should process multiple line items with athlete metadata', async () => {
      const mockEvent = createMockStripeEvent({
        type: 'checkout.session.completed',
        sessionId: 'cs_123',
        customerId: 'cus_123',
        paymentIntentId: 'pi_123',
        metadata: {
          athlete_0_id: 'athlete-1',
          athlete_0_product_id: 'product-1',
          athlete_1_id: 'athlete-2',
          athlete_1_product_id: 'product-2',
        },
      })
      mockStripeClient.webhooks.constructEvent.mockReturnValue(mockEvent)

      mockStripeClient.checkout.sessions.listLineItems.mockResolvedValue({
        data: [
          ...mockLineItems,
          {
            ...mockLineItems[0],
            id: 'li_2',
            price: { id: 'price_2' },
          },
        ],
      } as any)

      const productsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn()
          .mockResolvedValueOnce({
            data: { ...mockProduct, id: 'product-1' },
            error: null,
          })
          .mockResolvedValueOnce({
            data: { ...mockProduct, id: 'product-2' },
            error: null,
          }),
      }

      const rpcQuery = {
        rpc: vi.fn().mockResolvedValue({
          data: 'payment-id-123',
          error: null,
        }),
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'products') return productsQuery as any
        if (table === 'rpc') return rpcQuery as any
        return {} as any
      })

      const request = createWebhookRequest(mockEvent)
      await POST(request as any)

      expect(rpcQuery.rpc).toHaveBeenCalledWith(
        'process_payment_webhook',
        expect.objectContaining({
          p_line_items: expect.arrayContaining([
            expect.objectContaining({ product_id: 'product-1', athlete_id: 'athlete-1' }),
            expect.objectContaining({ product_id: 'product-2', athlete_id: 'athlete-2' }),
          ]),
        })
      )
    })

    it('should skip line items without athlete_id in metadata', async () => {
      const mockEvent = createMockStripeEvent({
        type: 'checkout.session.completed',
        sessionId: 'cs_123',
        customerId: 'cus_123',
        paymentIntentId: 'pi_123',
        metadata: {}, // No athlete metadata
      })
      mockStripeClient.webhooks.constructEvent.mockReturnValue(mockEvent)

      mockStripeClient.checkout.sessions.listLineItems.mockResolvedValue({
        data: mockLineItems,
      } as any)

      const rpcQuery = {
        rpc: vi.fn(),
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'rpc') return rpcQuery as any
        return {} as any
      })

      const request = createWebhookRequest(mockEvent)
      const response = await POST(request as any)

      expect(response.status).toBe(500)
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('No athlete_id in session metadata')
      )
    })

    it('should return 500 when no valid line items found', async () => {
      const mockEvent = createMockStripeEvent({
        type: 'checkout.session.completed',
        sessionId: 'cs_123',
        customerId: 'cus_123',
        paymentIntentId: 'pi_123',
        metadata: {}, // No athlete metadata
      })
      mockStripeClient.webhooks.constructEvent.mockReturnValue(mockEvent)

      mockStripeClient.checkout.sessions.listLineItems.mockResolvedValue({
        data: mockLineItems,
      } as any)

      const request = createWebhookRequest(mockEvent)
      const response = await POST(request as any)

      expect(response.status).toBe(500)
      expect(logger.error).toHaveBeenCalledWith('No valid line items found')
    })

    it('should lookup product by productId from metadata first', async () => {
      const mockEvent = createMockStripeEvent({
        type: 'checkout.session.completed',
        sessionId: 'cs_123',
        customerId: 'cus_123',
        paymentIntentId: 'pi_123',
        metadata: {
          athlete_0_id: 'athlete-1',
          athlete_0_product_id: 'product-123',
        },
      })
      mockStripeClient.webhooks.constructEvent.mockReturnValue(mockEvent)

      mockStripeClient.checkout.sessions.listLineItems.mockResolvedValue({
        data: mockLineItems,
      } as any)

      const productsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockProduct,
          error: null,
        }),
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'products') return productsQuery as any
        return {} as any
      })

      const request = createWebhookRequest(mockEvent)
      await POST(request as any)

      expect(productsQuery.eq).toHaveBeenCalledWith('id', 'product-123')
      expect(logger.debug).toHaveBeenCalledWith('Looking up product by ID')
    })

    it('should fallback to stripe_price_id when productId not in metadata', async () => {
      const mockEvent = createMockStripeEvent({
        type: 'checkout.session.completed',
        sessionId: 'cs_123',
        customerId: 'cus_123',
        paymentIntentId: 'pi_123',
        metadata: {
          athlete_0_id: 'athlete-1',
          // No athlete_0_product_id
        },
      })
      mockStripeClient.webhooks.constructEvent.mockReturnValue(mockEvent)

      mockStripeClient.checkout.sessions.listLineItems.mockResolvedValue({
        data: mockLineItems,
      } as any)

      const productsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockProduct,
          error: null,
        }),
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'products') return productsQuery as any
        return {} as any
      })

      const request = createWebhookRequest(mockEvent)
      await POST(request as any)

      expect(productsQuery.eq).toHaveBeenCalledWith(
        'stripe_price_id',
        mockLineItems[0].price.id
      )
      expect(logger.debug).toHaveBeenCalledWith('Looking up product by stripe_price_id')
    })
  })

  describe('Email Sending Tests', () => {
    it('should not send email when email_sent_at is already set', async () => {
      const mockEvent = createMockStripeEvent({
        type: 'checkout.session.completed',
        customerId: 'cus_123',
        paymentIntentId: 'pi_123',
        metadata: {
          athlete_0_id: mockAthlete.id,
          athlete_0_product_id: mockProduct.id,
        },
      })
      mockStripeClient.webhooks.constructEvent.mockReturnValue(mockEvent)

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

      const paymentsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'payment-123',
            email_sent_at: '2024-01-15T10:00:00Z',
          },
          error: null,
        }),
      }

      const productsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockProduct,
          error: null,
        }),
      }

      const rpcQuery = {
        rpc: vi.fn().mockResolvedValue({
          data: 'payment-123',
          error: null,
        }),
      }

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

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'payments') return paymentsQuery as any
        if (table === 'products') return productsQuery as any
        if (table === 'rpc') return rpcQuery as any
        return webhookEventsQuery as any
      })

      const request = createWebhookRequest(mockEvent)
      await POST(request as any)

      expect(logger.debug).toHaveBeenCalledWith(
        'Email already sent for this payment, skipping'
      )
      expect(sendPurchaseConfirmation).not.toHaveBeenCalled()
    })

    it('should handle email sending errors gracefully', async () => {
      const mockEvent = createMockStripeEvent({
        type: 'checkout.session.completed',
        customerId: 'cus_123',
        paymentIntentId: 'pi_123',
        metadata: {
          athlete_0_id: mockAthlete.id,
          athlete_0_product_id: mockProduct.id,
        },
      })
      mockStripeClient.webhooks.constructEvent.mockReturnValue(mockEvent)

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

      mockSendPurchaseConfirmation.mockRejectedValue(
        new Error('Email service error')
      )

      const paymentsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'payment-123', email_sent_at: null },
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
      }

      const productsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockProduct,
          error: null,
        }),
      }

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

      const rpcQuery = {
        rpc: vi.fn().mockResolvedValue({
          data: 'payment-123',
          error: null,
        }),
      }

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

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'payments') return paymentsQuery as any
        if (table === 'products') return productsQuery as any
        if (table === 'users') return usersQuery as any
        if (table === 'payment_athletes') return paymentAthletesQuery as any
        if (table === 'rpc') return rpcQuery as any
        return webhookEventsQuery as any
      })

      const request = createWebhookRequest(mockEvent)
      const response = await POST(request as any)

      expect(response.status).toBe(200)
      expect(logger.error).toHaveBeenCalledWith(
        'Error sending purchase confirmation email',
        expect.any(Error)
      )
      expect(rpcQuery.rpc).toHaveBeenCalled() // Payment was still processed
    })
  })

  describe('Other Event Types Tests', () => {
    it('should skip payment_intent.succeeded event', async () => {
      const mockEvent = createMockStripeEvent({
        type: 'payment_intent.succeeded',
        paymentIntentId: 'pi_123',
      })
      mockStripeClient.webhooks.constructEvent.mockReturnValue(mockEvent)

      const webhookEventsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      }

      mockSupabaseClient.from.mockImplementation(() => webhookEventsQuery as any)

      const request = createWebhookRequest(mockEvent)
      const response = await POST(request as any)

      expect(response.status).toBe(200)
      expect(logger.debug).toHaveBeenCalledWith(
        'payment_intent.succeeded - Skipping (handled in checkout.session.completed)'
      )
    })

    it('should handle payment_intent.payment_failed event', async () => {
      const mockEvent = createMockStripeEvent({
        type: 'payment_intent.payment_failed',
        paymentIntentId: 'pi_123',
      })
      mockStripeClient.webhooks.constructEvent.mockReturnValue(mockEvent)

      const webhookEventsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      }

      const paymentsQuery = {
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'payments') return paymentsQuery as any
        return webhookEventsQuery as any
      })

      const request = createWebhookRequest(mockEvent)
      const response = await POST(request as any)

      expect(response.status).toBe(200)
      expect(paymentsQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
        })
      )
    })

    it('should log unhandled event types', async () => {
      const mockEvent = createMockStripeEvent({
        type: 'checkout.session.completed',
      }) as any
      mockEvent.type = 'customer.created'
      mockStripeClient.webhooks.constructEvent.mockReturnValue(mockEvent)

      const webhookEventsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      }

      mockSupabaseClient.from.mockImplementation(() => webhookEventsQuery as any)

      const request = createWebhookRequest(mockEvent)
      const response = await POST(request as any)

      expect(response.status).toBe(200)
      expect(logger.debug).toHaveBeenCalledWith('Unhandled event type: customer.created')
    })
  })

  describe('Error Handling Tests', () => {
    it('should return 500 when RPC function fails', async () => {
      const mockEvent = createMockStripeEvent({
        type: 'checkout.session.completed',
        customerId: 'cus_123',
        paymentIntentId: 'pi_123',
        metadata: {
          athlete_0_id: mockAthlete.id,
          athlete_0_product_id: mockProduct.id,
        },
      })
      mockStripeClient.webhooks.constructEvent.mockReturnValue(mockEvent)

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

      const productsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockProduct,
          error: null,
        }),
      }

      const rpcQuery = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'RPC error' },
        }),
      }

      const webhookEventsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      }

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'products') return productsQuery as any
        if (table === 'rpc') return rpcQuery as any
        return webhookEventsQuery as any
      })

      const request = createWebhookRequest(mockEvent)
      const response = await POST(request as any)

      expect(response.status).toBe(500)
      expect(logger.error).toHaveBeenCalledWith(
        'Error processing payment via RPC',
        expect.any(Object)
      )
    })

    it('should return 500 for unexpected errors', async () => {
      const mockEvent = createMockStripeEvent({
        type: 'checkout.session.completed',
      })
      mockStripeClient.webhooks.constructEvent.mockReturnValue(mockEvent)

      const webhookEventsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          throw new Error('Unexpected error')
        }),
      }

      mockSupabaseClient.from.mockImplementation(() => webhookEventsQuery as any)

      const request = createWebhookRequest(mockEvent)
      const response = await POST(request as any)

      expect(response.status).toBe(500)
      const json = await response.json()
      expect(json).toEqual({ error: 'Webhook handler failed' })
      expect(logger.error).toHaveBeenCalledWith('Webhook error', expect.any(Error))
    })
  })
})

