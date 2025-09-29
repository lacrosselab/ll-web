"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Clock, Users, DollarSign, Calendar, Package, Edit, Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import Image from "next/image"
import { logger } from '@/lib/utils'
import { useCart } from "@/contexts/cart-context"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useToast } from '@/components/ui/toast'

// Types for different card modes
interface ProductPrice {
  id: string
  unit_amount: number | null
  currency: string
  interval: string | null
  interval_count: number | null
  type: string
  metadata: Record<string, string>
}

interface AdminProduct {
  id: string
  name: string
  description: string | null
  price_cents: number
  currency: string
  session_date: string
  end_date?: string
  stock_quantity: number
  is_active: boolean
  stripe_product_id: string
  stripe_price_id: string
  created_at: string
  updated_at: string
}

// Base props that all cards need
interface BaseProductCardProps {
  title: string
  description: string | null
  price: string
  sessionDate: string
  endDate?: string
  stockQuantity: number
  image?: string
}

// User-facing card props (pricing page)
interface UserProductCardProps extends BaseProductCardProps {
  mode: 'user'
  productId: string
  interval: string
  intervalCount?: number | null
  features: string[]
  popular?: boolean
  allPrices: ProductPrice[]
  endDateUrgency?: 'normal' | 'ending-soon' | 'ending-very-soon'
}

// Admin card props
interface AdminProductCardProps extends BaseProductCardProps {
  mode: 'admin'
  product: AdminProduct
  onEdit: (product: AdminProduct) => void
  onToggleStatus: (product: AdminProduct) => void
  onDelete: (product: AdminProduct) => void
}

type ProductCardProps = UserProductCardProps | AdminProductCardProps

