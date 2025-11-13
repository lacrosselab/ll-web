import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createMockSupabaseClient,
  createMockNextRequest,
  mockAuthUser,
} from '@/lib/email/__tests__/test-utils'

// Use vi.hoisted to create mocks that can be referenced in vi.mock factories
const mocks = vi.hoisted(() => {
  return {
    mockSupabaseClient: createMockSupabaseClient(),
    mockSendBroadcastToAudience: vi.fn().mockResolvedValue({ broadcastId: 'broadcast-123' }),
    logger: {
      info: vi.fn(),
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
  sendBroadcastToAudience: mocks.mockSendBroadcastToAudience,
}))

// Mock Logger
vi.mock('@/lib/utils', () => ({
  logger: mocks.logger,
}))

// Import after mocking
import { POST } from '../route'
import { sendBroadcastToAudience } from '@/lib/email/service'
import { logger } from '@/lib/utils'

// Reference the hoisted mocks
const mockSupabaseClient = mocks.mockSupabaseClient
const mockSendBroadcastToAudience = mocks.mockSendBroadcastToAudience

describe('POST /api/admin/broadcast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendBroadcastToAudience.mockResolvedValue({ broadcastId: 'broadcast-123' })
  })

  describe('Authentication Tests', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Unauthorized' },
      })

      const request = createMockNextRequest({
        body: {
          subject: 'Test',
          bodyText: 'Test body',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(401)
      const json = await response.json()
      expect(json).toEqual({ error: 'Unauthorized' })
      expect(sendBroadcastToAudience).not.toHaveBeenCalled()
    })

    it('should return 401 when auth check fails', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Auth failed'),
      })

      const request = createMockNextRequest({
        body: {
          subject: 'Test',
          bodyText: 'Test body',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(401)
      expect(sendBroadcastToAudience).not.toHaveBeenCalled()
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
          subject: 'Test',
          bodyText: 'Test body',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(403)
      const json = await response.json()
      expect(json).toEqual({ error: 'Forbidden' })
      expect(sendBroadcastToAudience).not.toHaveBeenCalled()
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

      const request = createMockNextRequest({
        body: {
          subject: 'Test',
          bodyText: 'Test body',
        },
      })
      const response = await POST(request as any)

      // Should not be 403 (proves auth passed)
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
          subject: 'Test',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json).toEqual({
        error: 'Subject and body text are required',
      })
    })

    it('should return 400 when both subject and bodyText are missing', async () => {
      const request = createMockNextRequest({
        body: {},
      })
      const response = await POST(request as any)

      expect(response.status).toBe(400)
    })
  })

  describe('Broadcast Sending Tests', () => {
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

    it('should send broadcast to Resend audience successfully', async () => {
      mockSendBroadcastToAudience.mockResolvedValue({ broadcastId: 'broadcast-456' })

      const request = createMockNextRequest({
        body: {
          subject: 'Test Subject',
          bodyText: 'Test body content',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toEqual({
        success: true,
        broadcastId: 'broadcast-456',
        message: 'Broadcast sent to all users in Resend audience',
      })
      expect(sendBroadcastToAudience).toHaveBeenCalledWith({
        audienceId: 'default',
        subject: 'Test Subject',
        bodyText: 'Test body content',
        context: expect.objectContaining({
          traceId: expect.any(String),
        }),
      })
    })

    it('should log broadcast start', async () => {
      const request = createMockNextRequest({
        body: {
          subject: 'Test Subject',
          bodyText: 'Test body',
        },
      })
      await POST(request as any)

      expect(logger.info).toHaveBeenCalledWith(
        'broadcast.start',
        expect.objectContaining({
          subject: 'Test Subject',
          traceId: expect.any(String),
        })
      )
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

    it('should return 500 when sendBroadcastToAudience throws error', async () => {
      mockSendBroadcastToAudience.mockRejectedValue(new Error('Resend API error'))

      const request = createMockNextRequest({
        body: {
          subject: 'Test',
          bodyText: 'Test body',
        },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(500)
      const json = await response.json()
      expect(json.error).toBeDefined()
      expect(json.error).toContain('Failed to send broadcast email')
      expect(logger.error).toHaveBeenCalled()
    })

    it('should handle unknown errors gracefully', async () => {
      mockSendBroadcastToAudience.mockRejectedValue('Unknown error')

      const request = createMockNextRequest({
        body: {
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
})
