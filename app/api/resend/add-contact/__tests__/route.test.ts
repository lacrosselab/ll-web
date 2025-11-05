import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../route'
import {
  createMockSupabaseClient,
  createMockNextRequest,
  mockAuthUser,
  mockContactData,
} from '@/lib/email/__tests__/test-utils'

// Mock Supabase Server
const mockSupabaseClient = createMockSupabaseClient()
vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServer: vi.fn().mockResolvedValue(mockSupabaseClient),
}))

// Mock Email Service
const mockAddContactToResend = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/email/service', () => ({
  addContactToResend: mockAddContactToResend,
}))

// Mock Logger
vi.mock('@/lib/utils', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}))

import { addContactToResend } from '@/lib/email/service'
import { logger } from '@/lib/utils'

describe('POST /api/resend/add-contact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAddContactToResend.mockResolvedValue(undefined)
  })

  describe('Authentication Tests', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Unauthorized' },
      })

      const request = createMockNextRequest({ body: mockContactData })
      const response = await POST(request as any)

      expect(response.status).toBe(401)
      const json = await response.json()
      expect(json).toEqual({ error: 'Unauthorized' })
      expect(addContactToResend).not.toHaveBeenCalled()
    })

    it('should return 401 when auth check fails', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Auth failed'),
      })

      const request = createMockNextRequest({ body: mockContactData })
      const response = await POST(request as any)

      expect(response.status).toBe(401)
      expect(addContactToResend).not.toHaveBeenCalled()
    })
  })

  describe('Validation Tests', () => {
    it('should return 400 when email is missing', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      })

      const request = createMockNextRequest({ body: { name: 'Test User' } })
      const response = await POST(request as any)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json).toEqual({ error: 'Email is required' })
      expect(addContactToResend).not.toHaveBeenCalled()
    })

    it('should return 400 when email is empty string', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      })

      const request = createMockNextRequest({
        body: { email: '', name: 'Test User' },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(400)
      expect(addContactToResend).not.toHaveBeenCalled()
    })
  })

  describe('Success Tests', () => {
    it('should add contact successfully with email and name', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      })

      const request = createMockNextRequest({
        body: { email: 'test@example.com', name: 'Test User' },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toEqual({ success: true })
      expect(addContactToResend).toHaveBeenCalledOnce()
      expect(addContactToResend).toHaveBeenCalledWith(
        'test@example.com',
        'Test User'
      )
    })

    it('should add contact successfully with only email', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      })

      const request = createMockNextRequest({
        body: { email: 'test@example.com' },
      })
      const response = await POST(request as any)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toEqual({ success: true })
      expect(addContactToResend).toHaveBeenCalledWith('test@example.com', undefined)
    })
  })

  describe('Error Handling Tests', () => {
    it('should return 500 when addContactToResend throws error', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      })

      mockAddContactToResend.mockRejectedValue(new Error('Resend API error'))

      const request = createMockNextRequest({ body: mockContactData })
      const response = await POST(request as any)

      expect(response.status).toBe(500)
      const json = await response.json()
      expect(json).toEqual({
        success: false,
        error: 'Failed to add contact',
      })
      expect(logger.error).toHaveBeenCalled()
    })

    it('should return 500 when request.json() throws error', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockAuthUser },
        error: null,
      })

      const request = createMockNextRequest({ body: mockContactData })
      request.json = vi.fn().mockRejectedValue(new Error('JSON parse error'))

      const response = await POST(request as any)

      expect(response.status).toBe(500)
      expect(logger.error).toHaveBeenCalled()
    })
  })
})

