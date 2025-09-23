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

interface Product {
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

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
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
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?redirect=/admin/products')
        return
      }

      // Check if user is admin
      if (!user.email?.endsWith('@thelacrosselab.com')) {
        router.push('/')
        return
      }

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('session_date', { ascending: true })

      if (error) throw error
      setProducts(data || [])
    } catch (err) {
      console.error('Error loading products:', err)
      setError('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const toggleProductStatus = async (product: Product) => {
    try {
      const supabase = getSupabaseClient()
      
      // Update both database and Stripe to keep them in sync
      const newActiveStatus = !product.is_active
      
      // Update database first
      const { error: dbError } = await supabase
        .from('products')
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
          await supabase
            .from('products')
            .update({ is_active: product.is_active })
            .eq('id', product.id)
          throw new Error('Failed to sync with Stripe')
        }
      } catch (stripeError) {
        console.error('Error updating Stripe product:', stripeError)
        // Revert database change if Stripe update fails
        await supabase
          .from('products')
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
      
      // Delete from Stripe first (archive the product) - only if it's not a temp product
      if (product.stripe_product_id && !product.stripe_product_id.startsWith('temp_')) {
        const response = await fetch(`/api/admin/products?productId=${product.stripe_product_id}`, {
          method: 'DELETE',
        })
        
        if (!response.ok) {
          throw new Error('Failed to delete from Stripe')
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id)

      if (error) throw error
      await loadProducts()
      showToast('Session deleted successfully', 'success')
    } catch (err) {
      console.error('Error deleting product:', err)
      showToast('Failed to delete session', 'error')
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading sessions...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-500">{error}</div>
        <Button onClick={loadProducts} className="mt-4">Try Again</Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-4 xl:gap-0 justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Session Management</h1>
          <p className="text-muted-foreground">Manage your training sessions and availability</p>
        </div>
        <Button className='w-full lg:w-auto' onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Session
        </Button>
      </div>

      {/* Sessions Grid - Using shared ProductCard */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            mode="admin"
            title={product.name}
            description={product.description}
            price={formatPrice(product.price_cents)}
            sessionDate={product.session_date}
            stockQuantity={product.stock_quantity}
            product={product}
            onEdit={setEditingProduct}
            onToggleStatus={toggleProductStatus}
            onDelete={deleteProduct}
          />
        ))}
      </div>

      {/* Create/Edit Session Form */}
      {(showCreateForm || editingProduct) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>
                {editingProduct ? 'Edit Session' : 'Create New Session'}
              </CardTitle>
              <CardDescription>
                {editingProduct ? 'Update session details' : 'Add a new training session'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SessionForm
                product={editingProduct}
                onClose={() => {
                  setShowCreateForm(false)
                  setEditingProduct(null)
                }}
                onSuccess={() => {
                  setShowCreateForm(false)
                  setEditingProduct(null)
                  loadProducts()
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// Helper function to format price
function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
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
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price_cents ? (product.price_cents / 100).toString() : '',
    session_date: product?.session_date || '',
    stock_quantity: product?.stock_quantity || 10,
    is_active: product?.is_active ?? true,
    stripe_product_id: product?.stripe_product_id || '',
    stripe_price_id: product?.stripe_price_id || '',
  })
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast() // Add this line

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = getSupabaseClient() // Add this line
      
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
        stock_quantity: parseInt(formData.stock_quantity),
        is_active: formData.is_active,
        // Remove these fields from the update - they shouldn't be changed
        // stripe_product_id: formData.stripe_product_id.trim() || null,
        // stripe_price_id: formData.stripe_price_id.trim() || null
      }

      if (product) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id)
        if (error) throw error

        // Check what changed and sync to Stripe
        const nameChanged = product.name !== formData.name.trim()
        const descriptionChanged = product.description !== (formData.description.trim() || null)
        const priceChanged = product.price_cents !== Math.round(parseFloat(formData.price) * 100)

        // Only call Stripe API if something changed and we have Stripe IDs
        if ((nameChanged || descriptionChanged || priceChanged) && 
            product.stripe_product_id && product.stripe_price_id) {
          
          try {
            const stripeResponse = await fetch('/api/admin/products', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                productId: product.stripe_product_id,  // Use existing Stripe IDs
                priceId: product.stripe_price_id,      // Use existing Stripe IDs
                name: productData.name,
                description: productData.description,
                price_cents: productData.price_cents,
                currency: productData.currency,
                nameChanged,
                descriptionChanged,
                priceChanged
              })
            })

            if (!stripeResponse.ok) {
              const errorData = await stripeResponse.json()
              console.error('Stripe update failed:', errorData)
              showToast('Session updated in database, but Stripe sync failed', 'error')
            } else {
              const stripeData = await stripeResponse.json()
              // Update database with new price ID if price changed
              if (priceChanged && stripeData.priceId !== product.stripe_price_id) {
                await supabase
                  .from('products')
                  .update({ stripe_price_id: stripeData.priceId })
                  .eq('id', product.id)
              }
              showToast('Session updated successfully!', 'success')
            }
          } catch (stripeError) {
            console.error('Stripe sync error:', stripeError)
            showToast('Session updated in database, but Stripe sync failed', 'error')
          }
        } else {
          showToast('Session updated successfully!', 'success')
        }
      } else {
        // Create new product via API
        try {
          const response = await fetch('/api/admin/products', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(productData)
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to create product')
          }

          showToast('Session created successfully!', 'success')
        } catch (error) {
          console.error('Failed to create session:', error)
          showToast(`Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
        }
      }

      onSuccess()
    } catch (err) {
      console.error('Error saving session:', err)
      showToast('Failed to save session', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Session Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="price">Price (in cents)</Label>
        <Input
          id="price"
          type="number"
          value={formData.price}
          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
          required
        />
      </div>

      <div>
        <Label htmlFor="session_date">Session Date</Label>
        <Input
          id="session_date"
          type="date"
          value={formData.session_date}
          onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
          required
        />
      </div>

      <div>
        <Label htmlFor="stock_quantity">Available Spots</Label>
        <Input
          id="stock_quantity"
          type="number"
          value={formData.stock_quantity}
          onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })}
          required
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
        />
        <Label htmlFor="is_active">Active</Label>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? 'Saving...' : (product ? 'Update Session' : 'Create Session')}
        </Button>
      </div>
    </form>
  )
}
