// contexts/auth-context.tsx
"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { User, Session } from '@supabase/supabase-js'
import { logger } from '@/lib/utils'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null
  })

  const supabase = getSupabaseClient()

  // Initialize auth state
  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        // Get the current session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          logger.error('Error getting session', { error })
          if (mounted) {
            setState(prev => ({ ...prev, error: error.message, loading: false }))
          }
          return
        }

        // If we have a session, validate it
        if (session) {
          const { data: { user }, error: userError } = await supabase.auth.getUser()
          
          if (userError) {
            logger.error('Error validating user', { error: userError })
            // Don't sign out immediately, let the auth state change handle it
          }
        }

        if (mounted) {
          setState({
            user: session?.user ?? null,
            session,
            loading: false,
            error: null
          })
        }
      } catch (error) {
        logger.error('Unexpected error initializing auth', { error })
        if (mounted) {
          setState(prev => ({ 
            ...prev, 
            error: 'Failed to initialize authentication', 
            loading: false 
          }))
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.debug('Auth state changed:', event)
        
        if (mounted) {
          setState(prev => ({
            ...prev,
            user: session?.user ?? null,
            session,
            loading: false,
            error: null
          }))
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        setState(prev => ({ ...prev, loading: false, error: error.message }))
        return { success: false, error: error.message }
      }

      setState(prev => ({ ...prev, loading: false, error: null }))
      return { success: true }
    } catch (error) {
      const errorMessage = 'An unexpected error occurred during sign in'
      setState(prev => ({ ...prev, loading: false, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }

  const signUp = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      
      const { error } = await supabase.auth.signUp({
        email,
        password
      })

      if (error) {
        setState(prev => ({ ...prev, loading: false, error: error.message }))
        return { success: false, error: error.message }
      }

      setState(prev => ({ ...prev, loading: false, error: null }))
      return { success: true }
    } catch (error) {
      const errorMessage = 'An unexpected error occurred during sign up'
      setState(prev => ({ ...prev, loading: false, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }

  const signOut = async (): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      await supabase.auth.signOut()
      setState(prev => ({ ...prev, loading: false, error: null }))
    } catch (error) {
      logger.error('Error signing out', { error })
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Failed to sign out' 
      }))
    }
  }

  const refreshSession = async (): Promise<void> => {
    try {
      const { error } = await supabase.auth.refreshSession()
      if (error) {
        logger.error('Error refreshing session', { error })
        setState(prev => ({ ...prev, error: error.message }))
      }
    } catch (error) {
      logger.error('Unexpected error refreshing session', { error })
      setState(prev => ({ ...prev, error: 'Failed to refresh session' }))
    }
  }

  const value: AuthContextType = {
    ...state,
    signIn,
    signUp,
    signOut,
    refreshSession
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}