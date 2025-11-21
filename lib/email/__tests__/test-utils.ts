import { vi } from 'vitest'
import type { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import type Stripe from 'stripe'

/**
 * Type definitions for mock objects
 */

export type MockResendClient = {
  contacts: {
    create: ReturnType<typeof vi.fn>
  }
  emails: {
    send: ReturnType<typeof vi.fn>
  }
}

export type MockSupabaseQueryBuilder<T = any> = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  rpc: ReturnType<typeof vi.fn>
}

export type MockSupabaseClient = {
  from: ReturnType<typeof vi.fn>
  auth: {
    getUser: ReturnType<typeof vi.fn>
  }
}

export type MockStripeEvent = Stripe.Event

export type MockNextRequest = {
  json: ReturnType<typeof vi.fn>
  text: ReturnType<typeof vi.fn>
  headers: {
    get: ReturnType<typeof vi.fn>
  }
  method: string
  url: string
}

/**
 * Test fixtures for reusable test data
 */

const mockEmailData = {
  to: 'test@example.com',
  customerName: 'Test User',
  orderNumber: 'ORD-123456',
  orderDate: new Date().toISOString(),
  items: [
    {
      productName: 'Test Session',
      athleteName: 'Test Athlete',
      quantity: 1,
      unitPriceCents: 10000,
      sessionDate: '2024-01-15',
      sessionTime: '14:30:00',
      location: undefined as string | undefined,
    },
  ],
  totalAmountCents: 10000,
  currency: 'USD',
}

const mockBroadcastData = {
  to: ['test1@example.com', 'test2@example.com'],
  subject: 'Test Subject',
  bodyText: 'Test body content',
}

const mockContactData = {
  email: 'test@example.com',
  name: 'Test User',
}

const mockUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com',
  full_name: 'Test User',
  created_at: new Date().toISOString(),
}

const mockAuthUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com',
  user_metadata: {
    full_name: 'Test User',
  },
}

const mockPayment = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  stripe_payment_intent_id: 'pi_test1234567890',
  amount: 10000,
  currency: 'usd',
  user_id: '550e8400-e29b-41d4-a716-446655440000',
  status: 'succeeded',
  created_at: new Date().toISOString(),
}

const mockPaymentAthletes = [
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    payment_id: '550e8400-e29b-41d4-a716-446655440001',
    athlete_id: '550e8400-e29b-41d4-a716-446655440003',
    product_id: '550e8400-e29b-41d4-a716-446655440004',
    quantity: 1,
    unit_price_cents: 10000,
    athlete: {
      id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'Test Athlete',
    },
    product: {
      id: '550e8400-e29b-41d4-a716-446655440004',
      name: 'Test Session',
      session_date: '2024-01-15',
      session_time: '14:30:00',
      description: 'Test description',
    },
  },
]

const mockLineItems = [
  {
    id: 'li_test1234567890',
    object: 'line_item',
    amount: 10000,
    currency: 'usd',
    quantity: 1,
    description: 'Test Session',
    price: {
      id: 'price_test1234567890',
      object: 'price',
      active: true,
      currency: 'usd',
      unit_amount: 10000,
    },
  },
]

const mockProduct = {
  id: '550e8400-e29b-41d4-a716-446655440004',
  name: 'Test Session',
  price_cents: 10000,
  stripe_price_id: 'price_test1234567890',
  session_date: '2024-01-15',
  session_time: '14:30:00',
  description: 'Test description',
  created_at: new Date().toISOString(),
}

const mockAthlete = {
  id: '550e8400-e29b-41d4-a716-446655440003',
  name: 'Test Athlete',
  created_at: new Date().toISOString(),
}

/**
 * Helper utilities
 */

/**
 * Creates a success response object matching Supabase/Resend patterns
 */
function mockSuccessResponse<T>(data: T): { data: T; error: null } {
  return { data, error: null }
}

/**
 * Creates an error response object matching Supabase/Resend patterns
 */
function mockErrorResponse(error: any): { data: null; error: any } {
  return { data: null, error }
}

/**
 * Internal helper for building chainable query mocks
 */
function createMockSupabaseQueryBuilder<T = any>(
  tableData: Map<string, any>,
  errorResponse?: any
): MockSupabaseQueryBuilder<T> {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => {
      if (errorResponse) {
        return Promise.resolve(mockErrorResponse(errorResponse))
      }
      const tableName = (builder as any)._tableName || 'default'
      const data = tableData.get(tableName) || null
      return Promise.resolve(mockSuccessResponse(data))
    }),
    rpc: vi.fn().mockImplementation((functionName: string, params?: any) => {
      if (errorResponse) {
        return Promise.resolve(mockErrorResponse(errorResponse))
      }
      // Default RPC response - can be overridden
      return Promise.resolve(mockSuccessResponse(null))
    }),
  }

  // Store table name for later use
  builder._tableName = 'default'

  return builder as MockSupabaseQueryBuilder<T>
}

