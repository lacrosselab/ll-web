import { describe, it, expect } from 'vitest'
import React from 'react'
import { BroadcastEmail } from '../broadcast-template'
import { renderEmailTemplate } from '@/lib/email/utils'

describe('BroadcastEmail', () => {
  const defaultProps = {
    subject: 'Test Subject',
    bodyText: 'Test body text',
    preview: 'Test preview',
  }

  it('should match snapshot with default props', () => {
    const html = renderEmailTemplate(<BroadcastEmail {...defaultProps} />)
    expect(html).toMatchSnapshot()
  })

  it('should match snapshot with markdown formatting', () => {
    const props = {
      ...defaultProps,
      bodyText: '# Main Heading\n\n## Sub Heading\n\nRegular text with line breaks.',
    }

    const html = renderEmailTemplate(<BroadcastEmail {...props} />)
    expect(html).toMatchSnapshot()
  })
})

