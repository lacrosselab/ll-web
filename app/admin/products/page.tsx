"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Plus, Calendar, X, Trash2 } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ProductCard } from '@/components/product-card'
import { useToast } from '@/components/ui/toast'
import { stripe } from '@/lib/stripe'
import { formatDateOnly, logger } from '@/lib/utils'

interface ProductSession {
  id?: string
  session_date: string
  session_time: string
  location?: string | null
}

interface Product {
  id: string
  name: string
  description: string | null
  price_cents: number
  currency: string
  session_date: string
  stock_quantity: number
  is_active: boolean
  gender?: string | null
  min_grade?: string | null
  max_grade?: string | null
  skill_level?: string | null
  stripe_product_id: string
  stripe_price_id: string
  created_at: string
  updated_at: string
  product_sessions?: ProductSession[]
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      setLoading(true)
      const supabase = getSupabaseClient()
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_sessions (
            id,
            session_date,
            session_time,
            location
          )
        `)
        .order('session_date', { ascending: true })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      logger.error('Error loading products', { error })
      showToast('Failed to load sessions', 'error')
    } finally {
      setLoading(false)
    }
  }

  const toggleProductStatus = async (product: Product) => {
    try {
      // Use atomic endpoint that updates both DB and Stripe
      const newActiveStatus = !product.is_active
      
      const response = await fetch('/api/admin/products/toggle-stripe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: product.stripe_product_id,
          isActive: newActiveStatus
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        logger.error('Stripe update failed', { errorData })
        throw new Error(errorData.error || 'Failed to sync with Stripe')
      }

      await loadProducts()
      showToast(`Session ${newActiveStatus ? 'activated' : 'deactivated'} successfully`, 'success')
    } catch (err) {
      logger.error('Error updating product status', { error: err })
      showToast(err instanceof Error ? err.message : 'Failed to update session status', 'error')
    }
  }

  const deleteProduct = async (product: Product) => {
    if (!confirm(`Are you sure you want to delete "${product.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      const supabase = getSupabaseClient()
      
      // Delete from database
      const { error: dbError } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id)

      if (dbError) throw dbError

      // Archive in Stripe (don't delete to preserve history)
      try {
        const response = await fetch('/api/admin/products', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ productId: product.stripe_product_id }),
        })

        if (!response.ok) {
          logger.error('Stripe deletion failed, but database deletion succeeded')
        }
      } catch (stripeError) {
        logger.error('Error deleting from Stripe', { error: stripeError })
      }

      await loadProducts()
      showToast('Session deleted successfully', 'success')
    } catch (err) {
      logger.error('Error deleting product', { error: err })
      showToast(err instanceof Error ? err.message : 'Failed to delete session', 'error')
    }
  }

  const editProduct = (product: Product) => {
    setEditingProduct(product)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingProduct(null)
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Session Management</h1>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-4 lg:items-center md:justify-between mb-8">
        <h1 className="text-3xl font-bold">Session Management</h1>
        <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add New Session
        </Button>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-xl mb-2">No Sessions Found</CardTitle>
            <CardDescription className="text-center mb-4">
              Get started by creating your first training session.
            </CardDescription>
            <Button onClick={() => setShowForm(true)}>
              Create Your First Session
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex flex-col lg:flex-row  gap-4 items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{product.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {product.description || 'No description provided'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={product.is_active ? 'default' : 'secondary'}>
                      {product.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline">
                      Stock: {product.stock_quantity}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Price</Label>
                    <p className="text-lg font-semibold">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: product.currency.toUpperCase(),
                      }).format(product.price_cents / 100)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Session Date</Label>
                    <p className="text-lg font-semibold">
                      {formatDateOnly(product.session_date)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={product.is_active}
                        onCheckedChange={() => toggleProductStatus(product)}
                      />
                      <span className="text-sm">
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => editProduct(product)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteProduct(product)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <SessionForm
          product={editingProduct}
          onClose={closeForm}
          onSuccess={() => {
            closeForm()
            loadProducts()
          }}
        />
      )}
    </div>
  )
}

