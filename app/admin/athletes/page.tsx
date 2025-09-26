"use client"

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Search, User, Calendar, DollarSign, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'

interface Athlete {
  id: string
  name: string
  age?: number
  school?: string
  position?: string
  grade?: string
  created_at: string
  user: {
    id: string
    email: string
  } | null  // Make user nullable
  session_history: {
    id: string
    product: {
      id: string
      name: string
      session_date: string
      price_cents: number
    }
    payment: {
      id: string
      amount: number
      status: string
      created_at: string
    }
    created_at: string
  }[]
}

export default function AdminAthletesPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null)
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    loadAthletes()
  }, [])

  const loadAthletes = async () => {
    try {
      setLoading(true)
      const supabase = getSupabaseClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?redirect=/admin/athletes')
        return
      }

      // Check if user is admin
      if (!user.email?.endsWith('@thelacrosselab.com')) {
        router.push('/')
        return
      }

      // Query all athletes with their session history
      const { data, error } = await supabase
        .from('athletes')
        .select(`
          id,
          name,
          age,
          school,
          position,
          grade,
          created_at,
          user:users!athletes_user_id_fkey (
            id,
            email
          ),
          session_history:payment_athletes (
            id,
            created_at,
            product:products (
              id,
              name,
              session_date,
              price_cents
            ),
            payment:payments (
              id,
              amount,
              status,
              created_at
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Transform the data to match our interface
      const transformedAthletes = (data || []).map((athlete: any) => ({
        ...athlete,
        user: athlete.user || null, // Handle null user case
        session_history: athlete.session_history || []
      }))

      setAthletes(transformedAthletes)
    } catch (err) {
      console.error('Error loading athletes:', err)
      setError('Failed to load athletes')
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (cents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const filteredAthletes = athletes.filter(athlete =>
    athlete.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (athlete.user?.email && athlete.user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (athlete.school && athlete.school.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const getTotalSessions = (athlete: Athlete): number => {
    return athlete.session_history.length
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
          <Button onClick={loadAthletes}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Athlete Management</h1>
        <p className="text-muted-foreground">
          View and manage all registered athletes and their session history
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search athletes by name, email, or school..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Athletes Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Athletes ({filteredAthletes.length})
          </CardTitle>
          <CardDescription>
            All registered athletes and their session attendance
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                  <TableHead>Sessions</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAthletes.map((athlete) => (
                  <TableRow key={athlete.id}>
                    <TableCell>
                      <div className="font-medium">{athlete.name}</div>
                    </TableCell>
                    <TableCell>
                      {athlete.age ? `${athlete.age}` : '-'}
                    </TableCell>
                    <TableCell>
                      {athlete.school || '-'}
                    </TableCell>
                    <TableCell>
                      {athlete.position || '-'}
                    </TableCell>
                    <TableCell>
                      {athlete.grade || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">
                          {athlete.user?.email || 'User deleted'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {getTotalSessions(athlete)} sessions
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedAthlete(athlete)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Athlete Details Modal */}
      {selectedAthlete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {selectedAthlete.name}
              </CardTitle>
              <CardDescription>
                Athlete details and session history
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Name</Label>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedAthlete.name}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Age</Label>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedAthlete.age || 'Not specified'}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">School</Label>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedAthlete.school || 'Not specified'}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Position</Label>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedAthlete.position || 'Not specified'}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Grade</Label>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedAthlete.grade || 'Not specified'}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Contact</Label>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedAthlete.user?.email || 'User deleted'}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Registered</Label>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {formatDate(selectedAthlete.created_at)}
                  </div>
                </div>
              </div>

              {/* Session Ledger */}
              <div>
                <Label className="text-sm font-medium">Session Attendance Ledger</Label>
                {selectedAthlete.session_history.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {selectedAthlete.session_history.map((session) => (
                      <Card key={session.id} className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">{session.product.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatDate(session.product.session_date)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">
                              {formatPrice(session.product.price_cents)}
                            </div>
                            <Badge 
                              variant={session.payment.status === 'succeeded' ? 'default' : 'secondary'}
                            >
                              {session.payment.status}
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-muted-foreground">
                    No sessions attended yet
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedAthlete(null)}
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
