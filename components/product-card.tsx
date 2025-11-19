"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Clock, Users, DollarSign, Calendar, Package, Edit, Trash2, Plus, ChevronDown, ChevronUp, MapPin } from "lucide-react"
import { useState, useRef, useEffect } from "react"
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
  stock_quantity: number
  is_active: boolean
  stripe_product_id: string
  stripe_price_id: string
  created_at: string
  updated_at: string
}

interface ProductSession {
  id?: string
  session_date: string
  session_time: string
  location?: string | null
}

// Base props that all cards need
interface BaseProductCardProps {
  title: string
  description: string | null
  price: string
  sessionDate: string
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
  gender?: string | null
  minGrade?: string | null
  maxGrade?: string | null
  skillLevel?: string | null
  sessions?: ProductSession[]
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
  const [sessionsExpanded, setSessionsExpanded] = useState(false)
  const [newAthlete, setNewAthlete] = useState({
    name: '',
    age: '',
    school: '',
    position: '',
    grade: ''
  })
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [showExpandButton, setShowExpandButton] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [sessionDateColor, setSessionDateColor] = useState<string>('text-gray-500')
  const [adminFormattedDate, setAdminFormattedDate] = useState<string>('')
  const descriptionRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { addToCart } = useCart()
  const { showToast } = useToast()

  // Track when component has mounted (client-side only)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Compute session date color only after mount to avoid hydration errors
  useEffect(() => {
    if (mounted && props.mode === 'user') {
      const color = getSessionDateColor(props.sessionDate)
      setSessionDateColor(color)
    }
  }, [mounted, props.sessionDate, props.mode])

  // Format dates only after mount to avoid hydration errors
  useEffect(() => {
    if (mounted && props.mode === 'admin') {
      const adminDate = formatDate(props.sessionDate)
      setAdminFormattedDate(adminDate)
    }
  }, [mounted, props.sessionDate, props.mode])

  // Check if description text overflows the 4-line limit
  useEffect(() => {
    if (descriptionRef.current && props.description) {
      const element = descriptionRef.current
      const lineHeight = parseFloat(getComputedStyle(element).lineHeight)
      const maxHeight = lineHeight * 4 // 4 lines
      const actualHeight = element.scrollHeight
      
      setShowExpandButton(actualHeight > maxHeight)
    }
  }, [props.description])

  // Get interval display text
  const getIntervalText = (interval: string, intervalCount?: number | null): string => {
    if (interval === 'one-time') return ''
    
    if (intervalCount && intervalCount > 1) {
      return `/${intervalCount} ${interval}s`
    }
    
    return `/${interval}`
  }


  // Get color coding for session date based on timing
  const getSessionDateColor = (sessionDateString: string): string => {
    try {
      // Parse date string to avoid timezone issues by treating as UTC
      const parseDate = (dateString: string) => {
        const [year, month, day] = dateString.split('-').map(Number)
        return new Date(Date.UTC(year, month - 1, day)) // Use UTC to avoid timezone shifts
      }
      
      const sessionDate = parseDate(sessionDateString)
      const now = new Date()
      
      // Compare dates at start of day to include the full session day
      const sessionStartOfDay = new Date(Date.UTC(sessionDate.getUTCFullYear(), sessionDate.getUTCMonth(), sessionDate.getUTCDate()))
      const nowStartOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      
      const diffTime = sessionStartOfDay.getTime() - nowStartOfDay.getTime()
      const daysUntilSession = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      if (daysUntilSession < 0) return 'text-gray-500' // Past sessions (yesterday or earlier)
      if (daysUntilSession === 0) return 'text-red-600' // Today - urgent!
      if (daysUntilSession <= 7) return 'text-red-600' // This week
      return 'text-green-600' // More than a week away
    } catch {
      return 'text-gray-500'
    }
  }

