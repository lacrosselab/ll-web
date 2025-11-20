"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { logger } from '@/lib/utils'
import { useEffect } from 'react'

export default function AdminDebugResendPage() {
  const [email, setEmail] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [listLoading, setListLoading] = useState<string | null>(null)
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    checkAdminAccess()
  }, [])

  const checkAdminAccess = async () => {
    const supabase = getSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login?redirect=/admin/debug-resend')
      return
    }

    if (!user.email?.endsWith('@thelacrosselab.com')) {
      router.push('/')
      return
    }
  }

  const handleTest = async () => {
    if (!email || !email.includes('@')) {
      showToast('Please enter a valid email address', 'error')
      return
    }

    setLoading(true)
    setResponse(null)
    setError(null)

    try {
      logger.info('debug_resend.test_initiated', { email })
      
      const apiResponse = await fetch('/api/resend/add-contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await apiResponse.json()
      
      logger.info('debug_resend.api_response', {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        data,
      })

      if (!apiResponse.ok) {
        setError(data.error || `HTTP ${apiResponse.status}: ${apiResponse.statusText}`)
        showToast('Failed to add contact', 'error')
      } else {
        setResponse({
          success: data.success,
          status: apiResponse.status,
          data,
        })
        showToast('Contact addition completed. Check logs for details.', 'success')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      logger.error('debug_resend.test_failed', { error: errorMessage, email })
      setError(errorMessage)
      showToast('Error testing contact addition', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleListContacts = async () => {
    setListLoading('contacts')
    setResponse(null)
    setError(null)

    try {
      logger.info('debug_resend.list_contacts_initiated')
      
      const apiResponse = await fetch('/api/resend/list-contacts', {
        method: 'GET',
      })

      const data = await apiResponse.json()
      
      logger.info('debug_resend.list_contacts_response', {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        data,
      })

      if (!apiResponse.ok) {
        setError(data.error || `HTTP ${apiResponse.status}: ${apiResponse.statusText}`)
        showToast('Failed to list contacts', 'error')
      } else {
        setResponse({
          success: data.success,
          status: apiResponse.status,
          data,
        })
        showToast('Contacts listed successfully', 'success')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      logger.error('debug_resend.list_contacts_failed', { error: errorMessage })
      setError(errorMessage)
      showToast('Error listing contacts', 'error')
    } finally {
      setListLoading(null)
    }
  }

  const handleListSegments = async () => {
    setListLoading('segments')
    setResponse(null)
    setError(null)

    try {
      logger.info('debug_resend.list_segments_initiated')
      
      const apiResponse = await fetch('/api/resend/list-segments', {
        method: 'GET',
      })

      const data = await apiResponse.json()
      
      logger.info('debug_resend.list_segments_response', {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        data,
      })

      if (!apiResponse.ok) {
        setError(data.error || `HTTP ${apiResponse.status}: ${apiResponse.statusText}`)
        showToast('Failed to list segments', 'error')
      } else {
        setResponse({
          success: data.success,
          status: apiResponse.status,
          data,
        })
        showToast('Segments listed successfully', 'success')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      logger.error('debug_resend.list_segments_failed', { error: errorMessage })
      setError(errorMessage)
      showToast('Error listing segments', 'error')
    } finally {
      setListLoading(null)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Debug Resend Contact</h1>
        <p className="text-muted-foreground mt-2">
          Temporary debug page to test adding contacts to Resend segment
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test Add Contact</CardTitle>
          <CardDescription>
            Enter an email address to test the add-contact API endpoint. Check the browser console and server logs for detailed debugging information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="test@example.com"
              required
            />
          </div>

          <Button
            onClick={handleTest}
            disabled={loading || !email}
            className="w-full"
          >
            {loading ? 'Testing...' : 'Test Add Contact'}
          </Button>

          <div className="flex gap-2 mt-4">
            <Button
              onClick={handleListContacts}
              disabled={listLoading !== null}
              variant="outline"
              className="flex-1"
            >
              {listLoading === 'contacts' ? 'Loading...' : 'List Contacts'}
            </Button>
            <Button
              onClick={handleListSegments}
              disabled={listLoading !== null}
              variant="outline"
              className="flex-1"
            >
              {listLoading === 'segments' ? 'Loading...' : 'List Segments'}
            </Button>
          </div>

          {response && (
            <div className="mt-6 p-4 bg-muted rounded-md">
              <h3 className="font-semibold mb-2">Response:</h3>
              <pre className="text-xs overflow-auto bg-background p-3 rounded border">
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-destructive/10 rounded-md border border-destructive/20">
              <h3 className="font-semibold mb-2 text-destructive">Error:</h3>
              <pre className="text-xs overflow-auto bg-background p-3 rounded border text-destructive">
                {error}
              </pre>
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Note:</strong> This is a temporary debug page. Check both the browser console (F12) and server logs for detailed debugging information about each step of the contact addition process.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