// Session Form Component
function SessionForm({ 
  product, 
  onClose, 
  onSuccess 
}: { 
  product: Product | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [sessions, setSessions] = useState<ProductSession[]>(() => {
    if (product?.product_sessions && product.product_sessions.length > 0) {
      return product.product_sessions.map(s => ({
        id: s.id,
        session_date: s.session_date,
        session_time: s.session_time || '00:00:00',
        location: s.location || ''
      }))
    } else if (product?.session_date) {
      return [{
        session_date: product.session_date,
        session_time: '00:00:00',
        location: ''
      }]
    }
    return [{ session_date: '', session_time: '00:00:00', location: '' }]
  })
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product ? (product.price_cents / 100).toString() : '',
    session_date: product?.session_date || '',
    stock_quantity: product?.stock_quantity?.toString() || '10',
    is_active: product?.is_active ?? true,
    gender: product?.gender || '',
    min_grade: product?.min_grade || '',
    max_grade: product?.max_grade || '',
    skill_level: product?.skill_level || '',
  })
  const { showToast } = useToast()

  const addSession = () => {
    setSessions([...sessions, { session_date: '', session_time: '00:00:00', location: '' }])
  }

  const removeSession = (index: number) => {
    setSessions(sessions.filter((_, i) => i !== index))
  }

  const updateSession = (index: number, field: 'session_date' | 'session_time' | 'location', value: string) => {
    const updated = [...sessions]
    updated[index] = { ...updated[index], [field]: value }
    setSessions(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = getSupabaseClient()
      
      // Validate required fields
      if (!formData.name.trim()) {
        showToast('Session name is required', 'error')
        setLoading(false)
        return
      }
      if (!formData.price || isNaN(parseFloat(formData.price))) {
        showToast('Valid price is required', 'error')
        setLoading(false)
        return
      }
      // Validate sessions
      if (sessions.length === 0) {
        showToast('At least one session date and time is required', 'error')
        setLoading(false)
        return
      }
      for (let i = 0; i < sessions.length; i++) {
        if (!sessions[i].session_date) {
          showToast(`Session ${i + 1} date is required`, 'error')
          setLoading(false)
          return
        }
      }
      if (!formData.stock_quantity || isNaN(parseInt(formData.stock_quantity)) || parseInt(formData.stock_quantity) < 0) {
        showToast('Valid stock quantity is required (must be 0 or greater)', 'error')
        setLoading(false)
        return
      }
      
      // Use first session date for backward compatibility
      const firstSession = sessions[0]
      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price_cents: Math.round(parseFloat(formData.price) * 100),
        currency: 'usd',
        session_date: firstSession.session_date,
        stock_quantity: parseInt(formData.stock_quantity),
        is_active: formData.is_active,
        gender: formData.gender || null,
        min_grade: formData.min_grade || null,
        max_grade: formData.max_grade || null,
        skill_level: formData.skill_level || null,
      }

      if (product) {
        // Update existing product
        // @ts-ignore - Supabase TypeScript types not properly generated
        const { error } = await supabase
          .from('products')
          // @ts-ignore - Supabase TypeScript types not properly generated
          .update(productData)
          .eq('id', product.id)
        if (error) throw error

        // Update Stripe product
        try {
          const response = await fetch('/api/admin/products', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              productId: product.stripe_product_id,
              priceId: product.stripe_price_id,
              name: productData.name,
              description: productData.description,
              price_cents: productData.price_cents,
              currency: productData.currency,
              nameChanged: product.name !== productData.name,
              descriptionChanged: product.description !== productData.description,
              priceChanged: product.price_cents !== productData.price_cents,
              gender: productData.gender,
              min_grade: productData.min_grade,
              max_grade: productData.max_grade,
              skill_level: productData.skill_level,
              sessions: sessions,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            logger.error('Stripe update failed', { errorData })
            showToast('Session updated in database, but Stripe sync failed', 'error')
          } else {
            const stripeData = await response.json()
            // Update database with new price ID if price changed
            await supabase
              .from('products')
              // @ts-ignore - Supabase TypeScript types not properly generated
              .update({ stripe_price_id: stripeData.priceId })
              .eq('id', product.id)
            showToast('Session updated successfully', 'success')
          }
        } catch (stripeError) {
          logger.error('Error updating Stripe product', { error: stripeError })
          showToast('Session updated in database, but Stripe sync failed', 'error')
        }
      } else {
        // Create new product
        const response = await fetch('/api/admin/products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...productData,
            sessions: sessions,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to create session')
        }

        showToast('Session created successfully', 'success')
      }

      onSuccess()
    } catch (error) {
      logger.error('Error saving product', { error })
      showToast(error instanceof Error ? error.message : 'Failed to save session', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>{product ? 'Edit Session' : 'Create New Session'}</CardTitle>
          <CardDescription>
            {product ? 'Update the session details below.' : 'Fill in the details to create a new training session.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Core Information Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-3 text-foreground">Core Information</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Session Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Advanced Shooting Clinic"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description of the session"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="price">Price (USD) *</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="stock_quantity">Stock Quantity *</Label>
                      <Input
                        id="stock_quantity"
                        type="number"
                        min="0"
                        value={formData.stock_quantity}
                        onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                        placeholder="10"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Session Times Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-3 text-foreground">Session Times</h3>
                <div className="space-y-4">
                  {sessions.map((session, index) => (
                    <div key={index} className="space-y-2 p-4 border rounded-lg">
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label htmlFor={`session_date_${index}`} className="text-xs text-muted-foreground">Date</Label>
                          <Input
                            id={`session_date_${index}`}
                            type="date"
                            value={session.session_date}
                            onChange={(e) => updateSession(index, 'session_date', e.target.value)}
                            required
                          />
                        </div>
                        <div className="flex-1">
                          <Label htmlFor={`session_time_${index}`} className="text-xs text-muted-foreground">Time</Label>
                          <Input
                            id={`session_time_${index}`}
                            type="time"
                            value={session.session_time}
                            onChange={(e) => updateSession(index, 'session_time', e.target.value)}
                            required
                          />
                        </div>
                        {sessions.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeSession(index)}
                            className="mb-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div>
                        <Label htmlFor={`session_location_${index}`} className="text-xs text-muted-foreground">Location (optional)</Label>
                        <Input
                          id={`session_location_${index}`}
                          type="text"
                          value={session.location || ''}
                          onChange={(e) => updateSession(index, 'location', e.target.value)}
                          placeholder="e.g., 3006 Impala Place, Unit B, Henrico, VA 23228"
                        />
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addSession}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Session
                  </Button>
                </div>
              </div>
            </div>

            {/* Target Audience Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-3 text-foreground">Target Audience</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="gender">Gender</Label>
                      <select
                        id="gender"
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select gender (optional)</option>
                        <option value="boys">Boys</option>
                        <option value="girls">Girls</option>
                        <option value="co-ed">Co-ed</option>
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="skill_level">Skill Level</Label>
                      <select
                        id="skill_level"
                        value={formData.skill_level}
                        onChange={(e) => setFormData({ ...formData, skill_level: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select skill level (optional)</option>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="min_grade">Minimum Grade</Label>
                      <select
                        id="min_grade"
                        value={formData.min_grade}
                        onChange={(e) => setFormData({ ...formData, min_grade: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select min grade (optional)</option>
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

                    <div>
                      <Label htmlFor="max_grade">Maximum Grade</Label>
                      <select
                        id="max_grade"
                        value={formData.max_grade}
                        onChange={(e) => setFormData({ ...formData, max_grade: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select max grade (optional)</option>
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
                  </div>
                </div>
              </div>
            </div>

            {/* Status Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-3 text-foreground">Status</h3>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Active (visible to customers)</Label>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : (product ? 'Update Session' : 'Create Session')}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