  // Format date for admin view
  const formatDate = (dateString: string): string => {
    try {
      // Parse date string to avoid timezone issues by treating as UTC
      const [year, month, day] = dateString.split('-').map(Number)
      const date = new Date(Date.UTC(year, month - 1, day)) // Use UTC to avoid timezone shifts
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC' // Force UTC display
      })
    } catch {
      return dateString // fallback to original string
    }
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

        <CardHeader className="space-y-2">
          {/* Title */}
          <CardTitle className={`${props.mode === 'user' ? 'text-xl' : 'text-lg'} truncate`} title={props.title}>
            {props.title}
          </CardTitle>

          {/* Description with Expand/Collapse */}
          {props.description && (
            <div className="space-y-2">
              <CardDescription 
                ref={descriptionRef}
                className={`text-base ${isDescriptionExpanded ? '' : 'line-clamp-4'}`}
              >
                {props.description}
              </CardDescription>
              {showExpandButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                  className="h-auto text-sm text-primary hover:text-cream"
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

          {/* Badges for structured information */}
          {props.mode === 'user' && (
            <div className="flex flex-wrap items-center gap-2">
              {props.gender && (
                <Badge variant="outline" className="text-sm font-medium px-3 py-1">
                  {props.gender === 'co-ed' ? 'Co-ed' : props.gender.charAt(0).toUpperCase() + props.gender.slice(1)}
                </Badge>
              )}
              {props.skillLevel && (
                <Badge variant="outline" className="text-sm font-medium px-3 py-1">
                  {props.skillLevel.charAt(0).toUpperCase() + props.skillLevel.slice(1)}
                </Badge>
              )}
              {props.minGrade && props.maxGrade && (
                <Badge variant="outline" className="text-sm font-medium px-3 py-1">
                  Grades {props.minGrade}-{props.maxGrade}
                </Badge>
              )}
              {props.minGrade && !props.maxGrade && (
                <Badge variant="outline" className="text-sm font-medium px-3 py-1">
                  Grade {props.minGrade}+
                </Badge>
              )}
              {!props.minGrade && props.maxGrade && (
                <Badge variant="outline" className="text-sm font-medium px-3 py-1">
                  Up to Grade {props.maxGrade}
                </Badge>
              )}
            </div>
          )}
          
          {/* Session Times Display - Collapsible with labels */}
          {props.mode === 'user' && (
            <div className="space-y-2">
              {mounted ? (
                (() => {
                  // Use sessions if available, otherwise fall back to legacy sessionDate
                  const displaySessions = props.sessions && props.sessions.length > 0
                    ? props.sessions.sort((a, b) => {
                        const dateA = new Date(`${a.session_date}T${a.session_time}`)
                        const dateB = new Date(`${b.session_date}T${b.session_time}`)
                        return dateA.getTime() - dateB.getTime()
                      })
                    : props.sessionDate
                      ? [{ session_date: props.sessionDate, session_time: '00:00:00' }]
                      : []

                  if (displaySessions.length === 0) {
                    return <span className="text-base text-gray-500">No sessions scheduled</span>
                  }

                  const getGoogleMapsLink = (location: string) => {
                    const encodedLocation = encodeURIComponent(location)
                    return `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`
                  }

                  // Default location - matches the default in emails/shared.tsx and webhook route
                  const defaultLocation = '3006 Impala Place, Unit B, Henrico, VA 23228'

                  return (
                    <div className="space-y-2">
                      <button
                        onClick={() => setSessionsExpanded(!sessionsExpanded)}
                        className="flex items-center gap-2 text-base font-medium hover:text-primary transition-colors hover:shadow-none "
                      >
                        <Calendar className="h-4 w-4" />
                        <span>
                          {displaySessions.length} {displaySessions.length === 1 ? 'Session' : 'Sessions'}
                        </span>
                        {sessionsExpanded ? (
                          <ChevronUp className="h-4 w-4 ml-auto" />
                        ) : (
                          <ChevronDown className="h-4 w-4 ml-auto" />
                        )}
                      </button>
                      
                      {sessionsExpanded && (
                        <div className="space-y-3 pl-6 border-l-2">
                          {displaySessions.map((session, idx) => {
                            const parseDate = (dateString: string) => {
                              const [year, month, day] = dateString.split('-').map(Number)
                              return new Date(Date.UTC(year, month - 1, day))
                            }
                            
                            const sessionDate = parseDate(session.session_date)
                            const formattedDate = sessionDate.toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              timeZone: 'UTC'
                            })
                            
                            const formatTime = (time: string) => {
                              if (!time || time === '00:00:00') return null
                              const [hours, minutes] = time.split(':')
                              const hour = parseInt(hours, 10)
                              const ampm = hour >= 12 ? 'PM' : 'AM'
                              const displayHour = hour % 12 || 12
                              return `${displayHour}:${minutes} ${ampm}`
                            }
                            
                            const formattedTime = formatTime(session.session_time)
                            const displayLocation = session.location || defaultLocation

                            return (
                              <div key={idx} className="space-y-1">
                                <div className="flex items-center gap-2 text-base">
                                  <span className="font-medium text-muted-foreground">Session {idx + 1}:</span>
                                  <span>
                                    {formattedDate}
                                    {formattedTime && ` at ${formattedTime}`}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground pl-8">
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
                  )
                })()
              ) : (
                <span className="text-base text-gray-500">Loading sessions...</span>
              )}
            </div>
          )}
          
          {/* Admin mode session date display */}
          {props.mode === 'admin' && (
            <div className="flex items-center gap-2 text-base font-medium">
              <Calendar className="h-4 w-4" />
              <span className="text-primary">
                {mounted ? adminFormattedDate : 'Loading date...'}
              </span>
            </div>
          )}

          {/* Enhanced Stock Display */}
          <div className="flex items-center gap-2 text-md">
            <Users className={`h-4 w-4 ${stockStatus.iconClass}`} />
            <span className={stockStatus.textClass}>
              {stockStatus.text}
            </span>
          </div>

          {/* Price Display */}
          <div className="flex items-baseline gap-1">
            <span className={`${props.mode === 'user' ? 'text-2xl' : 'text-lg'} font-bold`}>{props.price}</span>
            {props.mode === 'user' && (
              <span className="text-sm text-muted-foreground">
                {getIntervalText(props.interval, props.intervalCount)}
              </span>
            )}
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
