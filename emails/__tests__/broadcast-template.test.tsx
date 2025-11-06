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

  // Base rendering tests
  it('should match snapshot with default props', () => {
    const html = renderEmailTemplate(<BroadcastEmail {...defaultProps} />)
    expect(html).toMatchSnapshot()
  })

  it('should match snapshot with missing preview', () => {
    const props = {
      ...defaultProps,
      preview: undefined,
    }

    const html = renderEmailTemplate(<BroadcastEmail {...props} />)
    expect(html).toMatchSnapshot()
  })

  // Markdown processing tests (business logic)
  it('should match snapshot with markdown headings', () => {
    const props = {
      ...defaultProps,
      bodyText: '# Main Heading\n\n## Sub Heading\n\nRegular text',
    }

    const html = renderEmailTemplate(<BroadcastEmail {...props} />)
    expect(html).toMatchSnapshot()
  })

  it('should match snapshot with mixed markdown elements', () => {
    const props = {
      ...defaultProps,
      bodyText: '# Main Title\n\nFirst paragraph with text.\n\n## Section 1\n\nSome content here.\nWith a line break.\n\n## Section 2\n\nMore content.',
    }

    const html = renderEmailTemplate(<BroadcastEmail {...props} />)
    expect(html).toMatchSnapshot()
  })

  it('should match snapshot with heading without space after hash', () => {
    const props = {
      ...defaultProps,
      bodyText: '#NoSpace\n\nRegular text',
    }

    const html = renderEmailTemplate(<BroadcastEmail {...props} />)
    expect(html).toMatchSnapshot()
  })

  // Paragraph and line break tests (business logic)
  it('should match snapshot with multiple paragraphs', () => {
    const props = {
      ...defaultProps,
      bodyText: 'First paragraph\n\nSecond paragraph',
    }

    const html = renderEmailTemplate(<BroadcastEmail {...props} />)
    expect(html).toMatchSnapshot()
  })

  it('should match snapshot with line breaks', () => {
    const props = {
      ...defaultProps,
      bodyText: 'Line 1\nLine 2\nLine 3',
    }

    const html = renderEmailTemplate(<BroadcastEmail {...props} />)
    expect(html).toMatchSnapshot()
  })

  it('should match snapshot with triple newlines', () => {
    const props = {
      ...defaultProps,
      bodyText: 'Para 1\n\n\nPara 2',
    }

    const html = renderEmailTemplate(<BroadcastEmail {...props} />)
    expect(html).toMatchSnapshot()
  })

  // Edge cases
  it('should match snapshot with empty body text', () => {
    const props = {
      ...defaultProps,
      bodyText: '',
    }

    const html = renderEmailTemplate(<BroadcastEmail {...props} />)
    expect(html).toMatchSnapshot()
  })

  it('should match snapshot with only whitespace in body', () => {
    const props = {
      ...defaultProps,
      bodyText: '   \n\n   ',
    }

    const html = renderEmailTemplate(<BroadcastEmail {...props} />)
    expect(html).toMatchSnapshot()
  })

  it('should match snapshot with long subject line', () => {
    const props = {
      ...defaultProps,
      subject: 'This is a very long subject line that might wrap or cause layout issues in email clients',
    }

    const html = renderEmailTemplate(<BroadcastEmail {...props} />)
    expect(html).toMatchSnapshot()
  })

  it('should match snapshot with special characters in body', () => {
    const props = {
      ...defaultProps,
      bodyText: 'Special chars: & < > " \' @ # $ %',
    }

    const html = renderEmailTemplate(<BroadcastEmail {...props} />)
    expect(html).toMatchSnapshot()
  })

  // Content format tests
  it('should match snapshot with numbered list style text', () => {
    const props = {
      ...defaultProps,
      bodyText: '1. First item\n2. Second item\n3. Third item',
    }

    const html = renderEmailTemplate(<BroadcastEmail {...props} />)
    expect(html).toMatchSnapshot()
  })

  it('should match snapshot with URL in body text', () => {
    const props = {
      ...defaultProps,
      bodyText: 'Visit us at https://example.com for more info.',
    }

    const html = renderEmailTemplate(<BroadcastEmail {...props} />)
    expect(html).toMatchSnapshot()
  })
})

