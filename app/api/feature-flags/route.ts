import { NextRequest, NextResponse } from 'next/server'

/**
 * API endpoint to check feature flag status
 * Used by client components to determine if features are enabled
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const flag = searchParams.get('flag')

  if (!flag) {
    return NextResponse.json(
      { error: 'Flag parameter is required' },
      { status: 400 }
    )
  }

  // Only expose specific feature flags for security
  const allowedFlags = ['ENABLE_RESEND_CONTACT_ADDITION', 'ENABLE_BROADCAST_FEATURE']
  
  if (!allowedFlags.includes(flag)) {
    return NextResponse.json(
      { error: 'Invalid flag name' },
      { status: 400 }
    )
  }

  const isEnabled = process.env[flag] === 'true'

  return NextResponse.json({
    flag,
    enabled: isEnabled,
  })
}

