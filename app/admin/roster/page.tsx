"use client"

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { logger } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Search, Calendar, Users, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { formatDateOnly } from '@/lib/utils'

interface Product {
  id: string
  name: string
  session_date: string
  is_active: boolean
  created_at: string
}

interface RegisteredAthlete {
  id: string
  name: string
  age?: number
  school?: string
  position?: string
  grade?: string
  user: {
    id: string
    email: string
  } | null
}

interface SessionWithCount extends Product {
  registered_count: number
}

export default function AdminRosterPage() {
  const [sessions, setSessions] = useState<SessionWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSession, setSelectedSession] = useState<Product | null>(null)
  const [registeredAthletes, setRegisteredAthletes] = useState<RegisteredAthlete[]>([])
  const [loadingAthletes, setLoadingAthletes] = useState(false)
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      setLoading(true)
      const supabase = getSupabaseClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?redirect=/admin/roster')
        return
      }

      // Check if user is admin
      if (!user.email?.endsWith('@thelacrosselab.com')) {
        router.push('/')
        return
      }

      // Query all active products (sessions) only
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, session_date, is_active, created_at')
        .eq('is_active', true)
        .order('session_date', { ascending: true })

      if (productsError) throw productsError

      // For each product, count registered athletes with successful payments

      // Helper to get registered_count for a single product
      const getRegisteredCountForProduct = async (supabase: any, productId: string) => {
        const { data: paymentAthletes, error: paymentsError } = await supabase
          .from('payment_athletes')
          .select(`
            id,
            payment:payments!inner (
              id,
              status
            )
          `)
          .eq('product_id', productId)

        if (paymentsError) {
          logger.error('Error getting registered count for product:', paymentsError)
        }

        // Filter only successful payments
        const successfulPayments = (paymentAthletes || []).filter((pa: any) => pa.payment?.status === 'succeeded')
        return successfulPayments.length
      }

      // Single function to enrich all products (serializes queries, but is safe)
      async function enrichProductsWithCounts(supabase: any, products: Product[]) {
        const result: SessionWithCount[] = []
        for (const product of products) {
          const registered_count = await getRegisteredCountForProduct(supabase, product.id)
          result.push({
            ...product,
            registered_count,
          })
        }
        return result
      }

      // Enrich product list
      const sessionsWithCounts = await enrichProductsWithCounts(supabase, products)

      // Sort by proximity to today's date (closest first)
      const today = new Date()
      today.setHours(0, 0, 0, 0) // Normalize to start of day
      
      const sortedSessions = sessionsWithCounts.sort((a, b) => {
        const dateA = new Date(a.session_date)
        const dateB = new Date(b.session_date)
        const diffA = Math.abs(dateA.getTime() - today.getTime())
        const diffB = Math.abs(dateB.getTime() - today.getTime())
        return diffA - diffB // Closest date first
      })

      setSessions(sortedSessions)
    } catch (err) {
      console.error('Error loading sessions:', err)
      setError('Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  const loadAthletesForSession = async (productId: string) => {
    try {
      setLoadingAthletes(true)
      const supabase = getSupabaseClient()

      // Query payment_athletes filtered by product_id and join to payments and athletes
      const { data, error } = await supabase
        .from('payment_athletes')
        .select(`
          id,
          athlete:athletes!inner (
            id,
            name,
            age,
            school,
            position,
            grade,
            user:users!athletes_user_id_fkey (
              id,
              email
            )
          ),
          payment:payments!inner (
            id,
            status
          )
        `)
        .eq('product_id', productId)

      if (error) throw error

      // Transform the data to match our interface
      // Filter to only include successful payments and ensure athlete data exists
      const transformedAthletes = (data || [])
        .filter((item: any) => item.payment?.status === 'succeeded' && item.athlete)
        .map((item: any) => ({
          id: item.athlete.id,
          name: item.athlete.name,
          age: item.athlete.age,
          school: item.athlete.school,
          position: item.athlete.position,
          grade: item.athlete.grade,
          user: item.athlete.user || null
        }))

      setRegisteredAthletes(transformedAthletes)
    } catch (err) {
      console.error('Error loading athletes for session:', err)
      showToast('Failed to load registered athletes', 'error')
    } finally {
      setLoadingAthletes(false)
    }
  }

  const handleViewAthletes = (session: Product) => {
    setSelectedSession(session)
    loadAthletesForSession(session.id)
  }

  const formatDate = (dateString: string): string => {
    return formatDateOnly(dateString)
  }

  const filteredSessions = sessions.filter(session =>
    session.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    formatDate(session.session_date).toLowerCase().includes(searchTerm.toLowerCase())
  )

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
          <Button onClick={loadSessions}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Roster Management</h1>
        <p className="text-muted-foreground">
          View all sessions and their registered athletes
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search sessions by name or date..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Sessions Table */}
      <Card className="max-w-[500px] lg:max-w-[80vw] overflow-x-scroll">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Sessions ({filteredSessions.length})
          </CardTitle>
          <CardDescription>
            All sessions with registered athlete counts
            <span className="block sm:hidden text-xs mt-1 text-blue-600">
              ← Scroll horizontally to see all columns
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto -mx-4 px-4">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Roster</TableHead>
                    <TableHead className="min-w-[120px]">Title</TableHead>
                    <TableHead className="min-w-[100px]">Date</TableHead>
                    <TableHead className="min-w-[120px]">Status</TableHead>
                    <TableHead className="min-w-[120px]">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No sessions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="whitespace-nowrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewAthletes(session)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Athletes
                          </Button>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="font-medium">{session.name}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(session.session_date)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant={session.is_active ? 'default' : 'secondary'}>
                            {session.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="secondary">
                            {session.registered_count} {session.registered_count === 1 ? 'athlete' : 'athletes'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Athletes Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {selectedSession.name} - Registered Athletes
              </CardTitle>
              <CardDescription>
                Session Date: {formatDate(selectedSession.session_date)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingAthletes ? (
                <div className="text-center py-8">
                  <div className="animate-pulse">Loading athletes...</div>
                </div>
              ) : registeredAthletes.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Age</TableHead>
                        <TableHead>School</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Contact</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {registeredAthletes.map((athlete) => (
                        <TableRow key={athlete.id}>
                          <TableCell className="font-medium">{athlete.name}</TableCell>
                          <TableCell>{athlete.age || '-'}</TableCell>
                          <TableCell>{athlete.school || '-'}</TableCell>
                          <TableCell>{athlete.position || '-'}</TableCell>
                          <TableCell>{athlete.grade || '-'}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {athlete.user?.email || 'User deleted'}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No registered athletes found for this session
                </div>
              )}

              <div className="flex justify-end pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedSession(null)
                    setRegisteredAthletes([])
                  }}
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

