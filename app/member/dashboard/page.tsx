"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { CreditCard, Settings, Receipt, User as UserIcon, Plus, X } from "lucide-react"
import Link from "next/link"
import { useCart } from "@/contexts/cart-context"

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
  age?: number
  school?: string
  position?: string
  created_at: string
}

export default function MemberDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [recentPayments, setRecentPayments] = useState<Payment[]>([])
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)
  const [showAthleteForm, setShowAthleteForm] = useState(false)
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

  useEffect(() => {
    const supabase = getSupabaseClient()

    supabase.auth.getUser().then(({ data: { user } }: any) => {
      setUser(user)
      if (user) {
        fetchRecentPayments(user.id)
        fetchAthletes(user.id)
      }
    })

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      setUser(session?.user ?? null)
      if (session?.user) {
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
      console.log('Payment successful, refreshing cart...')
      refreshCart()
      // Clean up URL parameter
      const url = new URL(window.location.href)
      url.searchParams.delete('success')
      window.history.replaceState({}, '', url.toString())
    }
  }, [paymentSuccess, refreshCart])

  const fetchRecentPayments = async (userId: string) => {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "succeeded")
        .order("created_at", { ascending: false })
        .limit(3)

      if (error) {
        console.error("Error fetching payments:", error)
        return
      }

      setRecentPayments(data || [])
    } catch (error) {
      console.error("Error fetching payments:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAthletes = async (userId: string) => {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from("athletes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching athletes:", error)
        return
      }

      setAthletes(data || [])
    } catch (error) {
      console.error("Error fetching athletes:", error)
    }
  }

  const createAthlete = async () => {
    try {
      setAthleteFormLoading(true)
      const supabase = getSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      const { data, error } = await supabase
        .from('athletes')
        .insert({
          user_id: user.id,
          name: newAthlete.name,
          age: newAthlete.age ? parseInt(newAthlete.age) : null,
          school: newAthlete.school || null,
          position: newAthlete.position || null
        })
        .select()
        .single()

      if (error) throw error

      setAthletes([data, ...athletes])
      setNewAthlete({ name: '', age: '', school: '', position: '' })
      setShowAthleteForm(false)
      
      // Remove the addAthlete parameter from URL
      router.replace('/member/dashboard')
    } catch (error) {
      console.error('Error creating athlete:', error)
      alert('Failed to create athlete')
    } finally {
      setAthleteFormLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  }

  return (
    <div className="bg-background">
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.user_metadata?.full_name || "Member"}!</h1>
            <p className="text-muted-foreground">Manage your account and view your session history.</p>
          </div>

          {/* Athletes Section */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">Your Athletes</h2>
              <Button onClick={() => setShowAthleteForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Athlete
              </Button>
            </div>
            
            {athletes.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {athletes.map((athlete) => (
                  <Card key={athlete.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <UserIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{athlete.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {athlete.age && `Age ${athlete.age}`}
                            {athlete.school && ` • ${athlete.school}`}
                            {athlete.position && ` • ${athlete.position}`}
                          </p>
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

          {/* Quick Actions Grid */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <Link href="/member/settings">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <UserIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Profile</h3>
                      <p className="text-sm text-muted-foreground">Update your information</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/member/billing">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <CreditCard className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Billing</h3>
                      <p className="text-sm text-muted-foreground">View payments & history</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/member/settings">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Settings className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Settings</h3>
                      <p className="text-sm text-muted-foreground">Account preferences</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Recent Activity */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Recent Purchases
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span>Loading purchases...</span>
                  </div>
                ) : recentPayments.length > 0 ? (
                  <div className="space-y-4">
                    {recentPayments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <CreditCard className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">Session Purchase</p>
                            <p className="text-sm text-muted-foreground">{formatDate(payment.created_at)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatAmount(payment.amount, payment.currency)}</p>
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            Completed
                          </Badge>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2">
                      <Link href="/member/billing">
                        <Button variant="outline" size="sm">
                          View All Payments
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">No purchases yet</Badge>
                      <span className="text-sm text-muted-foreground">Browse available sessions to get started</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Get Started</p>
                        <p className="text-sm text-muted-foreground">Purchase your first session</p>
                      </div>
                      <Link href="/pricing">
                        <Button size="sm">Browse Sessions</Button>
                      </Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Athlete Modal */}
      {showAthleteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Add New Athlete</CardTitle>
                  <CardDescription>
                    Create a new athlete profile
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAthleteForm(false)
                    router.replace('/member/dashboard')
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={newAthlete.name}
                    onChange={(e) => setNewAthlete({ ...newAthlete, name: e.target.value })}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    value={newAthlete.age}
                    onChange={(e) => setNewAthlete({ ...newAthlete, age: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="school">School</Label>
                  <Input
                    id="school"
                    value={newAthlete.school}
                    onChange={(e) => setNewAthlete({ ...newAthlete, school: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="position">Position</Label>
                  <Input
                    id="position"
                    value={newAthlete.position}
                    onChange={(e) => setNewAthlete({ ...newAthlete, position: e.target.value })}
                  />
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={createAthlete} 
                    disabled={athleteFormLoading || !newAthlete.name.trim()}
                    className="flex-1"
                  >
                    {athleteFormLoading ? 'Creating...' : 'Create Athlete'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowAthleteForm(false)
                      router.replace('/member/dashboard')
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
