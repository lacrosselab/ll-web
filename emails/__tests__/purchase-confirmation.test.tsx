import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PurchaseConfirmationEmail } from '../purchase-confirmation'

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

  // Base rendering tests
  it('should match snapshot with default props', () => {
    const { container } = render(<PurchaseConfirmationEmail {...defaultProps} />)
    expect(container).toMatchSnapshot()
  })

  // Multiple items tests
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

    const { container } = render(<PurchaseConfirmationEmail {...props} />)
    expect(container).toMatchSnapshot()
  })

  it('should match snapshot with three items', () => {
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
        {
          productName: 'Session 3',
          athleteName: 'Athlete 3',
          quantity: 3,
          unitPriceCents: 7500,
          sessionDate: '2024-01-22',
          sessionTime: '16:00:00',
          location: 'Location 3',
        },
      ],
      totalAmountCents: 42500,
    }

    const { container } = render(<PurchaseConfirmationEmail {...props} />)
    expect(container).toMatchSnapshot()
  })

  it('should match snapshot with single item quantity > 1', () => {
    const props = {
      ...defaultProps,
      items: [
        {
          productName: 'Test Session',
          athleteName: 'Test Athlete',
          quantity: 3,
          unitPriceCents: 10000,
          sessionDate: '2024-01-20',
          sessionTime: '14:30:00',
          location: 'Test Location',
        },
      ],
      totalAmountCents: 30000,
    }

    const { container } = render(<PurchaseConfirmationEmail {...props} />)
    expect(container).toMatchSnapshot()
  })

  // Missing optional fields tests
  it('should match snapshot with missing customer name', () => {
    const props = {
      ...defaultProps,
      customerName: undefined,
    }

    const { container } = render(<PurchaseConfirmationEmail {...props} />)
    expect(container).toMatchSnapshot()
  })

  it('should match snapshot with missing session time', () => {
    const props = {
      ...defaultProps,
      items: [
        {
          ...defaultProps.items[0],
          sessionTime: undefined,
        },
      ],
    }

    const { container } = render(<PurchaseConfirmationEmail {...props} />)
    expect(container).toMatchSnapshot()
  })

  it('should match snapshot with missing location', () => {
    const props = {
      ...defaultProps,
      items: [
        {
          ...defaultProps.items[0],
          location: undefined,
        },
      ],
    }

    const { container } = render(<PurchaseConfirmationEmail {...props} />)
    expect(container).toMatchSnapshot()
  })

  it('should match snapshot with all optional fields missing', () => {
    const props = {
      ...defaultProps,
      customerName: undefined,
      items: [
        {
          ...defaultProps.items[0],
          sessionTime: undefined,
          location: undefined,
        },
      ],
    }

    const { container } = render(<PurchaseConfirmationEmail {...props} />)
    expect(container).toMatchSnapshot()
  })

  it('should match snapshot with zero session time (00:00:00)', () => {
    const props = {
      ...defaultProps,
      items: [
        {
          ...defaultProps.items[0],
          sessionTime: '00:00:00',
        },
      ],
    }

    const { container } = render(<PurchaseConfirmationEmail {...props} />)
    expect(container).toMatchSnapshot()
  })

  // Complete data tests
  it('should match snapshot with all optional fields present', () => {
    const props = {
      ...defaultProps,
      customerName: 'John Doe',
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
      currency: 'USD',
    }

    const { container } = render(<PurchaseConfirmationEmail {...props} />)
    expect(container).toMatchSnapshot()
  })

  // Currency tests
  it('should match snapshot with different currency', () => {
    const props = {
      ...defaultProps,
      currency: 'EUR',
    }

    const { container } = render(<PurchaseConfirmationEmail {...props} />)
    expect(container).toMatchSnapshot()
  })
})

