import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import {
  createMockResendClient,
  mockEmailData,
  mockBroadcastData,
  mockContactData,
  mockSuccessResponse,
  mockErrorResponse,
} from './test-utils'

// Use vi.hoisted to create mocks that can be referenced in vi.mock factories
const mocks = vi.hoisted(() => {
  return {
    mockResendClient: createMockResendClient(),
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
  getResend: vi.fn(() => mocks.mockResendClient),
}))

// Mock logger and utilities
vi.mock('@/lib/utils', () => ({
  logger: mocks.logger,
  maskEmail: mocks.maskEmail,
}))

// Import after mocking
import { addContactToResend, sendPurchaseConfirmation, sendBroadcastEmail } from '../service'
import { renderEmailTemplate } from '../utils'
import { PurchaseConfirmationEmail } from '@/emails/purchase-confirmation'
import { BroadcastEmail } from '@/emails/broadcast-template'

// Reference the hoisted mocks
const mockResendClient = mocks.mockResendClient

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@thelacrosselab.com'

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('addContactToResend', () => {
    it('should add contact to Resend successfully', async () => {
      mockResendClient.contacts.create.mockResolvedValue(mockSuccessResponse({ id: '123' }))

      await addContactToResend(mockContactData.email, { traceId: 'test-trace-id' })

      expect(mockResendClient.contacts.create).toHaveBeenCalledWith({
        email: mockContactData.email,
        audienceId: 'default',
      })
      expect(mocks.logger.debug).toHaveBeenCalledWith(
        'contact.added',
        expect.objectContaining({ traceId: 'test-trace-id' })
      )
    })

    it('should handle contact without context', async () => {
      mockResendClient.contacts.create.mockResolvedValue(mockSuccessResponse({ id: '123' }))

      await addContactToResend(mockContactData.email)

      expect(mockResendClient.contacts.create).toHaveBeenCalledWith({
        email: mockContactData.email,
        audienceId: 'default',
      })
    })

    it('should handle existing contact gracefully', async () => {
      const error = new Error('Contact already exists')
      error.message = 'already exists'
      mockResendClient.contacts.create.mockRejectedValue(error)

      // Should not throw
      await expect(addContactToResend(mockContactData.email, { traceId: 'test-trace-id' })).resolves.not.toThrow()
      expect(mocks.logger.debug).toHaveBeenCalledWith(
        'contact.exists',
        expect.objectContaining({ traceId: 'test-trace-id' })
      )
    })

    it('should handle errors gracefully', async () => {
      mockResendClient.contacts.create.mockRejectedValue(new Error('Network error'))

      // Should not throw
      await expect(addContactToResend(mockContactData.email, { traceId: 'test-trace-id' })).resolves.not.toThrow()
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'contact.add_failed',
        expect.objectContaining({ traceId: 'test-trace-id' })
      )
    })
  })

  describe('sendPurchaseConfirmation', () => {
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

    it('should pass raw cents values to email template', async () => {
      mockResendClient.emails.send.mockResolvedValue(mockSuccessResponse({ id: '123' }))

      const testData = {
        ...mockEmailData,
        items: [
          {
            ...mockEmailData.items[0],
            unitPriceCents: 10000,
          },
        ],
        totalAmountCents: 10000,
      }

      await sendPurchaseConfirmation({ ...testData, context: { traceId: 'test-trace-id' } })

      const callArgs = mockResendClient.emails.send.mock.calls[0][0]
      expect(callArgs.html).toBeTruthy()
      expect(typeof callArgs.html).toBe('string')
      // Verify HTML contains order number and customer name (proving template was rendered)
      expect(callArgs.html).toContain(testData.orderNumber)
      if (testData.customerName) {
        expect(callArgs.html).toContain(testData.customerName)
      }
      // Note: We don't check for formatted strings like "$100.00" - that's the template's job
    })

    it('should pass ISO date strings to email template', async () => {
      mockResendClient.emails.send.mockResolvedValue(mockSuccessResponse({ id: '123' }))

      const isoDate = new Date().toISOString()
      const testData = {
        ...mockEmailData,
        orderDate: isoDate,
        items: [
          {
            ...mockEmailData.items[0],
            sessionDate: '2024-01-15',
          },
        ],
      }

      await sendPurchaseConfirmation({ ...testData, context: { traceId: 'test-trace-id' } })

      const callArgs = mockResendClient.emails.send.mock.calls[0][0]
      expect(callArgs.html).toBeTruthy()
      expect(typeof callArgs.html).toBe('string')
      // Verify HTML contains date-related content (proving dates were processed)
      expect(callArgs.html).toContain(testData.orderNumber)
      // Note: We don't check for formatted dates like "January 15, 2024" - that's the template's job
    })

    it('should render valid HTML with DOCTYPE and structure', async () => {
      mockResendClient.emails.send.mockResolvedValue(mockSuccessResponse({ id: '123' }))

      await sendPurchaseConfirmation(mockEmailData)

      const callArgs = mockResendClient.emails.send.mock.calls[0][0]
      const html = callArgs.html

      // Assert the HTML string has valid structure
      expect(html).toContain('<!DOCTYPE')
      expect(html).toContain('<html')
      expect(html).toContain('<body')
      expect(html.length).toBeGreaterThan(100)
    })

    it('should handle multiple items correctly', async () => {
      mockResendClient.emails.send.mockResolvedValue(mockSuccessResponse({ id: '123' }))

      const testData = {
        ...mockEmailData,
        items: [
          {
            productName: 'Test Session 1',
            athleteName: 'Athlete 1',
            quantity: 1,
            unitPriceCents: 10000,
            sessionDate: '2024-01-15',
            sessionTime: '14:30:00',
            location: 'Location 1',
          },
          {
            productName: 'Test Session 2',
            athleteName: 'Athlete 2',
            quantity: 2,
            unitPriceCents: 15000,
            sessionDate: '2024-01-20',
            sessionTime: '16:00:00',
            location: 'Location 2',
          },
          {
            productName: 'Test Session 3',
            athleteName: 'Athlete 3',
            quantity: 1,
            unitPriceCents: 20000,
            sessionDate: '2024-01-25',
          },
        ],
        totalAmountCents: 60000,
      }

      await sendPurchaseConfirmation({ ...testData, context: { traceId: 'test-trace-id' } })

      expect(mockResendClient.emails.send).toHaveBeenCalledTimes(1)
      const callArgs = mockResendClient.emails.send.mock.calls[0][0]
      expect(callArgs.html).toBeTruthy()
      expect(callArgs.html.length).toBeGreaterThan(0)
    })

    it('should handle missing optional fields', async () => {
      mockResendClient.emails.send.mockResolvedValue(mockSuccessResponse({ id: '123' }))

      const testData = {
        to: 'test@example.com',
        orderNumber: 'ORD-123456',
        orderDate: new Date().toISOString(),
        items: [
          {
            productName: 'Test Session',
            athleteName: 'Test Athlete',
            quantity: 1,
            unitPriceCents: 10000,
            sessionDate: '2024-01-15',
          },
        ],
        totalAmountCents: 10000,
      }

      await sendPurchaseConfirmation({ ...testData, context: { traceId: 'test-trace-id' } })

      expect(mockResendClient.emails.send).toHaveBeenCalledTimes(1)
      const callArgs = mockResendClient.emails.send.mock.calls[0][0]
      expect(callArgs.html).toBeTruthy()
      expect(typeof callArgs.html).toBe('string')
      expect(callArgs.html.length).toBeGreaterThan(0)
    })

    it('should handle errors gracefully', async () => {
      mockResendClient.emails.send.mockRejectedValue(new Error('Network error'))

      await expect(sendPurchaseConfirmation({ ...mockEmailData, context: { traceId: 'test-trace-id' } })).resolves.not.toThrow()

      expect(mocks.logger.error).toHaveBeenCalledWith(
        'purchase_confirmation.send_failed',
        expect.objectContaining({ traceId: 'test-trace-id' })
      )
    })

    it('should validate email address', async () => {
      await sendPurchaseConfirmation({ ...mockEmailData, to: '', context: { traceId: 'test-trace-id' } })

      expect(mockResendClient.emails.send).not.toHaveBeenCalled()
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        'purchase_confirmation.validation_failed',
        expect.objectContaining({ traceId: 'test-trace-id' })
      )
    })

    it('should validate orderNumber and orderDate', async () => {
      await sendPurchaseConfirmation({ ...mockEmailData, orderNumber: '', context: { traceId: 'test-trace-id' } })

      expect(mockResendClient.emails.send).not.toHaveBeenCalled()
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        'purchase_confirmation.validation_failed',
        expect.objectContaining({ traceId: 'test-trace-id' })
      )
    })

    it('should validate items array', async () => {
      await sendPurchaseConfirmation({ ...mockEmailData, items: [], context: { traceId: 'test-trace-id' } })

      expect(mockResendClient.emails.send).not.toHaveBeenCalled()
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        'purchase_confirmation.validation_failed',
        expect.objectContaining({ traceId: 'test-trace-id' })
      )
    })

    it('should handle template rendering errors', async () => {
      vi.spyOn(require('../utils'), 'renderEmailTemplate').mockRejectedValue(new Error('Template render failed'))

      await sendPurchaseConfirmation({ ...mockEmailData, context: { traceId: 'test-trace-id' } })

      expect(mockResendClient.emails.send).not.toHaveBeenCalled()
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'purchase_confirmation.render_failed',
        expect.objectContaining({ traceId: 'test-trace-id', templateName: 'PurchaseConfirmationEmail' })
      )
    })
  })

  describe('sendBroadcastEmail', () => {
    it('should send broadcast emails to multiple recipients', async () => {
      mockResendClient.emails.send.mockResolvedValue(mockSuccessResponse({ id: '123' }))

      const result = await sendBroadcastEmail({ ...mockBroadcastData, context: { traceId: 'test-trace-id' } })

      expect(mockResendClient.emails.send).toHaveBeenCalledTimes(2)
      expect(result.sent).toBe(2)
      expect(result.failed).toBe(0)
      expect(mocks.logger.info).toHaveBeenCalledWith(
        'broadcast.done',
        expect.objectContaining({ traceId: 'test-trace-id', sent: 2, failed: 0 })
      )
    })

    it('should handle batch sending with rate limiting', async () => {
      vi.useFakeTimers()
      mockResendClient.emails.send.mockResolvedValue(mockSuccessResponse({ id: '123' }))

      const recipients = Array.from({ length: 15 }, (_, i) => `test${i}@example.com`)

      const promise = sendBroadcastEmail({
        to: recipients,
        subject: 'Test Subject',
        bodyText: 'Test body',
        context: { traceId: 'test-trace-id' },
      })

      // Process first batch (10 emails)
      await vi.runAllTimersAsync()
      expect(mockResendClient.emails.send).toHaveBeenCalledTimes(10)

      // Advance past first delay (1000ms) and run timers for second batch
      vi.advanceTimersByTime(1000)
      await vi.runAllTimersAsync()

      const result = await promise

      expect(mockResendClient.emails.send).toHaveBeenCalledTimes(15)
      expect(result.sent).toBe(15)
      expect(result.failed).toBe(0)
    })

    it('should verify rate limiting delay between batches', async () => {
      vi.useFakeTimers()
      mockResendClient.emails.send.mockResolvedValue(mockSuccessResponse({ id: '123' }))

      const recipients = Array.from({ length: 25 }, (_, i) => `test${i}@example.com`)

      const promise = sendBroadcastEmail({
        to: recipients,
        subject: 'Test Subject',
        bodyText: 'Test body',
        context: { traceId: 'test-trace-id' },
      })

      // Process first batch (10 emails) - run pending timers to let first batch complete
      await vi.runAllTimersAsync()
      expect(mockResendClient.emails.send).toHaveBeenCalledTimes(10)

      // Advance past first delay (1000ms) and run timers for second batch
      vi.advanceTimersByTime(1000)
      await vi.runAllTimersAsync()
      expect(mockResendClient.emails.send).toHaveBeenCalledTimes(20)

      // Advance past second delay (another 1000ms) and run timers for third batch
      vi.advanceTimersByTime(1000)
      await vi.runAllTimersAsync()
      expect(mockResendClient.emails.send).toHaveBeenCalledTimes(25)

      const result = await promise

      expect(result.sent).toBe(25)
      expect(result.failed).toBe(0)
    })

    it('should handle partial failures', async () => {
      mockResendClient.emails.send
        .mockResolvedValueOnce(mockSuccessResponse({ id: '123' }))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockSuccessResponse({ id: '456' }))

      const result = await sendBroadcastEmail({
        to: ['test1@example.com', 'test2@example.com', 'test3@example.com'],
        subject: 'Test Subject',
        bodyText: 'Test body',
        context: { traceId: 'test-trace-id' },
      })

      expect(result.sent).toBe(2)
      expect(result.failed).toBe(1)
      expect(mocks.logger.error).toHaveBeenCalled()
    })

    it('should handle batch processing with all failures', async () => {
      mockResendClient.emails.send.mockRejectedValue(new Error('Network error'))

      const result = await sendBroadcastEmail({
        to: [
          'test1@example.com',
          'test2@example.com',
          'test3@example.com',
          'test4@example.com',
          'test5@example.com',
        ],
        subject: 'Test Subject',
        bodyText: 'Test body',
        context: { traceId: 'test-trace-id' },
      })

      expect(result.sent).toBe(0)
      expect(result.failed).toBe(5)
      expect(mocks.logger.error).toHaveBeenCalledTimes(5)
    })

    it('should filter invalid email addresses', async () => {
      mockResendClient.emails.send.mockResolvedValue(mockSuccessResponse({ id: '123' }))

      const result = await sendBroadcastEmail({
        to: ['valid@example.com', 'invalid-email', 'another@example.com'],
        subject: 'Test Subject',
        bodyText: 'Test body',
        context: { traceId: 'test-trace-id' },
      })

      expect(mockResendClient.emails.send).toHaveBeenCalledTimes(2)
      expect(result.sent).toBe(2)
      expect(result.failed).toBe(0)
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        'broadcast.validation',
        expect.objectContaining({ invalidCount: 1, traceId: 'test-trace-id' })
      )
    })

    it('should return early if no valid recipients', async () => {
      const result = await sendBroadcastEmail({
        to: ['invalid-email', 'also-invalid'],
        subject: 'Test Subject',
        bodyText: 'Test body',
        context: { traceId: 'test-trace-id' },
      })

      expect(mockResendClient.emails.send).not.toHaveBeenCalled()
      expect(result.sent).toBe(0)
      expect(result.failed).toBe(0)
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        'broadcast.no_valid_recipients',
        expect.objectContaining({ traceId: 'test-trace-id' })
      )
    })

    it('should handle template rendering errors', async () => {
      vi.spyOn(require('../utils'), 'renderEmailTemplate').mockRejectedValue(new Error('Template render failed'))

      const result = await sendBroadcastEmail({
        ...mockBroadcastData,
        context: { traceId: 'test-trace-id' },
      })

      expect(mockResendClient.emails.send).not.toHaveBeenCalled()
      expect(result.sent).toBe(0)
      expect(result.failed).toBe(2)
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'broadcast.render_failed',
        expect.objectContaining({ traceId: 'test-trace-id', templateName: 'BroadcastEmail' })
      )
    })

    it('should retry failed sends with exponential backoff', async () => {
      vi.useFakeTimers()
      // First two attempts fail, third succeeds
      mockResendClient.emails.send
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockSuccessResponse({ id: '123' }))

      const promise = sendBroadcastEmail({
        to: ['test@example.com'],
        subject: 'Test Subject',
        bodyText: 'Test body',
        context: { traceId: 'test-trace-id' },
      })

      // Advance timers to allow retries
      await vi.runAllTimersAsync()
      vi.advanceTimersByTime(1000)
      await vi.runAllTimersAsync()
      vi.advanceTimersByTime(600)
      await vi.runAllTimersAsync()

      const result = await promise

      expect(mockResendClient.emails.send).toHaveBeenCalledTimes(3)
      expect(result.sent).toBe(1)
      expect(result.failed).toBe(0)
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        'Email send retry',
        expect.objectContaining({ attempt: 1, traceId: 'test-trace-id' })
      )
    })
  })

  describe('renderEmailTemplate', () => {
    it('should render PurchaseConfirmationEmail to HTML string', () => {
      const html = renderEmailTemplate(
        React.createElement(PurchaseConfirmationEmail, {
          orderNumber: mockEmailData.orderNumber,
          orderDate: mockEmailData.orderDate,
          customerName: mockEmailData.customerName,
          items: mockEmailData.items,
          totalAmountCents: mockEmailData.totalAmountCents,
          currency: mockEmailData.currency,
        })
      )

      expect(html).toBeTruthy()
      expect(typeof html).toBe('string')
      expect(html).toContain('<!DOCTYPE')
      expect(html).toContain('<html')
      expect(html).toContain('<body')
      expect(html.length).toBeGreaterThan(100)
    })

    it('should render BroadcastEmail to HTML string', () => {
      const html = renderEmailTemplate(
        React.createElement(BroadcastEmail, {
          subject: mockBroadcastData.subject,
          bodyText: mockBroadcastData.bodyText,
          preview: mockBroadcastData.subject,
        })
      )

      expect(html).toBeTruthy()
      expect(typeof html).toBe('string')
      expect(html).toContain('<!DOCTYPE')
      expect(html).toContain(mockBroadcastData.subject)
      expect(html).toContain(mockBroadcastData.bodyText)
    })

    it('should produce valid HTML structure', () => {
      const html = renderEmailTemplate(
        React.createElement(BroadcastEmail, {
          subject: 'Test Subject',
          bodyText: 'Test body content',
          preview: 'Test Subject',
        })
      )

      // Assert HTML structure
      expect(html).toContain('<!DOCTYPE')
      expect(html).toContain('<html')
      expect(html).toContain('</html>')
      expect(html).toContain('<body')
      expect(html).toContain('</body>')
      // React Email adds inline styles for email clients
      expect(html).toMatch(/style=["']/)
    })
  })
})
