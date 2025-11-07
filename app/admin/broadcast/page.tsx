"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { Mail, Eye, Send } from 'lucide-react'
import { BroadcastEmail } from '@/emails/broadcast-template'
import { renderEmailTemplate } from '@/lib/email/utils'
import { logger } from '@/lib/utils'

interface Product {
  id: string
  name: string
  session_date: string
  is_active: boolean
}

type AudienceType = 'all' | 'session' | 'dateRange'

export default function AdminBroadcastPage() {
  const [audienceType, setAudienceType] = useState<AudienceType>('all')
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [subject, setSubject] = useState<string>('')
  const [bodyText, setBodyText] = useState<string>('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    loadProducts()
    checkAdminAccess()
  }, [])

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

  const loadProducts = async () => {
    try {
      setLoading(true)
      const supabase = getSupabaseClient()
      
      const { data, error } = await supabase
        .from('products')
        .select('id, name, session_date, is_active')
        .eq('is_active', true)
        .order('session_date', { ascending: true })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error loading products:', error)
      showToast('Failed to load sessions', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = async () => {
    if (!subject || !bodyText) {
      showToast('Please enter a subject and body text', 'error')
      return
    }

    try {
      logger.debug('Trying to re-render email template')
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
      console.error('Error generating preview:', error)
      showToast('Error generating preview', 'error')
    }
  }

  const handleSend = async () => {
    if (!subject || !bodyText) {
      showToast('Please enter a subject and body text', 'error')
      return
    }

    if (audienceType === 'session' && !selectedProductId) {
      showToast('Please select a session', 'error')
      return
    }

    if (audienceType === 'dateRange' && (!startDate || !endDate)) {
      showToast('Please select both start and end dates', 'error')
      return
    }

    if (audienceType === 'dateRange' && new Date(startDate) > new Date(endDate)) {
      showToast('Start date must be before end date', 'error')
      return
    }

    // Confirm before sending
    const confirmed = window.confirm(
      `Are you sure you want to send this email to the selected audience? This action cannot be undone.`
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
          audienceType,
          productId: audienceType === 'session' ? selectedProductId : undefined,
          startDate: audienceType === 'dateRange' ? startDate : undefined,
          endDate: audienceType === 'dateRange' ? endDate : undefined,
          subject,
          bodyText,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send broadcast email')
      }

      showToast(
        `Broadcast sent successfully! Sent: ${data.sent}, Failed: ${data.failed}`,
        'success'
      )

      // Reset form
      setSubject('')
      setBodyText('')
      setSelectedProductId('')
      setStartDate('')
      setEndDate('')
      setShowPreview(false)
      setPreviewHtml(null)
    } catch (error) {
      console.error('Error sending broadcast:', error)
      showToast(
        error instanceof Error ? error.message : 'Failed to send broadcast email',
        'error'
      )
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-8">
            <div className="text-center">Loading...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Email Broadcast</h1>
        <p className="text-muted-foreground mt-2">
          Send emails to your audience based on purchase history
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Main Form */}
        <Card>
          <CardHeader>
            <CardTitle>Compose Email</CardTitle>
            <CardDescription>
              Create and send broadcast emails to your audience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Audience Selection */}
            <div className="space-y-4">
              <Label>Audience</Label>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="audience"
                    value="all"
                    checked={audienceType === 'all'}
                    onChange={(e) => setAudienceType(e.target.value as AudienceType)}
                    className="cursor-pointer"
                  />
                  <span>All active users (users with successful payments)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="audience"
                    value="session"
                    checked={audienceType === 'session'}
                    onChange={(e) => setAudienceType(e.target.value as AudienceType)}
                    className="cursor-pointer"
                  />
                  <span>Users who purchased a specific session</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="audience"
                    value="dateRange"
                    checked={audienceType === 'dateRange'}
                    onChange={(e) => setAudienceType(e.target.value as AudienceType)}
                    className="cursor-pointer"
                  />
                  <span>Users who purchased sessions within date range</span>
                </label>
              </div>
            </div>

            {/* Session Selection */}
            {audienceType === 'session' && (
              <div className="space-y-2">
                <Label htmlFor="product">Select Session</Label>
                <select
                  id="product"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md"
                >
                  <option value="">Select a session...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - {new Date(product.session_date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Range Selection */}
            {audienceType === 'dateRange' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}

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
                disabled={sending || !subject || !bodyText}
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