/**
 * Mock Factory Functions
 */

/**
 * Creates a mock Resend client with contacts.create() and emails.send() methods
 * 
 * @param options - Optional configuration for customizing mock behavior
 * @returns Mock Resend client matching the Resend SDK structure
 * 
 * @example
 * ```ts
 * const mockClient = createMockResendClient()
 * mockClient.emails.send.mockResolvedValue({ data: { id: '123' }, error: null })
 * ```
 */
function createMockResendClient(options?: {
  contactsCreateResponse?: { data: { id: string } | null; error: any }
  emailsSendResponse?: { data: { id: string } | null; error: any }
}): MockResendClient {
  const contactsCreate = vi.fn()
  const emailsSend = vi.fn()

  if (options?.contactsCreateResponse) {
    contactsCreate.mockResolvedValue(options.contactsCreateResponse)
  } else {
    contactsCreate.mockResolvedValue(mockSuccessResponse({ id: 'mock-id' }))
  }

  if (options?.emailsSendResponse) {
    emailsSend.mockResolvedValue(options.emailsSendResponse)
  } else {
    emailsSend.mockResolvedValue(mockSuccessResponse({ id: 'mock-id' }))
  }

  return {
    contacts: {
      create: contactsCreate,
    },
    emails: {
      send: emailsSend,
    },
  }
}

/**
 * Creates a mock Supabase client with chainable query builder pattern
 * 
 * @param options - Optional configuration for table data and error responses
 * @returns Mock Supabase client matching @supabase/supabase-js structure
 * 
 * @example
 * ```ts
 * const mockClient = createMockSupabaseClient({
 *   tableData: new Map([
 *     ['users', { id: '123', email: 'test@example.com' }]
 *   ])
 * })
 * 
 * const result = await mockClient.from('users').select('*').eq('id', '123').single()
 * ```
 */
function createMockSupabaseClient(options?: {
  tableData?: Map<string, any>
  errorResponse?: any
  authUserResponse?: { data: { user: any } | null; error: any }
}): MockSupabaseClient {
  const tableData = options?.tableData || new Map<string, any>()
  const errorResponse = options?.errorResponse

  const from = vi.fn((tableName: string) => {
    const builder = createMockSupabaseQueryBuilder(tableData, errorResponse)
    builder._tableName = tableName
    
    // Override single() to use table-specific data
    builder.single = vi.fn().mockImplementation(() => {
      if (errorResponse) {
        return Promise.resolve(mockErrorResponse(errorResponse))
      }
      const data = tableData.get(tableName) || null
      return Promise.resolve(mockSuccessResponse(data))
    })

    // Override insert() to return inserted data
    builder.insert = vi.fn().mockImplementation((data: any) => {
      if (errorResponse) {
        return Promise.resolve(mockErrorResponse(errorResponse))
      }
      return Promise.resolve(mockSuccessResponse(data))
    })

    // Override update() to return updated data
    builder.update = vi.fn().mockImplementation((data: any) => {
      if (errorResponse) {
        return Promise.resolve(mockErrorResponse(errorResponse))
      }
      return Promise.resolve(mockSuccessResponse(data))
    })

    // Override upsert() to return upserted data
    builder.upsert = vi.fn().mockImplementation((data: any, options?: any) => {
      if (errorResponse) {
        return Promise.resolve(mockErrorResponse(errorResponse))
      }
      return Promise.resolve(mockSuccessResponse(data))
    })

    // Override delete() to return deleted data
    builder.delete = vi.fn().mockImplementation(() => {
      if (errorResponse) {
        return Promise.resolve(mockErrorResponse(errorResponse))
      }
      return Promise.resolve(mockSuccessResponse(null))
    })

    // Override rpc() to allow custom function responses
    builder.rpc = vi.fn().mockImplementation((functionName: string, params?: any) => {
      if (errorResponse) {
        return Promise.resolve(mockErrorResponse(errorResponse))
      }
      // Check if there's specific RPC data in tableData
      const rpcKey = `rpc:${functionName}`
      const data = tableData.get(rpcKey) || null
      return Promise.resolve(mockSuccessResponse(data))
    })

    return builder
  })

  const getUser = vi.fn()
  if (options?.authUserResponse) {
    getUser.mockResolvedValue(options.authUserResponse)
  } else {
    getUser.mockResolvedValue(mockSuccessResponse({ user: mockAuthUser }))
  }

  return {
    from,
    auth: {
      getUser,
    },
  }
}

/**
 * Creates a mock Next.js Request object
 * 
 * @param options - Optional configuration for request properties
 * @returns Mock NextRequest matching Next.js structure
 * 
 * @example
 * ```ts
 * const mockRequest = createMockNextRequest({
 *   body: { userId: '123' },
 *   headers: { 'stripe-signature': 'test-signature' },
 *   method: 'POST',
 *   url: 'https://example.com/api/webhook'
 * })
 * ```
 */