export function ProductCard(props: ProductCardProps) {
  const [loading, setLoading] = useState(false)
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null)
  const [showAthleteSelection, setShowAthleteSelection] = useState(false)
  const [showAthleteForm, setShowAthleteForm] = useState(false)
  const [athletes, setAthletes] = useState<any[]>([])
  const [newAthlete, setNewAthlete] = useState({
    name: '',
    age: '',
    school: '',
    position: '',
    grade: ''
  })
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const router = useRouter()
  const { addToCart } = useCart()
  const { showToast } = useToast()

  // Get interval display text
  const getIntervalText = (interval: string, intervalCount?: number | null): string => {
    if (interval === 'one-time') return ''
    
    if (intervalCount && intervalCount > 1) {
      return `/${intervalCount} ${interval}s`
    }
    
    return `/${interval}`
  }

  // Format session date display
  const formatSessionDate = (sessionDateString: string, endDateString?: string): string => {
    try {
      const sessionDate = new Date(sessionDateString)
      const now = new Date()
      const diffTime = sessionDate.getTime() - now.getTime()
      const daysUntilSession = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      // If we have an end date, show the date range
      if (endDateString) {
        const endDate = new Date(endDateString)
        logger.debug('endDate', endDate)
        const startFormatted = sessionDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })
        const endFormatted = endDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })
        
        if (daysUntilSession <= 0) return `Session ${startFormatted} - ${endFormatted} (has passed)`
        if (daysUntilSession === 1) return `Session ${startFormatted} - ${endFormatted} (tomorrow)`
        if (daysUntilSession <= 7) return `Session ${startFormatted} - ${endFormatted} (in ${daysUntilSession} days)`
        
        return `Session ${startFormatted} - ${endFormatted}`
      }
      
      // Original single date logic
      if (daysUntilSession <= 0) return 'Session has passed'
      if (daysUntilSession === 1) return 'Session tomorrow'
      if (daysUntilSession <= 7) return `Session in ${daysUntilSession} days`
      
      return `Session ${sessionDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      })}`
    } catch {
      return ''
    }
  }

  // Format date for admin view
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Get stock status styling with enhanced color coding
  const getStockStatus = () => {
    const isOutOfStock = props.stockQuantity <= 0
    
    if (isOutOfStock) {
      return {
        textClass: "text-red-600 font-semibold",
        iconClass: "text-red-500",
        badgeClass: "bg-red-100 text-red-800 border-red-200",
        text: "Sold Out",
        buttonDisabled: true
      }
    }
    
    if (props.stockQuantity <= 3) {
      return {
        textClass: "text-orange-600 font-medium",
        iconClass: "text-orange-500", 
        badgeClass: "bg-orange-100 text-orange-800 border-orange-200",
        text: `${props.stockQuantity} ${props.stockQuantity === 1 ? 'spot' : 'spots'} left`,
        buttonDisabled: false
      }
    }
    
    if (props.stockQuantity <= 10) {
      return {
        textClass: "text-yellow-600 font-medium",
        iconClass: "text-yellow-500",
        badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-200", 
        text: `${props.stockQuantity} spots available`,
        buttonDisabled: false
      }
    }
    
    return {
      textClass: "text-green-600 font-medium",
      iconClass: "text-green-500",
      badgeClass: "bg-green-100 text-green-800 border-green-200",
      text: `${props.stockQuantity} spots available`,
      buttonDisabled: false
    }
  }

  // Get card styling based on urgency (user mode only)
  const getCardStyling = () => {
    if (props.mode === 'admin') {
      return {
        cardClass: props.product.is_active ? '' : 'opacity-60',
        badgeClass: props.product.is_active ? 'default' : 'secondary',
        badgeText: props.product.is_active ? 'Active' : 'Inactive'
      }
    }

    // User mode styling
    switch (props.endDateUrgency) {
      case 'ending-very-soon':
        return {
          cardClass: "relative border-red-500 shadow-lg",
          badgeClass: "bg-primary text-primary-foreground",
          badgeText: "Session Soon"
        }
      case 'ending-soon':
        return {
          cardClass: "relative border-red-500 shadow-lg",
          badgeClass: "bg-primary text-primary-foreground",
          badgeText: "Session This Week"
        }
      default:
        return {
          cardClass: props.popular ? "relative border-primary shadow-lg" : "relative",
          badgeClass: "bg-primary text-primary-foreground",
          badgeText: "Most Popular"
        }
    }
  }

  const loadAthletes = async () => {
    try {
      const supabase = getSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login?redirect=/pricing')
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
      showToast('Failed to load athletes', 'error')
    }
  }

  const handleAddToCart = async () => {
    if (props.mode !== 'user') return

    try {
      setLoading(true)

      // Check if user is authenticated
      const supabase = getSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser() 

      if (!user) {
        router.push("/login?redirect=/pricing")
        return
      }

      // Load athletes and show selection
      await loadAthletes()
      setShowAthleteSelection(true)
    } catch (error) {
      showToast("Failed to add to cart. Please try again.", 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleAthleteSelection = async (athleteId: string) => {
    try {
      setLoading(true)
      const result = await addToCart(
        props.mode === 'user' ? props.productId : props.product.id, 
        athleteId, 
        1
      )
      
      if (result.success) {
        setShowAthleteSelection(false)
        showToast('Added to cart!', 'success')
      } else {
        showToast(result.error || 'Failed to add to cart', 'error')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add to cart. Please try again.'
      showToast(errorMessage, 'error')
    } finally {
      setLoading(false)
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

      // Add the new athlete to the list
      setAthletes([data, ...athletes])
      
      // Auto-select the new athlete and add to cart
      // @ts-ignore - Supabase TypeScript types not properly generated
      await handleAthleteSelection(data.id)
      
      // Reset form and close modals
      setNewAthlete({ name: '', age: '', school: '', position: '', grade: '' })
      setShowAthleteForm(false)
      setShowAthleteSelection(false)
    } catch (error) {
      showToast('Failed to create athlete', 'error')
    } finally {
      setLoading(false)
    }
  }

  const styling = getCardStyling()
  const stockStatus = getStockStatus()

  return (
    <>
      <Card className={styling.cardClass + ' relative'}>
        {/* Badge for popular/urgency (user) or status (admin) */}
        {(props.mode === 'user' && (props.popular || props.endDateUrgency !== 'normal')) && (
          <Badge className={`absolute -top-2 left-1/2 -translate-x-1/2 ${styling.badgeClass}`}>
            {props.endDateUrgency !== 'normal' ? styling.badgeText : 'Most Popular'}
          </Badge>
        )}

        <CardHeader>
          <CardTitle className={`${props.mode === 'user' ? 'text-2xl' : 'text-lg'} truncate`} title={props.title}>
            {props.title}
          </CardTitle>
          
          {/* Session Date Display - More Prominent */}
          <div className="flex items-center gap-2 text-base font-medium text-primary bg-primary/10 px-3 py-2 rounded-lg">
            <Calendar className="h-5 w-5" />
            <span>
              {props.mode === 'user' 
                ? formatSessionDate(props.sessionDate, props.endDate)
                : formatDate(props.sessionDate)
              }
            </span>
          </div>
          
          {/* Price Display */}
          <div className="flex items-baseline gap-1">
            <span className={`${props.mode === 'user' ? 'text-3xl' : 'text-lg'} font-bold`}>{props.price}</span>
            {props.mode === 'user' && (
              <span className="text-muted-foreground">
                {getIntervalText(props.interval, props.intervalCount)}
              </span>
            )}
          </div>

          {/* Description with Expand/Collapse */}
          {props.description && (
            <div className="space-y-2">
              <CardDescription className={`${isDescriptionExpanded ? '' : 'line-clamp-4'}`}>
                {props.description}
              </CardDescription>
              {props.description.length > 100 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                  className="h-auto text-primary hover:text-cream"
                >
                  {isDescriptionExpanded ? (
                    <>
                      Show less <ChevronUp className="h-4 w-4 ml-1" />
                    </>
                  ) : (
                    <>
                      Show more <ChevronDown className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* Enhanced Stock Display */}
          <div className="flex items-center gap-2 text-sm">
            <Users className={`h-4 w-4 ${stockStatus.iconClass}`} />
            <span className={stockStatus.textClass}>
              {stockStatus.text}
            </span>
          </div>

          {/* Multiple Price Options (user mode only) */}
          {props.mode === 'user' && props.allPrices.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Billing options:</p>
              <div className="flex flex-wrap gap-2">
                {props.allPrices.map((priceOption) => (
                  <Button
                    key={priceOption.id}
                    variant={selectedPriceId === priceOption.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPriceId(priceOption.id)}
                    className="text-xs"
                  >
                    {priceOption.interval ? 
                      `${priceOption.interval}${priceOption.interval_count && priceOption.interval_count > 1 ? ` (${priceOption.interval_count})` : ''}` : 
                      'One-time'
                    }
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardHeader>
        
        {props.mode === 'admin' && (

        <CardContent>
          {/* Admin Actions */}
            <div className="flex flex-col xl:flex-row gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => props.onEdit(props.product)}
                className="flex-1 min-w-0"
              >
                <Edit className="h-4 w-4 mr-1" />
                <span className="">Edit</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => props.onToggleStatus(props.product)}
                className="flex-1 min-w-0"
              >
                <span>
                  {props.product.is_active ? 'Deactivate' : 'Activate'}
                </span>
              </Button>
              <Button
                variant="outline"
                onClick={() => props.onDelete(props.product)}
                className="text-destructive hover:text-cream flex-shrink-0"
              >
                <Trash2 className="h-4 w-4" />
                <span className="">Delete</span>

              </Button>
            </div>
            </CardContent>

          )}
        
        {/* Footer with action button (user mode only) */}
        {props.mode === 'user' && (
          <CardFooter>
            <Button
              className="w-full"
              onClick={handleAddToCart}
              disabled={loading || stockStatus.buttonDisabled}
              variant={props.popular ? "default" : "outline"}
              data-testid={stockStatus.buttonDisabled ? "sold-out-button" : "add-to-cart"}
            >
              {loading ? "Adding..." : stockStatus.buttonDisabled ? "Sold Out" : "Add to Cart"}
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Athlete Selection Modal */}
      {showAthleteSelection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Select Athlete</CardTitle>
              <CardDescription>
                Choose which athlete this session is for
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {athletes.map((athlete) => (
                  <Button
                    key={athlete.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleAthleteSelection(athlete.id)}
                    disabled={loading}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    {athlete.name}
                    {athlete.age && ` (Age ${athlete.age})`}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  className="w-full justify-start border-dashed"
                  onClick={() => {
                    setShowAthleteSelection(false)
                    setShowAthleteForm(true)
                  }}
                  data-testid="create-athlete"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Athlete
                </Button>
              </div>
              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowAthleteSelection(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Athlete Modal */}
      {showAthleteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add New Athlete</CardTitle>
              <CardDescription>
                Create a new athlete profile for this session
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
                    data-testid="athlete-name"
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
                  <Label htmlFor="grade">Grade</Label>
                  <select
                    id="grade"
                    value={newAthlete.grade}
                    onChange={(e) => setNewAthlete({ ...newAthlete, grade: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                    data-testid="create-athlete-button"
                  >
                    {loading ? 'Creating...' : 'Create & Add to Cart'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowAthleteForm(false)
                      setShowAthleteSelection(true)
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
    </>
  )
}
