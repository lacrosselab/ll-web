"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Plus, Calendar } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ProductCard } from '@/components/product-card'
import { useToast } from '@/components/ui/toast'
import { stripe } from '@/lib/stripe'
import { formatDateOnly } from '@/lib/utils'

interface Product {
  id: string
  name: string
  description: string | null
  price_cents: number
  currency: string
  session_date: string
  end_date?: string
  stock_quantity: number
  is_active: boolean
  is_high_school?: boolean | null
  stripe_product_id: string
  stripe_price_id: string
  created_at: string
  updated_at: string
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
        .select('*')
        .order('session_date', { ascending: true })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error loading products:', error)
      showToast('Failed to load sessions', 'error')
    } finally {
      setLoading(false)
    }
  }

  const toggleProductStatus = async (product: Product) => {
    try {
      const supabase = getSupabaseClient()
      
      // Update both database and Stripe to keep them in sync
      const newActiveStatus = !product.is_active
      
      // Update database first - use any to bypass TypeScript issues
      // @ts-ignore - Supabase TypeScript types not properly generated
      const { error: dbError } = await supabase
        .from('products')
        // @ts-ignore - Supabase TypeScript types not properly generated
        .update({ is_active: newActiveStatus })
        .eq('id', product.id)

      if (dbError) throw dbError

      // Update Stripe product to match database status
      try {
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
          console.error('Stripe update failed:', errorData)
          // Revert database change if Stripe update fails
          // @ts-ignore - Supabase TypeScript types not properly generated
          await supabase
            .from('products')
            // @ts-ignore - Supabase TypeScript types not properly generated
            .update({ is_active: product.is_active })
            .eq('id', product.id)
          throw new Error('Failed to sync with Stripe')
        }
      } catch (stripeError) {
        console.error('Error updating Stripe product:', stripeError)
        // Revert database change if Stripe update fails
        // @ts-ignore - Supabase TypeScript types not properly generated
        await supabase
          .from('products')
          // @ts-ignore - Supabase TypeScript types not properly generated
          .update({ is_active: product.is_active })
          .eq('id', product.id)
        throw new Error('Failed to sync with Stripe')
      }

      await loadProducts()
      showToast(`Session ${newActiveStatus ? 'activated' : 'deactivated'} successfully`, 'success')
    } catch (err) {
      console.error('Error updating product status:', err)
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
          console.error('Stripe deletion failed, but database deletion succeeded')
        }
      } catch (stripeError) {
        console.error('Error deleting from Stripe:', stripeError)
      }

      await loadProducts()
      showToast('Session deleted successfully', 'success')
    } catch (err) {
      console.error('Error deleting product:', err)
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
                    {product.is_high_school !== null && (
                      <Badge variant={product.is_high_school ? 'default' : 'secondary'}>
                        {product.is_high_school ? 'High School' : 'Middle School'}
                      </Badge>
                    )}
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
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product ? (product.price_cents / 100).toString() : '',
    session_date: product?.session_date || '',
    end_date: product?.end_date || '',
    stock_quantity: product?.stock_quantity?.toString() || '10',
    is_active: product?.is_active ?? true,
    is_high_school: product?.is_high_school ?? null,
  })
  const { showToast } = useToast()

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
      if (!formData.session_date) {
        showToast('Session date is required', 'error')
        setLoading(false)
        return
      }
      if (!formData.stock_quantity || isNaN(parseInt(formData.stock_quantity)) || parseInt(formData.stock_quantity) < 0) {
        showToast('Valid stock quantity is required (must be 0 or greater)', 'error')
        setLoading(false)
        return
      }
      
      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price_cents: Math.round(parseFloat(formData.price) * 100),
        currency: 'usd',
        session_date: formData.session_date,
        end_date: formData.end_date || null,
        stock_quantity: parseInt(formData.stock_quantity),
        is_active: formData.is_active,
        is_high_school: formData.is_high_school,
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
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            console.error('Stripe update failed:', errorData)
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
          console.error('Error updating Stripe product:', stripeError)
          showToast('Session updated in database, but Stripe sync failed', 'error')
        }
      } else {
        // Create new product
        const response = await fetch('/api/admin/products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(productData),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to create session')
        }

        showToast('Session created successfully', 'success')
      }

      onSuccess()
    } catch (error) {
      console.error('Error saving product:', error)
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
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div>
              <Label htmlFor="session_date">Session Date *</Label>
              <Input
                id="session_date"
                type="date"
                value={formData.session_date}
                onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="end_date">End Date (Optional)</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active (visible to customers)</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="school_level">School Level (Optional)</Label>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="high_school"
                    name="school_level"
                    value="true"
                    checked={formData.is_high_school === true}
                    onChange={() => setFormData({ ...formData, is_high_school: true })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="high_school">High School</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="middle_school"
                    name="school_level"
                    value="false"
                    checked={formData.is_high_school === false}
                    onChange={() => setFormData({ ...formData, is_high_school: false })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="middle_school">Middle School</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="not_specified"
                    name="school_level"
                    value="null"
                    checked={formData.is_high_school === null}
                    onChange={() => setFormData({ ...formData, is_high_school: null })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="not_specified">Not Specified</Label>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
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
