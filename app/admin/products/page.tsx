"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Plus, Package } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ProductCard } from '@/components/product-card'

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
        .order('created_at', { ascending: false })

      if (error) throw error
      setProducts(data || [])
    } catch (err) {
      console.error('Error loading products:', err)
      setError('Failed to load products')
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

  const toggleProductStatus = async (product: Product) => {
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .from('products')
        .update({ is_active: !product.is_active })
        .eq('id', product.id)

      if (error) throw error
      await loadProducts()
    } catch (err) {
      console.error('Error updating product status:', err)
      alert('Failed to update product status')
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
    } catch (err) {
      console.error('Error deleting product:', err)
      alert('Failed to delete product')
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading products...</div>
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
          <h1 className="text-3xl font-bold">Product Management</h1>
          <p className="text-muted-foreground">Manage your training sessions and stock levels</p>
        </div>
        <Button className='w-full lg:w-auto' onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Products Grid - Using shared ProductCard */}
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

      {products.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No products yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first training session to get started.
          </p>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {(showCreateForm || editingProduct) && (
        <ProductForm
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
      )}
    </div>
  )
}

// Product Form Component
function ProductForm({ 
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
    price_cents: product?.price_cents || 0,
    session_date: product?.session_date || '',
    stock_quantity: product?.stock_quantity || 0,
    is_active: product?.is_active ?? true
  })
  const [loading, setLoading] = useState(false)

  // Check what specifically has changed
  const getChangedFields = () => {
    if (!product) {
      return {
        nameChanged: true,
        descriptionChanged: true,
        priceChanged: true,
        hasAnyChanges: true
      }
    }

    const nameChanged = formData.name !== product.name
    const descriptionChanged = formData.description !== (product.description || '')
    const priceChanged = formData.price_cents !== product.price_cents
    const hasAnyChanges = nameChanged || descriptionChanged || priceChanged

    return {
      nameChanged,
      descriptionChanged,
      priceChanged,
      hasAnyChanges
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = getSupabaseClient()
      const { hasAnyChanges, nameChanged, descriptionChanged, priceChanged } = getChangedFields()
      
      if (product) {
        // Update existing product
        let stripeData = null
        
        // Only update Stripe if it's not a temp product AND something has changed
        if (product.stripe_product_id && 
            !product.stripe_product_id.startsWith('temp_') && 
            hasAnyChanges) {
          
          const response = await fetch('/api/admin/products', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              productId: product.stripe_product_id,
              priceId: product.stripe_price_id,
              name: formData.name,
              description: formData.description,
              price_cents: formData.price_cents,
              nameChanged,
              descriptionChanged,
              priceChanged,
            }),
          })

          if (!response.ok) {
            throw new Error('Failed to update Stripe product')
          }

          stripeData = await response.json()
        }

        // Update database
        const updateData = {
          ...formData,
          ...(stripeData && {
            stripe_product_id: stripeData.productId,
            stripe_price_id: stripeData.priceId,
          })
        }

        const { error } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', product.id)

        if (error) throw error
      } else {
        // Create new product
        const response = await fetch('/api/admin/products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            price_cents: formData.price_cents,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to create Stripe product')
        }

        const stripeData = await response.json()

        const { error } = await supabase
          .from('products')
          .insert({
            ...formData,
            stripe_product_id: stripeData.productId,
            stripe_price_id: stripeData.priceId,
            currency: 'usd'
          })

        if (error) throw error
      }

      onSuccess()
    } catch (err) {
      console.error('Error saving product:', err)
      alert('Failed to save product. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{product ? 'Edit Product' : 'Create Product'}</CardTitle>
          <CardDescription>
            {product ? 'Update product details' : 'Add a new training session'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Product Name</Label>
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
                value={formData.price_cents}
                onChange={(e) => setFormData({ ...formData, price_cents: parseInt(e.target.value) || 0 })}
                required
              />
              <p className="text-sm text-muted-foreground mt-1">
                Current: ${(formData.price_cents / 100).toFixed(2)}
              </p>
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
              <Label htmlFor="stock_quantity">Stock Quantity</Label>
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
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : (product ? 'Update' : 'Create')}
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
