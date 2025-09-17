"use client"

import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'

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
  addToCart: (productId: string, athleteId: string, quantity?: number) => Promise<void>
  updateCartItem: (productId: string, athleteId: string, quantity: number) => Promise<void>
  removeFromCart: (productId: string, athleteId: string) => Promise<void>
  clearCart: () => Promise<void>
  getTotalItems: () => number
  getTotalPrice: () => number
  refreshCart: () => Promise<void>
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

  // Get or create session ID
  const getSessionId = (): string => {
    if (typeof window === 'undefined') return ''
    
    let sessionId = localStorage.getItem('cart_session_id')
    if (!sessionId) {
      sessionId = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('cart_session_id', sessionId)
    }
    return sessionId
  }

  // Load cart from database
  const loadCart = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      const supabase = getSupabaseClient()
      const sessionId = getSessionId()

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()

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
        .eq('session_id', sessionId)
        .eq('user_id', user?.id || null)

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
      console.error('Error loading cart:', error)
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load cart' })
    }
  }

  // Add item to cart with comprehensive validation
  const addToCart = async (productId: string, athleteId: string, quantity: number = 1) => {
    try {
      console.log('🛒 [CART] Starting addToCart with:', { productId, athleteId, quantity })
      
      dispatch({ type: 'SET_LOADING', payload: true })
      const supabase = getSupabaseClient()
      const sessionId = getSessionId()
      
      console.log(' [CART] Session ID:', sessionId)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      console.log('🛒 [CART] Current user:', user ? { id: user.id, email: user.email } : 'No user (guest)')

      // VALIDATION 1: Check if athlete has already purchased this session
      console.log('�� [CART] VALIDATION 1: Checking if athlete already purchased this session...')
      const alreadyPurchased = await hasAthletePurchasedSession(athleteId, productId)
      console.log('🛒 [CART] Already purchased check result:', alreadyPurchased)
      
      if (alreadyPurchased) {
        console.log('🛒 [CART] ❌ BLOCKED: Athlete already purchased this session')
        throw new Error('This athlete has already purchased this session')
      }

      // VALIDATION 2: Check if athlete already has this session in cart (check database directly)
      console.log('�� [CART] VALIDATION 2: Checking if athlete already has this session in cart...')
      console.log('🛒 [CART] Querying cart_items with:', { sessionId, productId, athleteId })
      
      const { data: existingCartItem, error: existingCartError } = await supabase
        .from('cart_items')
        .select('id')
        .eq('session_id', sessionId)
        .eq('product_id', productId)
        .eq('athlete_id', athleteId)
        .single()

      console.log('🛒 [CART] Existing cart item query result:', { 
        data: existingCartItem, 
        error: existingCartError,
        errorCode: existingCartError?.code 
      })

      if (existingCartItem) {
        console.log('🛒 [CART] ❌ BLOCKED: Athlete already has this session in cart')
        throw new Error('This athlete already has this session in their cart')
      }

      if (existingCartError && existingCartError.code !== 'PGRST116') {
        console.log(' [CART] ❌ ERROR: Unexpected error checking existing cart item:', existingCartError)
        throw existingCartError
      }

      console.log('🛒 [CART] ✅ VALIDATION 2 PASSED: No existing cart item found')

      // VALIDATION 3: Check product stock availability
      console.log('�� [CART] VALIDATION 3: Checking product stock availability...')
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('stock_quantity, name, is_active')
        .eq('id', productId)
        .single()

      console.log('🛒 [CART] Product query result:', { 
        product, 
        error: productError 
      })

      if (productError) {
        console.log('🛒 [CART] ❌ ERROR: Failed to fetch product:', productError)
        throw productError
      }

      if (!product.is_active) {
        console.log('🛒 [CART] ❌ BLOCKED: Product is not active')
        throw new Error('This session is no longer available')
      }

      // VALIDATION 4: Check if there's any stock available
      if (product.stock_quantity <= 0) {
        console.log(' [CART] ❌ BLOCKED: No stock available')
        throw new Error(`${product.name} is sold out`)
      }

      console.log('🛒 [CART] ✅ VALIDATION 3 & 4 PASSED: Product is active and has stock')

      // For training sessions, quantity is always 1
      const sessionQuantity = 1
      console.log('🛒 [CART] Using session quantity:', sessionQuantity)

      // Add new item
      console.log('🛒 [CART] Attempting to insert cart item with:', {
        session_id: sessionId,
        user_id: user?.id || null,
        product_id: productId,
        athlete_id: athleteId,
        quantity: sessionQuantity
      })

      const { data, error } = await supabase
        .from('cart_items')
        .insert({
          session_id: sessionId,
          user_id: user?.id || null,
          product_id: productId,
          athlete_id: athleteId,
          quantity: sessionQuantity
        })
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
        .single()

      console.log('🛒 [CART] Insert result:', { data, error, errorCode: error?.code })

      if (error) {
        console.log('🛒 [CART] ❌ ERROR: Failed to insert cart item:', error)
        throw error
      }

      const cartItem: CartItem = {
        id: data.id,
        productId: data.product_id,
        athleteId: data.athlete_id,
        quantity: data.quantity,
        product: data.products,
        athlete: data.athletes
      }

      console.log('🛒 [CART] ✅ SUCCESS: Created cart item:', cartItem)
      dispatch({ type: 'ADD_ITEM', payload: cartItem })
      
    } catch (error) {
      console.error('🛒 [CART] ❌ FINAL ERROR in addToCart:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to add item to cart'
      dispatch({ type: 'SET_ERROR', payload: errorMessage })
      throw error // Re-throw so calling components can handle it
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
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
      const sessionId = getSessionId()

      const { error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('session_id', sessionId)
        .eq('product_id', productId)
        .eq('athlete_id', athleteId)

      if (error) throw error

      dispatch({ type: 'UPDATE_ITEM', payload: { productId, athleteId, quantity } })
    } catch (error) {
      console.error('Error updating cart item:', error)
      dispatch({ type: 'SET_ERROR', payload: 'Failed to update cart item' })
    }
  }

  // Remove item from cart
  const removeFromCart = async (productId: string, athleteId: string) => {
    try {
      const supabase = getSupabaseClient()
      const sessionId = getSessionId()

      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('session_id', sessionId)
        .eq('product_id', productId)
        .eq('athlete_id', athleteId)

      if (error) throw error

      dispatch({ type: 'REMOVE_ITEM', payload: { productId, athleteId } })
    } catch (error) {
      console.error('Error removing from cart:', error)
      dispatch({ type: 'SET_ERROR', payload: 'Failed to remove item from cart' })
    }
  }

  // Clear entire cart
  const clearCart = async () => {
    try {
      const supabase = getSupabaseClient()
      const sessionId = getSessionId()

      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('session_id', sessionId)

      if (error) throw error

      dispatch({ type: 'CLEAR_CART' })
    } catch (error) {
      console.error('Error clearing cart:', error)
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

  // Load cart on mount
  useEffect(() => {
    loadCart()
  }, [])

  const value = {
    state,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    getTotalItems,
    getTotalPrice,
    refreshCart
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
    console.log(' [CART] Checking purchase history for:', { athleteId, productId })
    
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('payment_athletes')
      .select('id')
      .eq('athlete_id', athleteId)
      .eq('product_id', productId)
      .single()

    console.log('🛒 [CART] Purchase history query result:', { 
      data, 
      error, 
      errorCode: error?.code 
    })

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.log('🛒 [CART] ❌ ERROR checking purchase history:', error)
      throw error
    }

    const hasPurchased = !!data
    console.log('🛒 [CART] Has athlete purchased this session?', hasPurchased)
    return hasPurchased
  } catch (error) {
    console.error('🛒 [CART] ❌ ERROR in hasAthletePurchasedSession:', error)
    return false // Default to allowing purchase if check fails
  }
}


