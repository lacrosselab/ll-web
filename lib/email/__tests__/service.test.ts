import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createMockResendClient,
  mockEmailData,
  mockSuccessResponse,
} from './test-utils'

// Use vi.hoisted to create mocks that can be referenced in vi.mock factories
const mocks = vi.hoisted(() => {
  return {
    mockResendClient: createMockResendClient(),
    mockResendWithBroadcasts: {
      ...createMockResendClient(),
      broadcasts: {
        create: vi.fn(),
        send: vi.fn(),
      },
      segments: {
        list: vi.fn(),
      },
    },
    logger: {
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
    maskEmail: vi.fn((email: string) => email),
  }
})

// Mock the resend client
vi.mock('../resend-client', () => ({
  getResend: vi.fn(() => mocks.mockResendWithBroadcasts),
}))

// Mock logger and utilities
vi.mock('@/lib/utils', () => ({
  logger: mocks.logger,
  maskEmail: mocks.maskEmail,
}))

// Import after mocking
import { sendPurchaseConfirmation, sendBroadcastToAudience } from '../service'

// Reference the hoisted mocks
const mockResendClient = mocks.mockResendWithBroadcasts

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@thelacrosselab.com'

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Setup default mock responses
    mockResendClient.broadcasts.create.mockResolvedValue(mockSuccessResponse({ id: 'broadcast-123' }))
    mockResendClient.broadcasts.send.mockResolvedValue(mockSuccessResponse({}))
    mockResendClient.segments.list.mockResolvedValue(mockSuccessResponse([{ id: 'audience-123', name: 'Default' }]))
    // Set environment variable for audience ID
    process.env.RESEND_AUDIENCE_ID = 'audience-123'
  })

  it('should send purchase confirmation email', async () => {
    mockResendClient.emails.send.mockResolvedValue(mockSuccessResponse({ id: '123' }))

    await sendPurchaseConfirmation({ ...mockEmailData, context: { traceId: 'test-trace-id' } })

    expect(mockResendClient.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: FROM_EMAIL,
        to: mockEmailData.to,
        subject: expect.stringContaining(mockEmailData.orderNumber),
        html: expect.any(String),
      })
    )

    const callArgs = mockResendClient.emails.send.mock.calls[0][0]
    expect(callArgs.html).toBeTruthy()
    expect(typeof callArgs.html).toBe('string')
    expect(callArgs.html.length).toBeGreaterThan(0)
    expect(callArgs.from).toBe(FROM_EMAIL)
    expect(callArgs.to).toBe(mockEmailData.to)
    expect(callArgs.subject).toContain(mockEmailData.orderNumber)
  })

  it('should send broadcast to audience', async () => {
    const result = await sendBroadcastToAudience({
      audienceId: 'default',
      subject: 'Test Subject',
      bodyText: 'Test body content',
      context: { traceId: 'test-trace-id' },
    })

    expect(mockResendClient.broadcasts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        audienceId: 'audience-123',
        from: FROM_EMAIL,
        subject: 'Test Subject',
        html: expect.any(String),
      })
    )
    expect(mockResendClient.broadcasts.send).toHaveBeenCalledWith('broadcast-123')
    expect(result.broadcastId).toBe('broadcast-123')
  })
})
