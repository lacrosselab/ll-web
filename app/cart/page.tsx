"use client"

import { useState, useEffect } from 'react'
// Prevent static generation of cart page
export const dynamic = 'force-dynamic'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCart } from '@/contexts/cart-context'
import { useToast } from '@/components/ui/toast'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Minus, Plus, Trash2, ShoppingCart, User, Calendar, DollarSign } from 'lucide-react'
import { formatDateOnly, formatDateRange, logger } from '@/lib/utils'
import { WaiverModal } from '@/components/waiver-modal'

interface WaiverStatus {
  waiverSigned: boolean
  waiverSignedAt: string | null
  hasMinors: boolean
  minorAthleteNames: string[]
}

interface Athlete {
  id: string
  name: string
  age?: number
  school?: string
  position?: string
  grade?: string
}

export default function CartPage() {
  const { state, updateCartItem, removeFromCart, clearCart, getTotalPrice } = useCart()
  const { showToast } = useToast()
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [showAthleteForm, setShowAthleteForm] = useState(false)
  const [newAthlete, setNewAthlete] = useState({
    name: '',
    age: '',
    school: '',
    position: '',
    grade: ''
  })
  const [showWaiverModal, setShowWaiverModal] = useState(false)
  const [waiverStatus, setWaiverStatus] = useState<WaiverStatus | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadAthletes()
  }, [])

  const loadAthletes = async () => {
    try {
      const supabase = getSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login?redirect=/cart')
        return
      }

      const { data, error } = await supabase
        .from('athletes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAthletes(data || [])
    } catch (error) {
      logger.error('Error loading athletes', { error })
    }
  }

  const createAthlete = async () => {
    try {
      setLoading(true)
      const supabase = getSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      const { data, error } = await supabase
        .from('athletes')
        // @ts-ignore - Supabase TypeScript types not properly generated
        .insert({
          user_id: user.id,
          name: newAthlete.name,
          age: newAthlete.age ? parseInt(newAthlete.age) : null,
          school: newAthlete.school || null,
          position: newAthlete.position || null,
          grade: newAthlete.grade || null
        })
        .select()
        .single()

      if (error) throw error

      setAthletes([data, ...athletes])
      setNewAthlete({ name: '', age: '', school: '', position: '', grade: '' })
      setShowAthleteForm(false)
    } catch (error) {
      logger.error('Error creating athlete', { error })
      showToast('Failed to create athlete', 'error')
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

  const formatSessionDate = (sessionDate: string): string => {
    return formatDateOnly(sessionDate)
  }

  const checkWaiverStatus = async (): Promise<WaiverStatus | null> => {
    try {
      const response = await fetch('/api/waiver/status')
      if (!response.ok) throw new Error('Failed to fetch waiver status')
      const data = await response.json()
      setWaiverStatus(data)
      return data
    } catch (error) {
      logger.error('Error checking waiver status', { error })
      return null
    }
  }

  const proceedToCheckout = async () => {
    // Create checkout session with cart items
    const lineItems = state.items.map(item => ({
      price: item.product.stripe_price_id,
      quantity: item.quantity,
      // Add athlete info as metadata for session-level metadata
      metadata: {
        athlete_id: item.athleteId,
        athlete_name: item.athlete.name,
        product_id: item.productId
      }
    }))

    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lineItems }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      logger.error('Checkout API Error', {
        status: response.status,
        statusText: response.statusText,
        errorData
      })
      throw new Error(errorData.error || 'Failed to create checkout session')
    }

    const { sessionId } = await response.json()

    // Redirect to Stripe Checkout
    const stripe = (await import('@stripe/stripe-js')).loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
    const stripeInstance = await stripe
    if (stripeInstance) {
      await stripeInstance.redirectToCheckout({ sessionId })
    }
  }

  const handleWaiverSigned = async () => {
    setShowWaiverModal(false)
    // Refetch status to confirm
    const status = await checkWaiverStatus()
    if (status?.waiverSigned) {
      // Proceed to checkout
      try {
        setCheckoutLoading(true)
        await proceedToCheckout()
      } catch (error) {
        logger.error('Error during checkout after waiver', { error })
        const errorMessage = error instanceof Error ? error.message : 'Failed to start checkout. Please try again.'
        showToast(errorMessage, 'error')
      } finally {
        setCheckoutLoading(false)
      }
    }
  }

  const handleCheckout = async () => {
    try {
      setCheckoutLoading(true)

      // Check if all cart items have athletes
      const itemsWithoutAthletes = state.items.filter(item => !item.athleteId)
      if (itemsWithoutAthletes.length > 0) {
        showToast('Please assign athletes to all cart items before checkout', 'error')
        return
      }

      // Check waiver status before proceeding
      const status = await checkWaiverStatus()
      if (!status) {
        showToast('Unable to verify waiver status. Please try again.', 'error')
        return
      }

      if (!status.waiverSigned) {
        // Show waiver modal instead of proceeding
        setShowWaiverModal(true)
        return
      }

      // Waiver signed, proceed to checkout
      await proceedToCheckout()
    } catch (error) {
      logger.error('Error during checkout', { error })
      const errorMessage = error instanceof Error ? error.message : 'Failed to start checkout. Please try again.'
      showToast(errorMessage, 'error')
    } finally {
      setCheckoutLoading(false)
    }
  }

  if (state.isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading cart...</div>
      </div>
    )
  }

  if (state.items.length === 0) {
    return (
      <div className="container mx-auto min-h-[70vh] lg:min-h-[77vh] px-4 py-8">
        <div className="text-center py-12">
          <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-3xl font-bold mb-4">Your cart is empty</h1>
          <p className="text-muted-foreground mb-6">
            Add some training sessions to get started!
          </p>
          <Button onClick={() => router.push('/pricing')}>
            Browse Sessions
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto min-h-[70vh] lg:min-h-[77vh] px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Shopping Cart</h1>
        <Button variant="outline" onClick={clearCart}>
          Clear Cart
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {state.items.map((item) => (
            <Card key={`${item.productId}-${item.athleteId}`} data-testid="cart-item">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{item.product.name}</CardTitle>
                    <CardDescription>{item.product.description}</CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {formatPrice(item.product.price_cents)}
                    </div>
                    <Badge variant="outline" className="mt-1">
                      {item.quantity} {item.quantity === 1 ? 'spot' : 'spots'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Session Date */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Session: {formatSessionDate(item.product.session_date)}</span>
                </div>

                {/* Athlete Display */}
                <div className="space-y-2">
                  <Label>Assigned Athlete</Label>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="font-medium">{item.athlete.name}</span>
                      {item.athlete.age && (
                        <span className="text-sm text-muted-foreground">
                          (Age {item.athlete.age})
                        </span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeFromCart(item.productId, item.athleteId)}
                      data-testid="remove-item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Remove quantity controls - training sessions are always 1 spot per athlete */}
                {/* Quantity Controls - DISABLED FOR TRAINING SESSIONS */}
                {/* 
                <div className="flex items-center gap-2">
                  <Label>Quantity:</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateCartItem(item.productId, item.athleteId, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateCartItem(item.productId, item.athleteId, item.quantity + 1)}
                      disabled={item.quantity >= item.product.stock_quantity}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    (Max: {item.product.stock_quantity})
                  </span>
                </div>
                */}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>Items ({state.items.length})</span>
                <span>{formatPrice(getTotalPrice())}</span>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>{formatPrice(getTotalPrice())}</span>
                </div>
              </div>
              
              <Button 
                className="w-full" 
                onClick={handleCheckout}
                disabled={checkoutLoading}
                data-testid="checkout-button"
              >
                {checkoutLoading ? 'Processing...' : 'Proceed to Checkout'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Athlete Modal */}
      {showAthleteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add New Athlete</CardTitle>
              <CardDescription>
                Create a new athlete profile for your cart items
              </CardDescription>
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

                <div>
                  <Label className="mb-4" htmlFor="grade">Grade</Label>
                  <select
                    id="grade"
                    value={newAthlete.grade}
                    onChange={(e) => setNewAthlete({ ...newAthlete, grade: e.target.value })}
                    className="flex w-full rounded-md border border-input bg-background text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                    onClick={createAthlete} 
                    disabled={loading || !newAthlete.name.trim()}
                    className="flex-1"
                  >
                    {loading ? 'Creating...' : 'Create Athlete'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAthleteForm(false)}
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

      {/* Waiver Modal */}
      <WaiverModal
        isOpen={showWaiverModal}
        onClose={() => setShowWaiverModal(false)}
        onWaiverSigned={handleWaiverSigned}
        hasMinors={waiverStatus?.hasMinors ?? false}
        minorAthleteNames={waiverStatus?.minorAthleteNames ?? []}
      />
    </div>
  )
}
