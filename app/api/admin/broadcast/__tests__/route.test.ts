import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createMockSupabaseClient,
  createMockNextRequest,
  mockAuthUser,
  mockUser,
  mockPayment,
} from '@/lib/email/__tests__/test-utils'

// Use vi.hoisted to create mocks that can be referenced in vi.mock factories
const mocks = vi.hoisted(() => {
  return {
    mockSupabaseClient: createMockSupabaseClient(),
    mockSendBroadcastEmail: vi.fn().mockResolvedValue({ sent: 0, failed: 0 }),
    logger: {
      debug: vi.fn(),
      error: vi.fn(),
    },
  }
})

// Mock Supabase Server
vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServer: vi.fn().mockResolvedValue(mocks.mockSupabaseClient),
}))

// Mock Email Service
vi.mock('@/lib/email/service', () => ({
  sendBroadcastEmail: mocks.mockSendBroadcastEmail,
}))

// Mock Logger
vi.mock('@/lib/utils', () => ({
  logger: mocks.logger,
}))

// Import after mocking
import { POST } from '../route'
import { sendBroadcastEmail } from '@/lib/email/service'
import { logger } from '@/lib/utils'

// Reference the hoisted mocks
const mockSupabaseClient = mocks.mockSupabaseClient
const mockSendBroadcastEmail = mocks.mockSendBroadcastEmail

