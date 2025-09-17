"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Users, Search, Calendar, User, School } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Athlete {
  id: string
  name: string
  age?: number
  school?: string
  position?: string
  created_at: string
  user: {
    id: string
    email: string
  }
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
    athlete.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (athlete.school && athlete.school.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const getTotalSessions = (athlete: Athlete): number => {
    return athlete.session_history.length
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading athletes...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-500">{error}</div>
        <Button onClick={loadAthletes} className="mt-4">Try Again</Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-4 xl:gap-0 justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Athletes Management</h1>
          <p className="text-muted-foreground">View all athletes and their session history</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search athletes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Athletes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-athletes">{athletes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-sessions">
              {athletes.reduce((total, athlete) => total + getTotalSessions(athlete), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Athletes Table */}
      <Card data-testid="athletes-section">
        <CardHeader>
          <CardTitle>Athletes ({filteredAthletes.length})</CardTitle>
          <CardDescription>
            All registered athletes with their session history
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Athlete</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAthletes.map((athlete) => (
                  <TableRow key={athlete.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{athlete.name}</div>
                          {athlete.age && (
                            <div className="text-sm text-muted-foreground">Age {athlete.age}</div>
                          )}
                          {athlete.position && (
                            <Badge variant="outline" className="text-xs">
                              {athlete.position}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{athlete.user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {athlete.school ? (
                        <div className="flex items-center gap-1 text-sm">
                          <School className="h-3 w-3" />
                          {athlete.school}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {getTotalSessions(athlete)} sessions
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(athlete.created_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedAthlete(athlete)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {filteredAthletes.map((athlete) => (
              <Card key={athlete.id} className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{athlete.name}</div>
                      {athlete.age && (
                        <div className="text-sm text-muted-foreground">Age {athlete.age}</div>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {getTotalSessions(athlete)} sessions
                  </Badge>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Contact: </span>
                    <span className="font-medium">{athlete.user.email}</span>
                  </div>
                  {athlete.school && (
                    <div className="flex items-center gap-1">
                      <School className="h-3 w-3 text-muted-foreground" />
                      <span>{athlete.school}</span>
                    </div>
                  )}
                  {athlete.position && (
                    <div>
                      <Badge variant="outline" className="text-xs">
                        {athlete.position}
                      </Badge>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Joined: </span>
                    <span>{formatDate(athlete.created_at)}</span>
                  </div>
                </div>
                
                <div className="mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedAthlete(athlete)}
                    className="w-full"
                  >
                    View Session History
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Athlete Details Modal */}
      {selectedAthlete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="athlete-details-modal">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl">{selectedAthlete.name}</CardTitle>
                  <CardDescription>
                    Session attendance ledger for {selectedAthlete.name}
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={() => setSelectedAthlete(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Athlete Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <Label className="text-sm font-medium">Contact</Label>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedAthlete.user.email}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">School</Label>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedAthlete.school || 'Not specified'}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Age</Label>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedAthlete.age || 'Not specified'}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Position</Label>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedAthlete.position || 'Not specified'}
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
                              Session Date: {formatDate(session.product.session_date)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Registered: {formatDate(session.created_at)}
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="default" className="text-xs">
                              Attended
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-muted-foreground p-4 bg-muted rounded-lg">
                    No sessions attended yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
