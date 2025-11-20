"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { Eye, Send } from 'lucide-react'
import { BroadcastEmail } from '@/emails/broadcast-template'
import { renderEmailTemplate } from '@/lib/email/utils'
import { logger } from '@/lib/utils'

export default function AdminBroadcastPage() {
  const [subject, setSubject] = useState<string>('')
  const [bodyText, setBodyText] = useState<string>('')
  const [sending, setSending] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null)
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    setMounted(true)
    checkAdminAccess()
    checkFeatureEnabled()
  }, [])

  const checkFeatureEnabled = async () => {
    try {
      const response = await fetch('/api/feature-flags?flag=ENABLE_BROADCAST_FEATURE')
      if (response.ok) {
        const data = await response.json()
        setFeatureEnabled(data.enabled)
      }
    } catch (error) {
      // On error, assume feature might be enabled (let actual send handle it)
      logger.error('Error checking feature flag', { error })
    }
  }

  const checkAdminAccess = async () => {
    const supabase = getSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login?redirect=/admin/broadcast')
      return
    }

    if (!user.email?.endsWith('@thelacrosselab.com')) {
      router.push('/')
      return
    }
  }


  const handlePreview = async () => {
    if (!subject || !bodyText) {
      showToast('Please enter a subject and body text', 'error')
      return
    }

    if (!mounted) return

    try {
      // Reset preview state to force React to re-render
      setShowPreview(false)
      setPreviewHtml(null)
      
      // Use setTimeout to ensure state reset completes before setting new content
      await new Promise(resolve => setTimeout(resolve, 0))
      
      const html = await renderEmailTemplate(
        <BroadcastEmail
          subject={subject}
          bodyText={bodyText}
          preview={subject}
        />
      )
      setPreviewHtml(html)
      setShowPreview(true)
    } catch (error) {
      logger.error('Error generating preview', { error })
      showToast('Error generating preview', 'error')
    }
  }

  const handleSend = async () => {
    if (!subject || !bodyText) {
      showToast('Please enter a subject and body text', 'error')
      return
    }

    // Confirm before sending
    const confirmed = window.confirm(
      `Are you sure you want to send this email to all users in the Resend audience? This action cannot be undone.`
    )

    if (!confirmed) return

    try {
      setSending(true)

      const response = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject,
          bodyText,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // If 503, feature is disabled
        if (response.status === 503) {
          setFeatureEnabled(false)
        }
        throw new Error(data.error || 'Failed to send broadcast email')
      }

      showToast(
        `Broadcast sent successfully! Broadcast ID: ${data.broadcastId}`,
        'success'
      )

      // Reset form
      setSubject('')
      setBodyText('')
      setShowPreview(false)
      setPreviewHtml(null)
    } catch (error) {
      logger.error('Error sending broadcast', { error })
      showToast(
        error instanceof Error ? error.message : 'Failed to send broadcast email',
        'error'
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Email Broadcast</h1>
        <p className="text-muted-foreground mt-2">
          Send emails to all users in your Resend audience
        </p>
      </div>

      {featureEnabled === false && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
            Broadcast Feature Disabled
          </h3>
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            The broadcast email feature is currently disabled. To enable it, set the{' '}
            <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">ENABLE_BROADCAST_FEATURE=true</code>{' '}
            environment variable.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Main Form */}
        <Card>
          <CardHeader>
            <CardTitle>Compose Email</CardTitle>
            <CardDescription>
              Create and send broadcast emails to all users in your Resend audience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Audience Info */}
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                This email will be sent to all users in your Resend audience. Users are automatically added to the audience when they sign up.
              </p>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
                required
              />
            </div>

            {/* Body Text */}
            <div className="space-y-2">
              <Label htmlFor="bodyText">Body Text *</Label>
              <textarea
                id="bodyText"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="Enter your email content here. You can use markdown-style formatting (## for headings, double newlines for paragraphs)."
                className="w-full min-h-[200px] px-3 py-2 border border-input bg-background rounded-md resize-y"
                required
              />
              <p className="text-sm text-muted-foreground">
                Tips: Use ## for headings, double newlines for paragraphs
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={handlePreview}
                variant="outline"
                disabled={!subject || !bodyText}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending || !subject || !bodyText || featureEnabled === false}
                className="flex-1"
              >
                <Send className="h-4 w-4 mr-2" />
                {sending ? 'Sending...' : 'Send Broadcast'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              Preview how your email will look
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showPreview && previewHtml ? (
              <div
                className="border rounded-md p-4 bg-white"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Click "Preview" to see how your email will look
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

