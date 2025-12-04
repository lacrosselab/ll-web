"use client"

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { logger, formatDateOnly } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  Calendar, 
  Users, 
  DollarSign, 
  CreditCard, 
  Banknote, 
  Download,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import Link from 'next/link'

interface PaymentRecord {
  id: string
  paymentAthleteId: string
  athleteName: string
  athleteId: string
  productName: string
  productId: string
  sessionDate: string
  paymentStatus: string
  unitPriceCents: number
  quantity: number
  refundedAt: string | null
  createdAt: string
  userEmail: string | null
}

type FilterStatus = 'all' | 'succeeded' | 'cash' | 'refunded' | 'partial_refund'

export default function AdminRosterManagePage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set())
  const [processingBulkAction, setProcessingBulkAction] = useState(false)
  const [showBulkRefundConfirm, setShowBulkRefundConfirm] = useState(false)
  
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    loadPayments()
  }, [])

  const loadPayments = async () => {
    try {
      setLoading(true)
      const supabase = getSupabaseClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?redirect=/admin/roster/manage')
        return
      }

      // Check if user is admin
      if (!user.email?.endsWith('@thelacrosselab.com')) {
        router.push('/')
        return
      }

      // Query all payment_athletes with related data
      const { data, error } = await supabase
        .from('payment_athletes')
        .select(`
          id,
          quantity,
          unit_price_cents,
          refunded_at,
          created_at,
          athlete:athletes!inner (
            id,
            name,
            user:users!athletes_user_id_fkey (
              email
            )
          ),
          product:products!inner (
            id,
            name,
            session_date
          ),
          payment:payments!inner (
            id,
            status,
            created_at
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Transform data
      const transformedPayments: PaymentRecord[] = (data || []).map((item: any) => ({
        id: item.payment?.id,
        paymentAthleteId: item.id,
        athleteName: item.athlete?.name || 'Unknown',
        athleteId: item.athlete?.id,
        productName: item.product?.name || 'Unknown',
        productId: item.product?.id,
        sessionDate: item.product?.session_date,
        paymentStatus: item.refunded_at ? 'refunded' : item.payment?.status || 'unknown',
        unitPriceCents: item.unit_price_cents,
        quantity: item.quantity,
        refundedAt: item.refunded_at,
        createdAt: item.created_at || item.payment?.created_at,
        userEmail: item.athlete?.user?.email || null,
      }))

      setPayments(transformedPayments)
    } catch (err) {
      logger.error('Error loading payments', { error: err })
      setError('Failed to load payment records')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedPayments.size === filteredPayments.length) {
      setSelectedPayments(new Set())
    } else {
      setSelectedPayments(new Set(filteredPayments.map(p => p.paymentAthleteId)))
    }
  }

  const handleSelectPayment = (paymentAthleteId: string) => {
    const newSelection = new Set(selectedPayments)
    if (newSelection.has(paymentAthleteId)) {
      newSelection.delete(paymentAthleteId)
    } else {
      newSelection.add(paymentAthleteId)
    }
    setSelectedPayments(newSelection)
  }

  const handleBulkRefund = async () => {
    const refundableIds = Array.from(selectedPayments).filter(id => {
      const payment = payments.find(p => p.paymentAthleteId === id)
      return payment && !payment.refundedAt && (payment.paymentStatus === 'succeeded' || payment.paymentStatus === 'cash')
    })

    if (refundableIds.length === 0) {
      showToast('No refundable items selected', 'error')
      return
    }

    try {
      setProcessingBulkAction(true)
      const response = await fetch('/api/admin/roster/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentAthleteIds: refundableIds,
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to process refunds')
      }
      
      const refundAmount = (data.totalRefundedCents / 100).toFixed(2)
      showToast(`Bulk refund of $${refundAmount} processed for ${data.itemsRefunded} item(s)`, 'success')
      setShowBulkRefundConfirm(false)
      setSelectedPayments(new Set())
      loadPayments()
    } catch (err) {
      logger.error('Error processing bulk refund', { error: err })
      showToast(err instanceof Error ? err.message : 'Failed to process refunds', 'error')
    } finally {
      setProcessingBulkAction(false)
    }
  }

  const exportToCsv = () => {
    const headers = ['Athlete Name', 'Product', 'Session Date', 'Status', 'Amount', 'Email', 'Created At']
    const rows = filteredPayments.map(p => [
      p.athleteName,
      p.productName,
      formatDateOnly(p.sessionDate),
      p.paymentStatus,
      `$${(p.unitPriceCents * p.quantity / 100).toFixed(2)}`,
      p.userEmail || 'N/A',
      new Date(p.createdAt).toLocaleDateString(),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `roster-export-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    
    showToast('Export downloaded successfully', 'success')
  }

  const getStatusBadge = (status: string, refundedAt: string | null) => {
    if (refundedAt) {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          Refunded
        </Badge>
      )
    }
    
    switch (status) {
      case 'cash':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <Banknote className="h-3 w-3 mr-1" />
            Cash
          </Badge>
        )
      case 'succeeded':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <CreditCard className="h-3 w-3 mr-1" />
            Card
          </Badge>
        )
      case 'partial_refund':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <DollarSign className="h-3 w-3 mr-1" />
            Partial Refund
          </Badge>
        )
      case 'pending':
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            Pending
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        )
      default:
        return (
          <Badge variant="outline">
            {status}
          </Badge>
        )
    }
  }

  // Filter payments
  const filteredPayments = payments.filter((payment) => {
    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'refunded') {
        if (!payment.refundedAt) return false
      } else {
        if (payment.refundedAt) return false
        if (payment.paymentStatus !== statusFilter) return false
      }
    }

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        payment.athleteName.toLowerCase().includes(search) ||
        payment.productName.toLowerCase().includes(search) ||
        payment.userEmail?.toLowerCase().includes(search) ||
        formatDateOnly(payment.sessionDate).toLowerCase().includes(search)
      )
    }

    return true
  })

  // Calculate stats
  const stats = {
    total: payments.length,
    active: payments.filter(p => !p.refundedAt && (p.paymentStatus === 'succeeded' || p.paymentStatus === 'cash')).length,
    cardPayments: payments.filter(p => !p.refundedAt && p.paymentStatus === 'succeeded').length,
    cashPayments: payments.filter(p => !p.refundedAt && p.paymentStatus === 'cash').length,
    refunded: payments.filter(p => p.refundedAt).length,
    totalRevenue: payments
      .filter(p => !p.refundedAt && (p.paymentStatus === 'succeeded' || p.paymentStatus === 'cash'))
      .reduce((sum, p) => sum + (p.unitPriceCents * p.quantity), 0),
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={loadPayments}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link 
          href="/admin/roster" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Roster
        </Link>
        <h1 className="text-3xl font-bold mb-2">Payment Management</h1>
        <p className="text-muted-foreground">
          View all payments, process bulk refunds, and export reports
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Records</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <div className="text-sm text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">{stats.cardPayments}</div>
            <div className="text-sm text-muted-foreground">Card Payments</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-emerald-600">{stats.cashPayments}</div>
            <div className="text-sm text-muted-foreground">Cash Payments</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">{stats.refunded}</div>
            <div className="text-sm text-muted-foreground">Refunded</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">${(stats.totalRevenue / 100).toFixed(0)}</div>
            <div className="text-sm text-muted-foreground">Total Revenue</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by name, product, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            All
          </Button>
          <Button
            variant={statusFilter === 'succeeded' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('succeeded')}
          >
            <CreditCard className="h-3 w-3 mr-1" />
            Card
          </Button>
          <Button
            variant={statusFilter === 'cash' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('cash')}
          >
            <Banknote className="h-3 w-3 mr-1" />
            Cash
          </Button>
          <Button
            variant={statusFilter === 'refunded' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('refunded')}
          >
            <XCircle className="h-3 w-3 mr-1" />
            Refunded
          </Button>
        </div>

        <div className="flex gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={loadPayments}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCsv}
          >
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedPayments.size > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between">
          <span className="text-sm">
            <strong>{selectedPayments.size}</strong> item(s) selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedPayments(new Set())}
            >
              Clear Selection
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkRefundConfirm(true)}
            >
              <DollarSign className="h-4 w-4 mr-1" />
              Bulk Refund
            </Button>
          </div>
        </div>
      )}

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Payment Records ({filteredPayments.length})
          </CardTitle>
          <CardDescription>
            All payment and registration records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <input
                      type="checkbox"
                      checked={selectedPayments.size === filteredPayments.length && filteredPayments.length > 0}
                      onChange={handleSelectAll}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead>Athlete</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Session Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No payment records found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((payment) => (
                    <TableRow 
                      key={payment.paymentAthleteId}
                      className={payment.refundedAt ? 'bg-gray-50 opacity-60' : ''}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedPayments.has(payment.paymentAthleteId)}
                          onChange={() => handleSelectPayment(payment.paymentAthleteId)}
                          disabled={!!payment.refundedAt}
                          className="rounded"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{payment.athleteName}</TableCell>
                      <TableCell>{payment.productName}</TableCell>
                      <TableCell>{formatDateOnly(payment.sessionDate)}</TableCell>
                      <TableCell>
                        {getStatusBadge(payment.paymentStatus, payment.refundedAt)}
                      </TableCell>
                      <TableCell>
                        ${(payment.unitPriceCents * payment.quantity / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {payment.userEmail || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Refund Confirmation Dialog */}
      {showBulkRefundConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Confirm Bulk Refund
              </CardTitle>
              <CardDescription>
                This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                Are you sure you want to refund <strong>{selectedPayments.size}</strong> selected item(s)?
              </p>
              
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm">
                <strong>Note:</strong> Card payments will be refunded through Stripe. Cash payments will be marked as refunded but require manual cash handling.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowBulkRefundConfirm(false)}
                  disabled={processingBulkAction}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBulkRefund}
                  disabled={processingBulkAction}
                >
                  {processingBulkAction ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      Processing...
                    </>
                  ) : (
                    'Confirm Bulk Refund'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

