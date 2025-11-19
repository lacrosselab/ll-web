"use client"

import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAuth } from './auth-context' // Add this import
import { logger } from '@/lib/utils'

// Types
interface CartItem {
  id: string
  productId: string
  athleteId: string
  quantity: number
  product: {
    id: string
    name: string
    description: string | null
    price_cents: number
    session_date: string
    stock_quantity: number
    stripe_product_id: string
    stripe_price_id: string
  }
  athlete: {
    id: string
    name: string
    age?: number
    school?: string
    position?: string
    grade?: string
  }
}

interface CartState {
  items: CartItem[]
  isLoading: boolean
  error: string | null
}

type CartAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ITEMS'; payload: CartItem[] }
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'UPDATE_ITEM'; payload: { productId: string; athleteId: string; quantity: number } }
  | { type: 'REMOVE_ITEM'; payload: { productId: string; athleteId: string } }
  | { type: 'CLEAR_CART' }

// Cart Context
const CartContext = createContext<{
  state: CartState
  addToCart: (productId: string, athleteId: string, quantity?: number) => Promise<{ success: boolean; error?: string }>
  updateCartItem: (productId: string, athleteId: string, quantity: number) => Promise<void>
  removeFromCart: (productId: string, athleteId: string) => Promise<void>
  clearCart: () => Promise<void>
  getTotalItems: () => number
  getTotalPrice: () => number
  refreshCart: () => Promise<void>
  clearBrowserStorage: () => void // Added this to the context type
} | null>(null)

// Cart Reducer
function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'SET_ITEMS':
      return { ...state, items: action.payload, isLoading: false, error: null }
    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.payload] }
    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map(item =>
          item.productId === action.payload.productId && item.athleteId === action.payload.athleteId
            ? { ...item, quantity: action.payload.quantity }
            : item
        )
      }
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(
          item => !(item.productId === action.payload.productId && item.athleteId === action.payload.athleteId)
        )
      }
    case 'CLEAR_CART':
      return { ...state, items: [] }
    default:
      return state
  }
}

