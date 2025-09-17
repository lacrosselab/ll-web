"use client"

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserIcon, Plus, Edit, Trash2, Settings, Clock, Users } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { useCart } from '@/contexts/cart-context'
import { useToast } from '@/components/ui/toast'

interface Payment {
  id: string
  amount: number
  currency: string
  status: string
  created_at: string
}

interface Athlete {
  id: string
  name: string
  age?: string
  school?: string
  position?: string
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

export default function MemberDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [recentPayments, setRecentPayments] = useState<Payment[]>([])
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)
  const [showAthleteForm, setShowAthleteForm] = useState(false)
  const [editingAthlete, setEditingAthlete] = useState<Athlete | null>(null)
  const [athleteFormLoading, setAthleteFormLoading] = useState(false)
  const [newAthlete, setNewAthlete] = useState({
    name: '',
    age: '',
    school: '',
    position: ''
  })
  
  const searchParams = useSearchParams()
  const router = useRouter()
  const addAthlete = searchParams.get('addAthlete') === 'true'
  const paymentSuccess = searchParams.get('success') === 'true'
  const { refreshCart } = useCart()
  const { toast } = useToast()

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

  // Refresh cart when returning from successful payment
  useEffect(() => {
    if (paymentSuccess) {
      refreshCart()
      // Clean up URL parameter
      const url = new URL(window.location.href)
      url.searchParams.delete('success')
      window.history.replaceState({}, '', url.toString())
    }
  }, [paymentSuccess, refreshCart])

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
      console.error('Error fetching user profile:', error)
    }
  }

  const fetchRecentPayments = async (userId: string) => {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRecentPayments(data || [])
    } catch (error) {
      console.error('Error fetching payments:', error)
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
      console.error('Error fetching athletes:', error)
    } finally {
      setLoading(false)
    }
  }

  const createAthlete = async () => {
    if (!user) return

    setAthleteFormLoading(true)
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .from('athletes')
        .insert({
          user_id: user.id,
          name: newAthlete.name,
          age: newAthlete.age || null,
          school: newAthlete.school || null,
          position: newAthlete.position || null,
        })

      if (error) throw error

      // Reset form and refresh athletes
      setNewAthlete({ name: '', age: '', school: '', position: '' })
      setShowAthleteForm(false)
      setEditingAthlete(null)
      await fetchAthletes(user.id)
      toast({
        title: 'Athlete created successfully!',
        description: 'Your athlete has been added to your account.',
        variant: 'success',
      })
    } catch (error) {
      console.error('Error creating athlete:', error)
      toast({
        title: 'Failed to create athlete',
        description: 'There was an error adding your athlete.',
        variant: 'destructive',
      })
    } finally {
      setAthleteFormLoading(false)
    }
  }

  const updateAthlete = async () => {
    if (!user || !editingAthlete) return

    setAthleteFormLoading(true)
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .from('athletes')
        .update({
          name: newAthlete.name,
          age: newAthlete.age || null,
          school: newAthlete.school || null,
          position: newAthlete.position || null,
        })
        .eq('id', editingAthlete.id)

      if (error) throw error

      // Reset form and refresh athletes
      setNewAthlete({ name: '', age: '', school: '', position: '' })
      setShowAthleteForm(false)
      setEditingAthlete(null)
      await fetchAthletes(user.id)
      toast({
        title: 'Athlete updated successfully!',
        description: 'Your athlete has been updated.',
        variant: 'success',
      })
    } catch (error) {
      console.error('Error updating athlete:', error)
      toast({
        title: 'Failed to update athlete',
        description: 'There was an error updating your athlete.',
        variant: 'destructive',
      })
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
      toast({
        title: 'Athlete deleted successfully',
        description: 'Your athlete has been removed.',
        variant: 'success',
      })
    } catch (error) {
      console.error('Error deleting athlete:', error)
      toast({
        title: 'Failed to delete athlete',
        description: 'There was an error deleting your athlete.',
        variant: 'destructive',
      })
    }
  }

  const startEditingAthlete = (athlete: Athlete) => {
    setEditingAthlete(athlete)
    setNewAthlete({
      name: athlete.name,
      age: athlete.age || '',
      school: athlete.school || '',
      position: athlete.position || ''
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Your Athletes</h2>
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
          <h2 className="text-2xl font-semibold mb-4">Payment History</h2>
          {recentPayments.length > 0 ? (
            <div className="space-y-4">
              {recentPayments.map((payment) => (
                <Card key={payment.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          ${(payment.amount / 100).toFixed(2)} {payment.currency.toUpperCase()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(payment.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={payment.status === 'succeeded' ? 'default' : 'secondary'}>
                        {payment.status}
                      </Badge>
                    </div>
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
                    value={newAthlete.age}
                    onChange={(e) => setNewAthlete({ ...newAthlete, age: e.target.value })}
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

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAthleteForm(false)
                      setEditingAthlete(null)
                      setNewAthlete({ name: '', age: '', school: '', position: '' })
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
