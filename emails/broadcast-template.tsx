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
  Link,
} from '@react-email/components'
import * as React from 'react'
import { 
  DEFAULT_SESSION_LOCATION, 
  getGoogleMapsLink, 
  emailStyles 
} from './shared'

interface BroadcastEmailProps {
  subject: string
  bodyText: string
  preview?: string
}

export const BroadcastEmail = ({
  subject,
  bodyText,
  preview,
}: BroadcastEmailProps) => {
  // Convert markdown-style formatting to HTML
  const formatBodyText = (text: string) => {
    // Split by double newlines for paragraphs
    const paragraphs = text.split(/\n\n+/)
    
    return paragraphs.map((para, index) => {
      const trimmed = para.trim()
      if (!trimmed) return null
      
      // Check if it's a heading (starts with #)
      if (trimmed.startsWith('# ')) {
        return (
          <Heading key={index} style={emailStyles.h2}>
            {trimmed.substring(2)}
          </Heading>
        )
      }
      
      if (trimmed.startsWith('## ')) {
        return (
          <Heading key={index} style={emailStyles.h3}>
            {trimmed.substring(3)}
          </Heading>
        )
      }
      
      // Regular paragraph - preserve line breaks
      const lines = trimmed.split('\n')
      return (
        <Text key={index} style={emailStyles.text}>
          {lines.map((line, lineIndex) => (
            <React.Fragment key={lineIndex}>
              {line}
              {lineIndex < lines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </Text>
      )
    }).filter(Boolean)
  }

  return (
    <Html>
      <Head />
      <Preview>{preview || subject}</Preview>
      <Body style={emailStyles.main}>
        <Container style={emailStyles.container}>
          <Heading style={emailStyles.h1}>{subject}</Heading>
          
          <Section style={emailStyles.section}>
            {formatBodyText(bodyText)}
          </Section>

          <Hr style={emailStyles.hr} />

          <Text style={emailStyles.footer}>
            The Lacrosse Lab
            <br />
            <span>
              <Link target="_blank" href="https://thelacrosselab.com" style={emailStyles.linkStyle}>Website</Link>
              <span> | </span>
              <Link target="_blank" href="https://instagram.com/lacrosse.lab" style={emailStyles.linkStyle}>Instagram</Link>
            </span>
            
            <br />
            <br />
            If you have any questions, please reach out to:{' '}
            <Link href="mailto:carter@thelacrosselab.com" style={emailStyles.linkStyle}>
              carter@thelacrosselab.com
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default BroadcastEmail

