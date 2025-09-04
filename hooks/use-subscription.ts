"use client"

import { useState, useEffect } from "react"
import type { User } from "@supabase/supabase-js"

interface Subscription {
  id: string
  status: string
  price_id: string
  current_period_end: string
}

export function useSubscription(user: User | null) {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simply return mock data immediately without any async operations
    if (!user) {
      setSubscription(null)
      setLoading(false)
      return
    }

    // Mock active subscription - no database calls
    setSubscription({
      id: "mock_subscription",
      status: "active",
      price_id: "price_monthly",
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    setLoading(false)
  }, [user])

  const hasActiveSubscription = subscription?.status === "active"

  return {
    subscription,
    hasActiveSubscription,
    loading,
  }
}
