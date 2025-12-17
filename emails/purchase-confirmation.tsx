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
  Link,
} from '@react-email/components'
import * as React from 'react'
import { 
  getGoogleMapsLink, 
  formatTime, 
  formatDate, 
  formatCurrency,
  emailStyles,
  DEFAULT_SESSION_LOCATION
} from './shared'

interface Session {
  session_date: string
  session_time: string
  location?: string | null
}

interface PurchaseConfirmationEmailProps {
  orderNumber: string
  orderDate: string
  customerName?: string
  items: Array<{
    productName: string
    athleteName: string
    quantity: number
    unitPriceCents: number
    sessionDate?: string // Legacy field, kept for backward compatibility
    sessionTime?: string // Legacy field, kept for backward compatibility
    sessions?: Session[] // New field for multiple sessions
    gender?: string | null
    minGrade?: string | null
    maxGrade?: string | null
    skillLevel?: string | null
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
  const totalAmount = formatCurrency(totalAmountCents, currency)

  return (
    <Html>
      <Head />
      <Preview>Order Confirmation - {orderNumber}</Preview>
      <Body style={emailStyles.main}>
        <Container style={emailStyles.container}>
          <Heading style={emailStyles.h1}>Order Confirmation</Heading>
          
          <Text style={emailStyles.text}>
            {customerName ? `Dear ${customerName},` : 'Dear Customer,'}
          </Text>
          
          <Text style={emailStyles.text}>
            Thank you for your purchase! We've received your order and payment.
          </Text>

          {/* Purchase/Pricing Section */}
          <Section style={emailStyles.section}>
            <Heading style={emailStyles.h2}>Order Details</Heading>
            
            <Text style={emailStyles.text}>
              <strong>Order Number:</strong> {orderNumber}
            </Text>
            <Text style={emailStyles.text}>
              <strong>Order Date:</strong> {formatDate(orderDate)}
            </Text>
            <Text style={emailStyles.text}>
              <strong>Payment Status:</strong> <span style={emailStyles.success}>Paid</span>
            </Text>

            <Hr style={emailStyles.hr} />

            <Heading style={emailStyles.h3}>Items Purchased</Heading>
            
            {items.map((item, index) => {
              const itemTotal = formatCurrency(item.unitPriceCents * item.quantity, currency)
              return (
                <Section key={index} style={emailStyles.itemSection}>
                  <Row>
                    <Column>
                      <Text style={emailStyles.itemText}>
                        <strong>{item.productName}</strong>
                      </Text>
                      <Text style={emailStyles.itemText}>
                        Athlete: {item.athleteName}
                      </Text>
                      <Text style={emailStyles.itemText}>
                        Quantity: {item.quantity}
                      </Text>
                      <Text style={emailStyles.itemText}>
                        Price: {formatCurrency(item.unitPriceCents, currency)} each
                      </Text>
                      <Text style={emailStyles.itemText}>
                        <strong>Subtotal: {itemTotal}</strong>
                      </Text>
                    </Column>
                  </Row>
                </Section>
              )
            })}

            <Hr style={emailStyles.hr} />

            <Row>
              <Column>
                <Text style={emailStyles.totalText}>
                  <strong>Total Amount: {totalAmount}</strong>
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Registration Details Section */}
          <Section style={emailStyles.section}>
            <Heading style={emailStyles.h2}>Registration Details</Heading>
            
            <Text style={emailStyles.text}>
              Your registration is confirmed! Here are the details for your sessions:
            </Text>

            {items.map((item, index) => {
              // Use sessions array if available, otherwise fall back to legacy fields
              const displaySessions = item.sessions && item.sessions.length > 0
                ? item.sessions.sort((a, b) => {
                    const dateA = new Date(`${a.session_date}T${a.session_time}`)
                    const dateB = new Date(`${b.session_date}T${b.session_time}`)
                    return dateA.getTime() - dateB.getTime()
                  })
                : item.sessionDate
                  ? [{ session_date: item.sessionDate, session_time: item.sessionTime || '00:00:00' }]
                  : []

              return (
                <Section key={index} style={emailStyles.registrationSection}>
                  <Text style={emailStyles.itemText}>
                    <strong>Session: {item.productName}</strong>
                  </Text>
                  <Text style={emailStyles.itemText}>
                    <strong>Registered Athlete:</strong> {item.athleteName}
                  </Text>
                  
                  {/* Structured Information */}
                  {(item.gender || item.skillLevel || item.minGrade || item.maxGrade) && (
                    <>
                      {item.gender && (
                        <Text style={emailStyles.itemText}>
                          <strong>Gender:</strong> {item.gender === 'co-ed' ? 'Co-ed' : item.gender.charAt(0).toUpperCase() + item.gender.slice(1)}
                        </Text>
                      )}
                      {item.skillLevel && (
                        <Text style={emailStyles.itemText}>
                          <strong>Skill Level:</strong> {item.skillLevel.charAt(0).toUpperCase() + item.skillLevel.slice(1)}
                        </Text>
                      )}
                      {(item.minGrade || item.maxGrade) && (
                        <Text style={emailStyles.itemText}>
                          <strong>Grade Range:</strong>{' '}
                          {item.minGrade && item.maxGrade
                            ? `Grades ${item.minGrade}-${item.maxGrade}`
                            : item.minGrade
                              ? `Grade ${item.minGrade}+`
                              : `Up to Grade ${item.maxGrade}`}
                        </Text>
                      )}
                    </>
                  )}

                  {/* Session Times */}
                  {displaySessions.length > 0 && (
                    <>
                      <Text style={emailStyles.itemText}>
                        <strong>Session Times:</strong>
                      </Text>
                      {displaySessions.map((session, sessionIdx) => {
                        const formattedDate = formatDate(session.session_date)
                        const formattedTime = formatTime(session.session_time)
                        // Use session location if available, otherwise use default
                        const sessionLocation = session.location || DEFAULT_SESSION_LOCATION
                        
                        return (
                          <React.Fragment key={sessionIdx}>
                            <Text style={{ ...emailStyles.itemText, marginLeft: '20px' }}>
                              • {formattedDate}
                              {formattedTime && ` at ${formattedTime}`}
                            </Text>
                            <Text style={{ ...emailStyles.itemText, marginLeft: '40px', fontSize: '13px', color: '#666' }}>
                              📍{' '}
                              <Link 
                                href={getGoogleMapsLink(sessionLocation)}
                                style={emailStyles.linkStyle}
                              >
                                {sessionLocation}
                              </Link>
                            </Text>
                          </React.Fragment>
                        )
                      })}
                    </>
                  )}
                  {index < items.length - 1 && <Hr style={emailStyles.hr} />}
                </Section>
              )
            })}
          </Section>
          

          <Hr style={emailStyles.hr} />

          <Text style={emailStyles.footer}>
            If you have any questions, please reach out to: {' '}
            <Link href="mailto:carter@experimentlacrosse.com" style={emailStyles.linkStyle}>
              carter@experimentlacrosse.com
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default PurchaseConfirmationEmail

