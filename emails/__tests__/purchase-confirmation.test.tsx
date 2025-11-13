import { describe, it, expect } from 'vitest'
import React from 'react'
import { PurchaseConfirmationEmail } from '../purchase-confirmation'
import { renderEmailTemplate } from '@/lib/email/utils'

describe('PurchaseConfirmationEmail', () => {
  const defaultProps = {
    orderNumber: 'LAB-123456',
    orderDate: '2024-01-15T10:00:00Z',
    customerName: 'Test User',
    items: [
      {
        productName: 'Test Session',
        athleteName: 'Test Athlete',
        quantity: 1,
        unitPriceCents: 10000,
        sessionDate: '2024-01-20',
        sessionTime: '14:30:00',
        location: 'Test Location',
      },
    ],
    totalAmountCents: 10000,
    currency: 'USD',
  }

  it('should match snapshot with default props', () => {
    const html = renderEmailTemplate(<PurchaseConfirmationEmail {...defaultProps} />)
    expect(html).toMatchSnapshot()
  })

  it('should match snapshot with multiple items', () => {
    const props = {
      ...defaultProps,
      items: [
        {
          productName: 'Session 1',
          athleteName: 'Athlete 1',
          quantity: 1,
          unitPriceCents: 10000,
          sessionDate: '2024-01-20',
          sessionTime: '14:30:00',
          location: 'Location 1',
        },
        {
          productName: 'Session 2',
          athleteName: 'Athlete 2',
          quantity: 2,
          unitPriceCents: 5000,
          sessionDate: '2024-01-21',
          sessionTime: '15:00:00',
          location: 'Location 2',
        },
      ],
      totalAmountCents: 20000,
    }

    const html = renderEmailTemplate(<PurchaseConfirmationEmail {...props} />)
    expect(html).toMatchSnapshot()
  })
})