describe('POST /api/admin/broadcast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendBroadcastEmail.mockResolvedValue({ sent: 0, failed: 0 })
  })

  describe('Authentication Tests', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Unauthorized' },
      })

      const request = createMockNextRequest({
        body: {
          audienceType: 'all',
          subject: 'Test',
          bodyText: 'Test body',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(401)
      const json = await response.json()
      expect(json).toEqual({ error: 'Unauthorized' })
      expect(sendBroadcastEmail).not.toHaveBeenCalled()
    })

    it('should return 401 when auth check fails', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Auth failed'),
      })

      const request = createMockNextRequest({
        body: {
          audienceType: 'all',
          subject: 'Test',
          bodyText: 'Test body',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(401)
      expect(sendBroadcastEmail).not.toHaveBeenCalled()
    })
  })

  describe('Authorization Tests', () => {
    it('should return 403 when user is not admin', async () => {
      const nonAdminUser = {
        ...mockAuthUser,
        email: 'user@example.com',
      }
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: nonAdminUser },
        error: null,
      })

      const request = createMockNextRequest({
        body: {
          audienceType: 'all',
          subject: 'Test',
          bodyText: 'Test body',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(403)
      const json = await response.json()
      expect(json).toEqual({ error: 'Forbidden' })
      expect(sendBroadcastEmail).not.toHaveBeenCalled()
    })

    it('should allow admin user with @thelacrosselab.com email', async () => {
      const adminUser = {
        ...mockAuthUser,
        email: 'admin@thelacrosselab.com',
      }
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: adminUser },
        error: null,
      })

      // Mock Supabase to return empty payments array
      const paymentsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
      mockSupabaseClient.from.mockReturnValue(paymentsQuery as any)

      const request = createMockNextRequest({
        body: {
          audienceType: 'all',
          subject: 'Test',
          bodyText: 'Test body',
        },
      })
      const response = await POST(request as any)

      // Should not be 403 (will be 400 for no recipients, but proves auth passed)
      expect(response.status).not.toBe(403)
    })
  })

  describe('Validation Tests', () => {
    beforeEach(() => {
      const adminUser = {
        ...mockAuthUser,
        email: 'admin@thelacrosselab.com',
      }
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: adminUser },
        error: null,
      })
    })

    it('should return 400 when subject is missing', async () => {
      const request = createMockNextRequest({
        body: {
          audienceType: 'all',
          bodyText: 'Test',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json).toEqual({
        error: 'Subject and body text are required',
      })
    })

    it('should return 400 when bodyText is missing', async () => {
      const request = createMockNextRequest({
        body: {
          audienceType: 'all',
          subject: 'Test',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(400)
    })

    it('should return 400 when both subject and bodyText are missing', async () => {
      const request = createMockNextRequest({
        body: {
          audienceType: 'all',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(400)
    })

    it('should return 400 when no recipients found', async () => {
      const paymentsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
      mockSupabaseClient.from.mockReturnValue(paymentsQuery as any)

      const request = createMockNextRequest({
        body: {
          audienceType: 'all',
          subject: 'Test',
          bodyText: 'Test body',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json).toEqual({
        error: 'No recipients found for the selected audience',
      })
      expect(sendBroadcastEmail).not.toHaveBeenCalled()
    })

    it('should return 400 for invalid audience filter parameters', async () => {
      const request = createMockNextRequest({
        body: {
          audienceType: 'session',
          subject: 'Test',
          bodyText: 'Test',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json).toEqual({
        error: 'Invalid audience filter parameters',
      })
    })
  })

  describe("Audience Filtering Tests - 'all' Type", () => {
    beforeEach(() => {
      const adminUser = {
        ...mockAuthUser,
        email: 'admin@thelacrosselab.com',
      }
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: adminUser },
        error: null,
      })
    })

    it("should fetch all users with successful payments for audienceType 'all'", async () => {
      const paymentsData = [
        { user_id: 'user1', users: { email: 'user1@example.com' } },
        { user_id: 'user2', users: { email: 'user2@example.com' } },
        { user_id: 'user1', users: { email: 'user1@example.com' } }, // duplicate
      ]

      const paymentsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: paymentsData, error: null }),
      }
      mockSupabaseClient.from.mockReturnValue(paymentsQuery as any)

      mockSendBroadcastEmail.mockResolvedValue({ sent: 2, failed: 0 })

      const request = createMockNextRequest({
        body: {
          audienceType: 'all',
          subject: 'Test',
          bodyText: 'Test body',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toEqual({
        success: true,
        sent: 2,
        failed: 0,
        total: 2,
      })
      expect(sendBroadcastEmail).toHaveBeenCalledWith({
        to: ['user1@example.com', 'user2@example.com'],
        subject: 'Test',
        bodyText: 'Test body',
      })
    })
  })

  describe("Audience Filtering Tests - 'session' Type", () => {
    beforeEach(() => {
      const adminUser = {
        ...mockAuthUser,
        email: 'admin@thelacrosselab.com',
      }
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: adminUser },
        error: null,
      })
    })

    it("should fetch users for specific product with audienceType 'session'", async () => {
      const paymentAthletesData = [
        {
          payment: {
            user_id: 'user1',
            status: 'succeeded',
            users: { email: 'user1@example.com' },
          },
        },
        {
          payment: {
            user_id: 'user2',
            status: 'succeeded',
            users: { email: 'user2@example.com' },
          },
        },
      ]

      const paymentAthletesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi
          .fn()
          .mockReturnThis()
          .mockImplementation((field: string, value: string) => {
            if (field === 'product_id' && value === 'product-123') {
              return {
                eq: vi.fn().mockResolvedValue({
                  data: paymentAthletesData,
                  error: null,
                }),
              }
            }
            return {
              eq: vi.fn().mockResolvedValue({
                data: paymentAthletesData,
                error: null,
              }),
            }
          }),
      }
      mockSupabaseClient.from.mockReturnValue(paymentAthletesQuery as any)

      mockSendBroadcastEmail.mockResolvedValue({ sent: 2, failed: 0 })

      const request = createMockNextRequest({
        body: {
          audienceType: 'session',
          productId: 'product-123',
          subject: 'Session Update',
          bodyText: 'Details',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toEqual({
        success: true,
        sent: 2,
        failed: 0,
        total: 2,
      })
      expect(sendBroadcastEmail).toHaveBeenCalledWith({
        to: ['user1@example.com', 'user2@example.com'],
        subject: 'Session Update',
        bodyText: 'Details',
      })
    })

    it("should return 400 when productId is missing for audienceType 'session'", async () => {
      const request = createMockNextRequest({
        body: {
          audienceType: 'session',
          subject: 'Test',
          bodyText: 'Test',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json).toEqual({
        error: 'Invalid audience filter parameters',
      })
    })
  })

  describe("Audience Filtering Tests - 'dateRange' Type", () => {
    beforeEach(() => {
      const adminUser = {
        ...mockAuthUser,
        email: 'admin@thelacrosselab.com',
      }
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: adminUser },
        error: null,
      })
    })

    it("should fetch users for date range with audienceType 'dateRange'", async () => {
      const paymentAthletesData = [
        {
          payment: {
            user_id: 'user1',
            status: 'succeeded',
            users: { email: 'user1@example.com' },
          },
          product: { session_date: '2024-01-15' },
        },
        {
          payment: {
            user_id: 'user2',
            status: 'succeeded',
            users: { email: 'user2@example.com' },
          },
          product: { session_date: '2024-01-20' },
        },
        {
          payment: {
            user_id: 'user3',
            status: 'succeeded',
            users: { email: 'user3@example.com' },
          },
          product: { session_date: '2024-01-25' },
        },
      ]

      const paymentAthletesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({
          data: paymentAthletesData,
          error: null,
        }),
      }
      mockSupabaseClient.from.mockReturnValue(paymentAthletesQuery as any)

      mockSendBroadcastEmail.mockResolvedValue({ sent: 3, failed: 0 })

      const request = createMockNextRequest({
        body: {
          audienceType: 'dateRange',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          subject: 'Monthly Update',
          bodyText: 'Content',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toEqual({
        success: true,
        sent: 3,
        failed: 0,
        total: 3,
      })
      expect(sendBroadcastEmail).toHaveBeenCalledWith({
        to: ['user1@example.com', 'user2@example.com', 'user3@example.com'],
        subject: 'Monthly Update',
        bodyText: 'Content',
      })
    })

    it("should return 400 when date range parameters are missing", async () => {
      const request = createMockNextRequest({
        body: {
          audienceType: 'dateRange',
          subject: 'Test',
          bodyText: 'Test',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json).toEqual({
        error: 'Invalid audience filter parameters',
      })
    })
  })

  describe('Error Handling Tests', () => {
    beforeEach(() => {
      const adminUser = {
        ...mockAuthUser,
        email: 'admin@thelacrosselab.com',
      }
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: adminUser },
        error: null,
      })
    })

    it("should return 500 when Supabase query fails for 'all' audience", async () => {
      const paymentsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      }
      mockSupabaseClient.from.mockReturnValue(paymentsQuery as any)

      const request = createMockNextRequest({
        body: {
          audienceType: 'all',
          subject: 'Test',
          bodyText: 'Test body',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(500)
      const json = await response.json()
      expect(json).toEqual({
        error: 'Failed to fetch audience',
      })
      expect(logger.error).toHaveBeenCalled()
      expect(sendBroadcastEmail).not.toHaveBeenCalled()
    })

    it("should return 500 when Supabase query fails for 'session' audience", async () => {
      const paymentAthletesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi
          .fn()
          .mockReturnThis()
          .mockImplementation(() => ({
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          })),
      }
      mockSupabaseClient.from.mockReturnValue(paymentAthletesQuery as any)

      const request = createMockNextRequest({
        body: {
          audienceType: 'session',
          productId: 'product-123',
          subject: 'Test',
          bodyText: 'Test body',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(500)
    })

    it('should return 500 when sendBroadcastEmail throws error', async () => {
      const paymentsData = [
        { user_id: 'user1', users: { email: 'user1@example.com' } },
      ]

      const paymentsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: paymentsData, error: null }),
      }
      mockSupabaseClient.from.mockReturnValue(paymentsQuery as any)

      mockSendBroadcastEmail.mockRejectedValue(new Error('Email service error'))

      const request = createMockNextRequest({
        body: {
          audienceType: 'all',
          subject: 'Test',
          bodyText: 'Test body',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(500)
      const json = await response.json()
      expect(json.error).toBeDefined()
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('Success Response Tests', () => {
    beforeEach(() => {
      const adminUser = {
        ...mockAuthUser,
        email: 'admin@thelacrosselab.com',
      }
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: adminUser },
        error: null,
      })
    })

    it('should return correct counts when some emails fail', async () => {
      const paymentsData = Array.from({ length: 5 }, (_, i) => ({
        user_id: `user${i}`,
        users: { email: `user${i}@example.com` },
      }))

      const paymentsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: paymentsData, error: null }),
      }
      mockSupabaseClient.from.mockReturnValue(paymentsQuery as any)

      mockSendBroadcastEmail.mockResolvedValue({ sent: 3, failed: 2 })

      const request = createMockNextRequest({
        body: {
          audienceType: 'all',
          subject: 'Test',
          bodyText: 'Test body',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toEqual({
        success: true,
        sent: 3,
        failed: 2,
        total: 5,
      })
    })

    it('should log recipient count before sending', async () => {
      const paymentsData = Array.from({ length: 10 }, (_, i) => ({
        user_id: `user${i}`,
        users: { email: `user${i}@example.com` },
      }))

      const paymentsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: paymentsData, error: null }),
      }
      mockSupabaseClient.from.mockReturnValue(paymentsQuery as any)

      mockSendBroadcastEmail.mockResolvedValue({ sent: 10, failed: 0 })

      const request = createMockNextRequest({
        body: {
          audienceType: 'all',
          subject: 'Test',
          bodyText: 'Test body',
        },
      })
      await POST(request as any)

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('10 recipients')
      )
    })
  })
})

