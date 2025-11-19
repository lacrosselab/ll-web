"use client"

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserIcon, Plus, Edit, Trash2, Settings, Calendar, MapPin, ChevronDown, ChevronUp } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { useCart } from '@/contexts/cart-context'
import { formatDateOnly, logger } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { getGoogleMapsLink, formatTime, DEFAULT_SESSION_LOCATION } from '@/emails/shared'

interface ProductSession {
  id?: string
  session_date: string
  session_time: string
  location?: string | null
}

interface PaymentAthlete {
  id: string
  quantity: number
  unit_price_cents: number
  created_at: string
  athlete: {
    id: string
    name: string
    age?: number
    school?: string
  }
  product: {
    id: string
    name: string
    session_date: string
    description?: string
    gender?: string | null
    min_grade?: string | null
    max_grade?: string | null
    skill_level?: string | null
    product_sessions?: ProductSession[]
  }
}

interface Payment {
  id: string
  amount: number
  currency: string
  status: string
  created_at: string
  payment_athletes?: PaymentAthlete[]
}

interface Athlete {
  id: string
  name: string
  age?: number
  school?: string
  position?: string
  grade?: string
  created_at: string
}

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

function DashboardContent() {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [recentPayments, setRecentPayments] = useState<Payment[]>([])
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)
  const [showAthleteForm, setShowAthleteForm] = useState(false)
  const [editingAthlete, setEditingAthlete] = useState<Athlete | null>(null)
  const [athleteFormLoading, setAthleteFormLoading] = useState(false)
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({})
  const [newAthlete, setNewAthlete] = useState({
    name: '',
    age: '',
    school: '',
    position: '',
    grade: ''
  })
  
  const searchParams = useSearchParams()
  const router = useRouter()
  const addAthlete = searchParams.get('addAthlete') === 'true'
  const paymentSuccess = searchParams.get('success') === 'true'
  const { clearCart } = useCart()
  const { showToast } = useToast()

  useEffect(() => {
    const supabase = getSupabaseClient()

    supabase.auth.getUser().then(({ data: { user } }: any) => {
      setUser(user)
      if (user) {
        fetchUserProfile(user.id)
        fetchRecentPayments(user.id)
        fetchAthletes(user.id)
      }
    })

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserProfile(session.user.id)
        fetchRecentPayments(session.user.id)
        fetchAthletes(session.user.id)
      }
    })

    return () => authSubscription.unsubscribe()
  }, [])

  // Show athlete form if addAthlete=true in URL
  useEffect(() => {
    if (addAthlete) {
      setShowAthleteForm(true)
    }
  }, [addAthlete])

  // Clear cart when returning from successful payment
  useEffect(() => {
    if (paymentSuccess) {
      clearCart()
      // Clean up URL parameter
      const url = new URL(window.location.href)
      url.searchParams.delete('success')
      window.history.replaceState({}, '', url.toString())
    }
  }, [paymentSuccess, clearCart])

  const fetchUserProfile = async (userId: string) => {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setUserProfile(data)
    } catch (error) {
      logger.error('Error fetching user profile', { error })
    }
  }

  const fetchRecentPayments = async (userId: string) => {
    try {
      const supabase = getSupabaseClient()
      
      // Try to get detailed payment data with athlete and product info
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          payment_athletes (
            id,
            quantity,
            unit_price_cents,
            created_at,
            athlete:athletes (
              id,
              name,
              age,
              school
            ),
            product:products!inner (
              id,
              name,
              session_date,
              description,
              is_active,
              gender,
              min_grade,
              max_grade,
              skill_level,
              product_sessions (
                id,
                session_date,
                session_time,
                location
              )
            )
          )
        `)
        .eq('user_id', userId)
        .eq('payment_athletes.product.is_active', true)
        .order('created_at', { ascending: false })
        .limit(5) // Only show recent 5 payments on dashboard

      if (error) {
        logger.error('Error fetching detailed payments', { error })
        // Fallback to basic payments if detailed query fails
        const { data: basicData, error: basicError } = await supabase
          .from('payments')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5)
        
        if (basicError) throw basicError
        setRecentPayments(basicData || [])
        return
      }

      setRecentPayments(data || [])
    } catch (error) {
      logger.error('Error fetching payments', { error })
    }
  }

  const fetchAthletes = async (userId: string) => {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('athletes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAthletes(data || [])
    } catch (error) {
      logger.error('Error fetching athletes', { error })
    } finally {
      setLoading(false)
    }
  }

  const createAthlete = async () => {
    if (!user) return

    // Validate input before submitting
    if (!newAthlete.name.trim()) {
      showToast('Name is required. Please enter the athlete\'s name.', 'error')
      return
    }

    // Validate age if provided
    let ageValue: number | null = null
    if (newAthlete.age.trim()) {
      const ageNum = parseInt(newAthlete.age.trim())
      if (isNaN(ageNum) || ageNum < 1 || ageNum > 100) {
        showToast('Please enter a valid age between 1 and 100.', 'error')
        return
      }
      ageValue = ageNum
    }

    setAthleteFormLoading(true)
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .from('athletes')
          // @ts-ignore - Supabase TypeScript types not properly generated
        .insert({
          user_id: user.id,
          name: newAthlete.name.trim(),
          age: ageValue,
          school: newAthlete.school.trim() || null,
          position: newAthlete.position.trim() || null,
          grade: newAthlete.grade.trim() || null,
        })

      if (error) {
        logger.error('Database error creating athlete', { error })
        throw error
      }

      // Reset form and refresh athletes
      setNewAthlete({ name: '', age: '', school: '', position: '', grade: '' })
      setShowAthleteForm(false)
      setEditingAthlete(null)
      await fetchAthletes(user.id)
      showToast('Athlete created successfully!', 'success')
    } catch (error) {
      logger.error('Error creating athlete', { error })
      const errorMessage = error instanceof Error ? error.message : 'There was an error adding your athlete.'
      showToast(errorMessage, 'error')
    } finally {
      setAthleteFormLoading(false)
    }
  }

  const updateAthlete = async () => {
    if (!user || !editingAthlete) return

    // Validate input before submitting
    if (!newAthlete.name.trim()) {
      showToast('Name is required. Please enter the athlete\'s name.', 'error')
      return
    }

    // Validate age if provided
    let ageValue: number | null = null
    if (newAthlete.age.trim()) {
      const ageNum = parseInt(newAthlete.age.trim())
      if (isNaN(ageNum) || ageNum < 1 || ageNum > 100) {
        showToast('Please enter a valid age between 1 and 100.', 'error')
        return
      }
      ageValue = ageNum
    }

    // Validate that we have an athlete ID
    if (!editingAthlete.id) {
      showToast('Error: Athlete ID is missing. Please try again.', 'error')
      return
    }

    setAthleteFormLoading(true)
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .from('athletes')
        // @ts-ignore - Supabase TypeScript types not properly generated
        .update({
          name: newAthlete.name.trim(),
          age: ageValue,
          school: newAthlete.school.trim() || null,
          position: newAthlete.position.trim() || null,
          grade: newAthlete.grade.trim() || null,
        })
        .eq('id', editingAthlete.id)

      if (error) {
        logger.error('Database error updating athlete', { error })
        throw error
      }

      // Reset form and refresh athletes
      setNewAthlete({ name: '', age: '', school: '', position: '', grade: '' })
      setShowAthleteForm(false)
      setEditingAthlete(null)
      await fetchAthletes(user.id)
      showToast('Athlete updated successfully!', 'success')
    } catch (error) {
      logger.error('Error updating athlete', { error })
      const errorMessage = error instanceof Error ? error.message : 'There was an error updating your athlete.'
      showToast(errorMessage, 'error')
    } finally {
      setAthleteFormLoading(false)
    }
  }

  const deleteAthlete = async (athleteId: string) => {
    if (!confirm('Are you sure you want to delete this athlete? This action cannot be undone.')) {
      return
    }

    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .from('athletes')
        .delete()
        .eq('id', athleteId)

      if (error) throw error
      await fetchAthletes(user!.id)
      showToast('Athlete deleted successfully', 'success')
    } catch (error) {
      logger.error('Error deleting athlete', { error })
      showToast('Failed to delete athlete', 'error')
    }
  }

  const startEditingAthlete = (athlete: Athlete) => {
    setEditingAthlete(athlete)
    setNewAthlete({
      name: athlete.name,
      age: athlete.age ? athlete.age.toString() : '',
      school: athlete.school || '',
      position: athlete.position || '',
      grade: athlete.grade || ''
    })
    setShowAthleteForm(true)
  }

  const handleAthleteFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingAthlete) {
      updateAthlete()
    } else {
      createAthlete()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard
          </h1>
        </div>

        {/* Athletes Section */}
        <div className="mb-8">
          <div className="flex-col lg:flex-row mb-4 justify-between">
            <h2 className="text-2xl font-semibold mb-4">Your Athletes</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push('/member/settings')}>
                <Settings className="h-4 w-4 mr-2" />
                Account Settings
              </Button>
              <Button onClick={() => setShowAthleteForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Athlete
              </Button>
            </div>
          </div>
          
          {athletes.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {athletes.map((athlete) => (
                <Card key={athlete.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <UserIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{athlete.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {athlete.age && `Age ${athlete.age}`}
                            {athlete.school && ` • ${athlete.school}`}
                            {athlete.position && ` • ${athlete.position}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditingAthlete(athlete)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAthlete(athlete.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <UserIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No athletes yet</h3>
                <p className="text-muted-foreground mb-4">
                  Add athlete profiles to register them for training sessions
                </p>
                <Button onClick={() => setShowAthleteForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Athlete
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Payment History */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Recent Payments</h2>
          {recentPayments.length > 0 ? (
            <div className="space-y-4">
              {recentPayments.map((payment) => (
                <Card key={payment.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: payment.currency.toUpperCase(),
                            }).format(payment.amount / 100)}
                          </h3>
                          <Badge className='capitalize' variant={payment.status === 'succeeded' ? 'default' : 'secondary'}>
                            {payment.status || 'Unknown status'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(payment.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    
                    {/* Show detailed payment info if available */}
                    {payment.payment_athletes && payment.payment_athletes.length > 0 ? (
                      <div className="space-y-4 pt-3 border-t">
                        {payment.payment_athletes.map((paymentAthlete) => {
                          const sessionKey = `${payment.id}-${paymentAthlete.id}`
                          const isExpanded = expandedSessions[sessionKey] || false
                          
                          // Use sessions array if available, otherwise fall back to legacy session_date
                          const displaySessions = paymentAthlete.product?.product_sessions && paymentAthlete.product.product_sessions.length > 0
                            ? paymentAthlete.product.product_sessions.sort((a, b) => {
                                const dateA = new Date(`${a.session_date}T${a.session_time}`)
                                const dateB = new Date(`${b.session_date}T${b.session_time}`)
                                return dateA.getTime() - dateB.getTime()
                              })
                            : paymentAthlete.product?.session_date
                              ? [{ session_date: paymentAthlete.product.session_date, session_time: '00:00:00', location: null }]
                              : []
                          
                          return (
                            <div key={paymentAthlete.id} className="space-y-2">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="font-medium mb-1">
                                    {paymentAthlete.product?.name || 'Product not found'}
                                  </div>
                                  <div className="text-sm text-muted-foreground mb-2">
                                    {paymentAthlete.athlete?.name || 'Athlete not found'}
                                    {paymentAthlete.athlete?.age && ` (Age ${paymentAthlete.athlete.age})`}
                                    {paymentAthlete.athlete?.school && ` - ${paymentAthlete.athlete.school}`}
                                  </div>
                                  
                                  {/* Badges for gender, skill level, and grade range */}
                                  {(paymentAthlete.product?.gender || paymentAthlete.product?.skill_level || paymentAthlete.product?.min_grade || paymentAthlete.product?.max_grade) && (
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                      {paymentAthlete.product.gender && (
                                        <Badge variant="outline" className="text-xs font-medium px-2 py-0.5">
                                          {paymentAthlete.product.gender === 'co-ed' ? 'Co-ed' : paymentAthlete.product.gender.charAt(0).toUpperCase() + paymentAthlete.product.gender.slice(1)}
                                        </Badge>
                                      )}
                                      {paymentAthlete.product.skill_level && (
                                        <Badge variant="outline" className="text-xs font-medium px-2 py-0.5">
                                          {paymentAthlete.product.skill_level.charAt(0).toUpperCase() + paymentAthlete.product.skill_level.slice(1)}
                                        </Badge>
                                      )}
                                      {paymentAthlete.product.min_grade && paymentAthlete.product.max_grade && (
                                        <Badge variant="outline" className="text-xs font-medium px-2 py-0.5">
                                          Grades {paymentAthlete.product.min_grade}-{paymentAthlete.product.max_grade}
                                        </Badge>
                                      )}
                                      {paymentAthlete.product.min_grade && !paymentAthlete.product.max_grade && (
                                        <Badge variant="outline" className="text-xs font-medium px-2 py-0.5">
                                          Grade {paymentAthlete.product.min_grade}+
                                        </Badge>
                                      )}
                                      {!paymentAthlete.product.min_grade && paymentAthlete.product.max_grade && (
                                        <Badge variant="outline" className="text-xs font-medium px-2 py-0.5">
                                          Up to Grade {paymentAthlete.product.max_grade}
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Session Times Display - Collapsible */}
                                  {displaySessions.length > 0 && (
                                    <div className="space-y-2">
                                      <button
                                        onClick={() => setExpandedSessions(prev => ({ ...prev, [sessionKey]: !isExpanded }))}
                                        className="flex items-center gap-2 text-sm font-medium hover:text-primary hover:shadow-none transition-colors"
                                      >
                                        <Calendar className="h-4 w-4" />
                                        <span>
                                          {displaySessions.length} {displaySessions.length === 1 ? 'Session' : 'Sessions'}
                                        </span>
                                        {isExpanded ? (
                                          <ChevronUp className="h-4 w-4 ml-auto" />
                                        ) : (
                                          <ChevronDown className="h-4 w-4 ml-auto" />
                                        )}
                                      </button>
                                      
                                      {isExpanded && (
                                        <div className="space-y-3 pl-6 border-l-2">
                                          {displaySessions.map((session, idx) => {
                                            const formattedDate = formatDateOnly(session.session_date, 'en-US', {
                                              weekday: 'short',
                                              month: 'short',
                                              day: 'numeric',
                                              year: 'numeric'
                                            })
                                            const formattedTime = formatTime(session.session_time)
                                            const displayLocation = session.location || DEFAULT_SESSION_LOCATION
                                            
                                            return (
                                              <div key={idx} className="space-y-1">
                                                <div className="flex items-center gap-2 text-sm">
                                                  <span className="font-medium text-muted-foreground">Session {idx + 1}:</span>
                                                  <span>
                                                    {formattedDate}
                                                    {formattedTime && ` at ${formattedTime}`}
                                                  </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground pl-8">
                                                  <MapPin className="h-3 w-3" />
                                                  <a
                                                    href={getGoogleMapsLink(displayLocation)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hover:underline"
                                                  >
                                                    {displayLocation}
                                                  </a>
                                                </div>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right ml-4">
                                  <div className="font-medium">
                                    ${(paymentAthlete.unit_price_cents * paymentAthlete.quantity / 100).toFixed(2)}
                                  </div>
                                  {paymentAthlete.quantity > 1 && (
                                    <div className="text-xs text-muted-foreground">
                                      {paymentAthlete.quantity} × ${(paymentAthlete.unit_price_cents / 100).toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      /* Fallback for payments without detailed data */
                      <div className="pt-3 border-t">
                        <div className="text-sm text-muted-foreground">
                          Session Purchase - Details being processed
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <h3 className="font-semibold mb-2">No payments yet</h3>
                <p className="text-muted-foreground mb-4">
                  Your payment history will appear here after you make your first purchase
                </p>
                <Button onClick={() => router.push('/pricing')}>
                  View Available Sessions
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Athlete Form Modal */}
      {showAthleteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>
                {editingAthlete ? 'Edit Athlete' : 'Add New Athlete'}
              </CardTitle>
              <CardDescription>
                {editingAthlete ? 'Update athlete information' : 'Add a new athlete to your account'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAthleteFormSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={newAthlete.name}
                    onChange={(e) => setNewAthlete({ ...newAthlete, name: e.target.value })}
                    required
                    data-testid="athlete-name"
                  />
                </div>

                <div>
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    min="1"
                    max="100"
                    value={newAthlete.age}
                    onChange={(e) => setNewAthlete({ ...newAthlete, age: e.target.value })}
                    placeholder="Enter age (optional)"
                    data-testid="athlete-age"
                  />
                </div>

                <div>
                  <Label htmlFor="school">School</Label>
                  <Input
                    id="school"
                    value={newAthlete.school}
                    onChange={(e) => setNewAthlete({ ...newAthlete, school: e.target.value })}
                    data-testid="athlete-school"
                  />
                </div>

                <div>
                  <Label htmlFor="position">Position</Label>
                  <Input
                    id="position"
                    value={newAthlete.position}
                    onChange={(e) => setNewAthlete({ ...newAthlete, position: e.target.value })}
                    data-testid="athlete-position"
                  />
                </div>

                <div>
                  <Label className="mb-2" htmlFor="grade">Grade</Label>
                  <select
                    id="grade"
                    value={newAthlete.grade}
                    onChange={(e) => setNewAthlete({ ...newAthlete, grade: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid="athlete-grade"
                  >
                    <option value="">Select grade (optional)</option>
                    <option value="K">Kindergarten</option>
                    <option value="1">1st Grade</option>
                    <option value="2">2nd Grade</option>
                    <option value="3">3rd Grade</option>
                    <option value="4">4th Grade</option>
                    <option value="5">5th Grade</option>
                    <option value="6">6th Grade</option>
                    <option value="7">7th Grade</option>
                    <option value="8">8th Grade</option>
                    <option value="9">9th Grade</option>
                    <option value="10">10th Grade</option>
                    <option value="11">11th Grade</option>
                    <option value="12">12th Grade</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAthleteForm(false)
                      setEditingAthlete(null)
                      setNewAthlete({ name: '', age: '', school: '', position: '', grade: '' })
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={athleteFormLoading}
                    className="flex-1"
                  >
                    {athleteFormLoading ? 'Saving...' : (editingAthlete ? 'Update Athlete' : 'Add Athlete')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function MemberDashboard() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardContent />
    </Suspense>
  )
}
