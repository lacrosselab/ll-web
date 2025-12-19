import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createMockNextRequest,
  mockAuthUser,
  mockProduct,
} from '@/lib/email/__tests__/test-utils'

// Use vi.hoisted to create mocks that can be referenced in vi.mock factories
const mocks = vi.hoisted(() => {
  return {
    mockStripeClient: {
      customers: {
        create: vi.fn(),
      },
      checkout: {
        sessions: {
          create: vi.fn(),
        },
      },
      products: {
        retrieve: vi.fn(),
      },
    },
    mockSupabaseClient: {
      from: vi.fn(),
      auth: {
        getUser: vi.fn(),
      },
    },
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

// Mock Supabase Server
vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServer: vi.fn().mockResolvedValue(mocks.mockSupabaseClient),
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

describe('POST /api/create-checkout-session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
  })

  it('should create checkout session with valid line items', async () => {
    const adminUser = {
      ...mockAuthUser,
      email: 'user@example.com',
    }
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: adminUser },
      error: null,
    })

    // Mock user profile lookup (waiver signed, no existing Stripe customer)
    const usersQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { waiver_signed: true, stripe_customer_id: null },
        error: null,
      }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }

    // Mock product lookup
    const productsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { ...mockProduct, is_active: true, stripe_product_id: 'prod_123' },
        error: null,
      }),
    }

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'users') return usersQuery as any
      if (table === 'products') return productsQuery as any
      return {} as any
    })

    // Mock Stripe customer creation
    mockStripeClient.customers.create.mockResolvedValue({
      id: 'cus_123',
      email: adminUser.email,
    } as any)

    // Mock Stripe product retrieval
    mockStripeClient.products.retrieve.mockResolvedValue({
      id: 'prod_123',
      active: true,
    } as any)

    // Mock Stripe checkout session creation
    mockStripeClient.checkout.sessions.create.mockResolvedValue({
      id: 'cs_test_123',
    } as any)

    const request = createMockNextRequest({
      body: {
        lineItems: [
          {
            price: mockProduct.stripe_price_id,
            quantity: 1,
            metadata: {
              athlete_id: 'athlete-123',
              athlete_name: 'Test Athlete',
              product_id: mockProduct.id,
            },
          },
        ],
      },
    })

    const response = await POST(request as any)

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toEqual({ sessionId: 'cs_test_123' })

    // Verify Stripe checkout session was created
    expect(mockStripeClient.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        customer: 'cus_123',
        line_items: [
          {
            price: mockProduct.stripe_price_id,
            quantity: 1,
          },
        ],
        metadata: expect.objectContaining({
          user_id: adminUser.id,
          athlete_0_id: 'athlete-123',
        }),
      })
    )
  })

  it('should reject inactive products', async () => {
    const adminUser = {
      ...mockAuthUser,
      email: 'user@example.com',
    }
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: adminUser },
      error: null,
    })

    // Mock user profile lookup (waiver signed)
    const usersQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { waiver_signed: true, stripe_customer_id: null },
        error: null,
      }),
    }

    // Mock product lookup - inactive product
    const productsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { ...mockProduct, is_active: false, stripe_product_id: 'prod_123' },
        error: null,
      }),
    }

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'users') return usersQuery as any
      if (table === 'products') return productsQuery as any
      return {} as any
    })

    const request = createMockNextRequest({
      body: {
        lineItems: [
          {
            price: mockProduct.stripe_price_id,
            quantity: 1,
            metadata: {
              athlete_id: 'athlete-123',
              product_id: mockProduct.id,
            },
          },
        ],
      },
    })

    const response = await POST(request as any)

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toContain('no longer available')

    // Verify checkout session was NOT created
    expect(mockStripeClient.checkout.sessions.create).not.toHaveBeenCalled()
  })
})

