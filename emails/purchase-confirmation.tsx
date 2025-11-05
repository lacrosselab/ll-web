import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
  Row,
  Column,
} from '@react-email/components'
import * as React from 'react'

interface PurchaseConfirmationEmailProps {
  orderNumber: string
  orderDate: string
  customerName?: string
  items: Array<{
    productName: string
    athleteName: string
    quantity: number
    unitPriceCents: number
    sessionDate: string
    sessionTime?: string
    location?: string
  }>
  totalAmountCents: number
  currency?: string
}

export const PurchaseConfirmationEmail = ({
  orderNumber,
  orderDate,
  customerName,
  items,
  totalAmountCents,
  currency = 'USD',
}: PurchaseConfirmationEmailProps) => {
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)
  }

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date))
  }

  const formatTime = (time?: string) => {
    if (!time || time === '00:00:00') return null
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const totalAmount = formatCurrency(totalAmountCents)

  return (
    <Html>
      <Head />
      <Preview>Order Confirmation - {orderNumber}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Order Confirmation</Heading>
          
          <Text style={text}>
            {customerName ? `Dear ${customerName},` : 'Dear Customer,'}
          </Text>
          
          <Text style={text}>
            Thank you for your purchase! We've received your order and payment.
          </Text>

          {/* Purchase/Pricing Section */}
          <Section style={section}>
            <Heading style={h2}>Order Details</Heading>
            
            <Text style={text}>
              <strong>Order Number:</strong> {orderNumber}
            </Text>
            <Text style={text}>
              <strong>Order Date:</strong> {formatDate(orderDate)}
            </Text>
            <Text style={text}>
              <strong>Payment Status:</strong> <span style={success}>Paid</span>
            </Text>

            <Hr style={hr} />

            <Heading style={h3}>Items Purchased</Heading>
            
            {items.map((item, index) => {
              const itemTotal = formatCurrency(item.unitPriceCents * item.quantity)
              return (
                <Section key={index} style={itemSection}>
                  <Row>
                    <Column>
                      <Text style={itemText}>
                        <strong>{item.productName}</strong>
                      </Text>
                      <Text style={itemText}>
                        Athlete: {item.athleteName}
                      </Text>
                      <Text style={itemText}>
                        Quantity: {item.quantity}
                      </Text>
                      <Text style={itemText}>
                        Price: {formatCurrency(item.unitPriceCents)} each
                      </Text>
                      <Text style={itemText}>
                        <strong>Subtotal: {itemTotal}</strong>
                      </Text>
                    </Column>
                  </Row>
                </Section>
              )
            })}

            <Hr style={hr} />

            <Row>
              <Column>
                <Text style={totalText}>
                  <strong>Total Amount: {totalAmount}</strong>
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Registration Details Section */}
          <Section style={section}>
            <Heading style={h2}>Registration Details</Heading>
            
            <Text style={text}>
              Your registration is confirmed! Here are the details for your sessions:
            </Text>

            {items.map((item, index) => (
              <Section key={index} style={registrationSection}>
                <Text style={itemText}>
                  <strong>Session: {item.productName}</strong>
                </Text>
                <Text style={itemText}>
                  <strong>Registered Athlete:</strong> {item.athleteName}
                </Text>
                <Text style={itemText}>
                  <strong>Session Date:</strong> {formatDate(item.sessionDate)}
                </Text>
                {item.sessionTime && formatTime(item.sessionTime) && (
                  <Text style={itemText}>
                    <strong>Session Time:</strong> {formatTime(item.sessionTime)}
                  </Text>
                )}
                {item.location && (
                  <Text style={itemText}>
                    <strong>Location:</strong> {item.location}
                  </Text>
                )}
                {index < items.length - 1 && <Hr style={hr} />}
              </Section>
            ))}

            <Text style={text}>
              We look forward to seeing you at the session!
            </Text>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            If you have any questions, please don't hesitate to contact us.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default PurchaseConfirmationEmail

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
}

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
}

const h2 = {
  color: '#333',
  fontSize: '20px',
  fontWeight: 'bold',
  margin: '30px 0 20px',
  padding: '0',
}

const h3 = {
  color: '#333',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '20px 0 10px',
  padding: '0',
}

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
}

const section = {
  padding: '20px 0',
}

const itemSection = {
  padding: '15px 0',
  borderBottom: '1px solid #e0e0e0',
}

const registrationSection = {
  padding: '15px',
  backgroundColor: '#f9f9f9',
  borderRadius: '4px',
  margin: '10px 0',
}

const itemText = {
  color: '#333',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '5px 0',
}

const totalText = {
  color: '#333',
  fontSize: '18px',
  lineHeight: '26px',
  textAlign: 'right' as const,
}

const hr = {
  borderColor: '#e0e0e0',
  margin: '20px 0',
}

const success = {
  color: '#28a745',
  fontWeight: 'bold',
}

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  marginTop: '20px',
}

