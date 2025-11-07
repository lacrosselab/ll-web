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
} from '@react-email/components'
import * as React from 'react'

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
          <Heading key={index} style={h2}>
            {trimmed.substring(2)}
          </Heading>
        )
      }
      
      if (trimmed.startsWith('## ')) {
        return (
          <Heading key={index} style={h3}>
            {trimmed.substring(3)}
          </Heading>
        )
      }
      
      // Regular paragraph - preserve line breaks
      const lines = trimmed.split('\n')
      return (
        <Text key={index} style={text}>
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
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{subject}</Heading>
          
          <Section style={section}>
            {formatBodyText(bodyText)}
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            The Lacrosse Lab ®
            <br />
            <span>
              <a target="_blank" href="https://thelacrosselab.com">Website</a>
              <span> | </span>
              <a target="_blank" href="https://instagram.com/lacrosse.lab">Instagram</a>
            </span>
            <br />
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default BroadcastEmail

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
  margin: '10px 0',
}

const section = {
  padding: '20px 0',
}

const hr = {
  borderColor: '#e0e0e0',
  margin: '20px 0',
}

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  marginTop: '20px',
}