// Cart Provider
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    isLoading: false,
    error: null
  })

  // Use the centralized auth context
  const { user, loading: authLoading } = useAuth()

  // Load cart from database (updated to use only user_id)
  const loadCart = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      const supabase = getSupabaseClient()

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        // No user, no cart to load
        dispatch({ type: 'SET_ITEMS', payload: [] })
        return
      }

      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          id,
          product_id,
          athlete_id,
          quantity,
          products (
            id,
            name,
            description,
            price_cents,
            session_date,
            stock_quantity,
            stripe_product_id,
            stripe_price_id
          ),
          athletes (
            id,
            name,
            age,
            school,
            position
          )
        `)
        .eq('user_id', user.id)

      if (error) throw error

      const cartItems: CartItem[] = (data || []).map((item: any) => ({
        id: item.id,
        productId: item.product_id,
        athleteId: item.athlete_id,
        quantity: item.quantity,
        product: item.products,
        athlete: item.athletes
      }))

      dispatch({ type: 'SET_ITEMS', payload: cartItems })
    } catch (error) {
      logger.error('Error loading cart', { error: error instanceof Error ? error.message : 'Unknown error' })
      dispatch({ type: 'SET_ITEMS', payload: [] })
    }
  }

  // Simplified add to cart function - NO TOASTS, returns result
  const addToCart = async (productId: string, athleteId: string, quantity: number = 1): Promise<{ success: boolean; error?: string }> => {
    try {
      const supabase = getSupabaseClient()
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { success: false, error: 'Please log in to add items to cart' }
      }

      // Check if athlete already has this session in cart
      logger.debug('Checking for existing cart item')
      
      const { data: existingCartItem, error: cartError } = await supabase
        .from('cart_items')
        .select('id')
        .eq('user_id', user.id)
        .eq('athlete_id', athleteId)
        .eq('product_id', productId)
        .single()

      if (cartError && cartError.code !== 'PGRST116') {
        logger.error('Failed to check existing cart items', { error: cartError.message || 'Unknown error' })
        return { success: false, error: 'Failed to check cart status' }
      }

      if (existingCartItem) {
        return { success: false, error: 'This athlete already has this session in their cart' }
      }

      // Check if athlete has already purchased this session
      const { data: existingPurchase, error: purchaseError } = await supabase
        .from('payment_athletes')
        .select('id')
        .eq('athlete_id', athleteId)
        .eq('product_id', productId)
        .single()

      if (purchaseError && purchaseError.code !== 'PGRST116') {
        logger.error('Failed to check existing purchases', { error: purchaseError.message || 'Unknown error' })
        return { success: false, error: 'Failed to check purchase history' }
      }

      if (existingPurchase) {
        return { success: false, error: 'This athlete has already purchased this session' }
      }

      // Fetch product details and validate stock
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()

      if (productError) {
        logger.error('Failed to fetch product', { error: productError.message || 'Unknown error' })
        return { success: false, error: 'Failed to load session details' }
      }

      // @ts-ignore - Supabase TypeScript types not properly generated
      if (!product.is_active) {
        return { success: false, error: 'This session is no longer available' }
      }
      // @ts-ignore - Supabase TypeScript types not properly generated
      if (product.stock_quantity <= 0) {
        // @ts-ignore - Supabase TypeScript types not properly generated
        return { success: false, error: `${product.name} is sold out` }
      }

      // Check how many spots this user already has in their cart for this product
      const { data: userCartItems, error: cartError2 } = await supabase
        .from('cart_items')
        .select('quantity')
        .eq('user_id', user.id)
        .eq('product_id', productId)

      if (cartError2) {
        logger.error('Failed to check user cart', { error: cartError2.message || 'Unknown error' })
        return { success: false, error: 'Failed to check cart contents' }
      }

      // Calculate total quantity already in user's cart for this product
      const totalInCart = (userCartItems || []).reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0)
      // @ts-ignore - Supabase TypeScript types not properly generated
      const availableForUser = product.stock_quantity - totalInCart

      // Check if adding this quantity would exceed available stock
      if (quantity > availableForUser) {
        return { 
          success: false, 
          error: 'No spots left for this session' 
        }
      }

      // Add to cart with only user_id (no session_id)
      const { error: insertError } = await supabase
        .from('cart_items')
        // @ts-ignore - Supabase TypeScript types not properly generated
        .insert({
          user_id: user.id,
          product_id: productId,
          athlete_id: athleteId,
          quantity: quantity
        })

      if (insertError) {
        logger.error('Failed to add to cart', { error: insertError.message || 'Unknown error' })
        return { success: false, error: 'Failed to add to cart' }
      }

      // Refresh cart to show new item
      await refreshCart()
      return { success: true }
    } catch (error) {
      logger.error('Unexpected error adding to cart', { error: error instanceof Error ? error.message : 'Unknown error' })
      return { success: false, error: 'An unexpected error occurred' }
    }
  }

  // Update cart item quantity
  const updateCartItem = async (productId: string, athleteId: string, quantity: number) => {
    try {
      if (quantity <= 0) {
        await removeFromCart(productId, athleteId)
        return
      }

      const supabase = getSupabaseClient()

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('cart_items')
        // @ts-ignore - Supabase TypeScript types not properly generated
        .update({ quantity })
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .eq('athlete_id', athleteId)

      if (error) throw error

      dispatch({ type: 'UPDATE_ITEM', payload: { productId, athleteId, quantity } })
    } catch (error) {
      logger.error('Error updating cart item', { error: error instanceof Error ? error.message : 'Unknown error' })
      dispatch({ type: 'SET_ERROR', payload: 'Failed to update cart item' })
    }
  }

  // Remove item from cart
  const removeFromCart = async (productId: string, athleteId: string) => {
    try {
      const supabase = getSupabaseClient()

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .eq('athlete_id', athleteId)

      if (error) throw error

      dispatch({ type: 'REMOVE_ITEM', payload: { productId, athleteId } })
    } catch (error) {
      logger.error('Error removing from cart', { error: error instanceof Error ? error.message : 'Unknown error' })
      dispatch({ type: 'SET_ERROR', payload: 'Failed to remove item from cart' })
    }
  }

  // Clear entire cart
  const clearCart = async () => {
    try {
      const response = await fetch('/api/cart/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to clear cart' }))
        throw new Error(errorData.error || 'Failed to clear cart')
      }

      dispatch({ type: 'CLEAR_CART' })
    } catch (error) {
      logger.error('Error clearing cart', { error: error instanceof Error ? error.message : 'Unknown error' })
      dispatch({ type: 'SET_ERROR', payload: 'Failed to clear cart' })
    }
  }

  // Get total number of items in cart
  const getTotalItems = (): number => {
    return state.items.reduce((total, item) => total + item.quantity, 0)
  }

  // Get total price of cart
  const getTotalPrice = (): number => {
    return state.items.reduce((total, item) => total + (item.product.price_cents * item.quantity), 0)
  }

  // Refresh cart from database
  const refreshCart = async () => {
    await loadCart()
  }

  // Add this function to clear browser storage when needed
  const clearBrowserStorage = () => {
    if (typeof window !== 'undefined') {
      // Clear Supabase auth tokens
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.includes('supabase') || key.includes('sb-')) {
          localStorage.removeItem(key)
        }
      })
      
      // Clear session storage
      sessionStorage.clear()
    }
  }

  // Auth-driven cart loading - now uses centralized auth
  useEffect(() => {
    // Only load cart when auth is not loading and user is available
    if (!authLoading && user) {
      loadCart()
    } else if (!authLoading && !user) {
      // Clear cart when no user
      dispatch({ type: 'SET_ITEMS', payload: [] })
      dispatch({ type: 'SET_ERROR', payload: null })
    }
  }, [user, authLoading]) // Depend on auth state instead of managing own auth

  const value = {
    state,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    getTotalItems,
    getTotalPrice,
    refreshCart,
    clearBrowserStorage // Add this
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// Cart Hook
export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}

// Check if athlete has already purchased this session
const hasAthletePurchasedSession = async (athleteId: string, productId: string): Promise<boolean> => {
  try {
    logger.debug('Checking purchase history')
    
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('payment_athletes')
      .select('id')
      .eq('athlete_id', athleteId)
      .eq('product_id', productId)
      .single()

    if (error && error.code !== 'PGRST116') {
      logger.error('Error checking purchase history', { error: error.message || 'Unknown error' })
      return false // Assume not purchased if we can't check
    }

    const hasPurchased = !!data
    logger.debug('Purchase check result:', hasPurchased)
    return hasPurchased
  } catch (error) {
    logger.error('Exception checking purchase history', { error: error instanceof Error ? error.message : 'Unknown error' })
    return false // Assume not purchased if there's an exception
  }
}


