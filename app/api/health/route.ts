import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'

export async function GET() {
  try {
    const startTime = Date.now()
    // Re-commit 
    // Check database connection
    const supabase = await getSupabaseServer()
    const { error: dbError } = await supabase
      .from('products')
      .select('id')
      .limit(1)
    
    const dbResponseTime = Date.now() - startTime
    
    if (dbError) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          checks: {
            database: {
              status: 'failed',
              error: dbError.message,
              responseTime: dbResponseTime
            }
          }
        },
        { status: 503 }
      )
    }
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: {
          status: 'ok',
          responseTime: dbResponseTime
        }
      }
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    )
  }
}