function createMockNextRequest(options?: {
  body?: any
  headers?: Record<string, string>
  method?: string
  url?: string
}): MockNextRequest {
  const body = options?.body
  const headers = options?.headers || {}
  const method = options?.method || 'POST'
  const url = options?.url || 'https://example.com/api/webhook'

  const json = vi.fn().mockResolvedValue(body || {})
  const text = vi.fn().mockResolvedValue(JSON.stringify(body || ''))
  const getHeader = vi.fn((key: string) => headers[key] || null)

  return {
    json,
    text,
    headers: {
      get: getHeader,
    },
    method,
    url,
  }
}

/**
 * Creates a mock Stripe webhook event
 * 
 * @param options - Optional configuration for event type and data
 * @returns Mock Stripe.Event matching Stripe SDK structure
 * 
 * @example
 * ```ts
 * // Checkout session completed event
 * const mockEvent = createMockStripeEvent({
 *   type: 'checkout.session.completed',
 *   sessionId: 'cs_test123',
 *   customerId: 'cus_test123',
 *   paymentIntentId: 'pi_test123',
 *   amountTotal: 10000,
 *   metadata: { userId: '123' }
 * })
 * 
 * // Payment intent succeeded event
 * const mockEvent = createMockStripeEvent({
 *   type: 'payment_intent.succeeded',
 *   paymentIntentId: 'pi_test123',
 *   amount: 10000,
 *   metadata: { userId: '123' }
 * })
 * ```
 */
function createMockStripeEvent(options?: {
  type?: 'checkout.session.completed' | 'payment_intent.succeeded' | 'payment_intent.payment_failed' | 'charge.succeeded'
  sessionId?: string
  customerId?: string
  paymentIntentId?: string
  amountTotal?: number
  amount?: number
  currency?: string
  metadata?: Record<string, string>
  lineItems?: Array<{
    id: string
    price: {
      id: string
    }
    quantity: number
  }>
  customerEmail?: string
  customerMetadata?: Record<string, string>
}): MockStripeEvent {
  const eventType = options?.type || 'checkout.session.completed'
  const sessionId = options?.sessionId || 'cs_test1234567890'
  const customerId = options?.customerId || 'cus_test1234567890'
  const paymentIntentId = options?.paymentIntentId || 'pi_test1234567890'
  const amountTotal = options?.amountTotal || 10000
  const amount = options?.amount || amountTotal
  const currency = options?.currency || 'usd'
  const metadata = options?.metadata || {}
  const customerEmail = options?.customerEmail || 'test@example.com'
  const customerMetadata = options?.customerMetadata || metadata

  let eventData: any

  switch (eventType) {
    case 'checkout.session.completed': {
      eventData = {
        id: sessionId,
        object: 'checkout.session',
        customer: customerId,
        payment_intent: paymentIntentId,
        payment_status: 'paid',
        amount_total: amountTotal,
        currency,
        metadata,
      } as Stripe.Checkout.Session
      break
    }

    case 'payment_intent.succeeded': {
      eventData= {
        id: paymentIntentId,
        object: 'payment_intent',
        amount,
        currency,
        status: 'succeeded',
        metadata,
      } as Stripe.PaymentIntent
      break
    }

    case 'payment_intent.payment_failed': {
      eventData = {
        id: paymentIntentId,
        object: 'payment_intent',
        amount,
        currency,
        status: 'payment_failed',
        metadata,
      } as Stripe.PaymentIntent
      break
    }

    case 'charge.succeeded': {
      eventData = {
        id: 'ch_test1234567890',
        object: 'charge',
        amount,
        currency,
        payment_intent: paymentIntentId,
        customer: customerId,
      } as Stripe.Charge
      break
    }

    default:
      eventData = {
        id: sessionId,
        object: 'checkout.session',
        customer: customerId,
        payment_intent: paymentIntentId,
        payment_status: 'paid',
        amount_total: amountTotal,
        currency,
        metadata,
      } as Stripe.Checkout.Session
  }

  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    type: eventType,
    data: {
      object: eventData,
    },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: {
      id: null,
      idempotency_key: null,
    },
  } as Stripe.Event
}

/**
 * Export all factories, fixtures, and types
 */

export {
  createMockResendClient,
  createMockSupabaseClient,
  createMockNextRequest,
  createMockStripeEvent,
  mockEmailData,
  mockBroadcastData,
  mockContactData,
  mockUser,
  mockAuthUser,
  mockPayment,
  mockPaymentAthletes,
  mockLineItems,
  mockProduct,
  mockAthlete,
  mockSuccessResponse,
  mockErrorResponse,
}

export type {
  MockResendClient,
  MockSupabaseClient,
  MockSupabaseQueryBuilder,
  MockStripeEvent,
  MockNextRequest,
}

