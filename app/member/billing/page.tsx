"use client"

import { MemberNavigation } from "@/components/member-navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useSubscription } from "@/hooks/use-subscription"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { CreditCard, Calendar, DollarSign, AlertCircle, CheckCircle } from "lucide-react"
import Link from "next/link"

export default function MemberBilling() {
  const [user, setUser] = useState<User | null>(null)
  const { subscription, hasActiveSubscription, loading } = useSubscription(user)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    const supabase = getSupabaseClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => authSubscription.unsubscribe()
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const mockPaymentHistory = [
    {
      id: "inv_001",
      date: "2024-01-15",
      amount: "$9.99",
      status: "paid",
      description: "Monthly subscription",
    },
    {
      id: "inv_002",
      date: "2023-12-15",
      amount: "$9.99",
      status: "paid",
      description: "Monthly subscription",
    },
    {
      id: "inv_003",
      date: "2023-11-15",
      amount: "$9.99",
      status: "paid",
      description: "Monthly subscription",
    },
  ]

  const handleUpdatePaymentMethod = async () => {
    if (!subscription?.stripe_subscription_id) return

    setIsUpdating(true)
    try {
      const response = await fetch("/api/manage-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_payment_method",
          subscriptionId: subscription.stripe_subscription_id,
        }),
      })

      const data = await response.json()

      if (data.success && data.url) {
        // Redirect to Stripe billing portal
        window.location.href = data.url
      } else {
        alert("Failed to update payment method. Please try again.")
      }
    } catch (error) {
      console.error("Error updating payment method:", error)
      alert("Failed to update payment method. Please try again.")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (!subscription?.stripe_subscription_id) return

    const confirmed = confirm(
      "Are you sure you want to cancel your subscription? You will continue to have access until the end of your current billing period.",
    )

    if (!confirmed) return

    setIsUpdating(true)
    try {
      const response = await fetch("/api/manage-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          subscriptionId: subscription.stripe_subscription_id,
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert(data.message)
        // Refresh the page to show updated subscription status
        window.location.reload()
      } else {
        alert("Failed to cancel subscription. Please try again.")
      }
    } catch (error) {
      console.error("Error canceling subscription:", error)
      alert("Failed to cancel subscription. Please try again.")
    } finally {
      setIsUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MemberNavigation />
        <div className="py-8 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto">
            <div className="flex items-center justify-center h-64">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <MemberNavigation />

      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Billing & Subscription</h1>
            <p className="text-muted-foreground">Manage your subscription and view payment history.</p>
          </div>

          {/* Current Subscription */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Current Subscription
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasActiveSubscription ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">Premium Plan</h3>
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">Full access to all premium features</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">$9.99</div>
                      <div className="text-sm text-muted-foreground">per month</div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Next billing date</p>
                        <p className="text-sm text-muted-foreground">{formatDate(subscription!.current_period_end)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Payment method</p>
                        <p className="text-sm text-muted-foreground">•••• •••• •••• 4242</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button variant="outline" onClick={handleUpdatePaymentMethod} disabled={isUpdating}>
                      {isUpdating ? "Loading..." : "Update Payment Method"}
                    </Button>
                    <Button variant="outline" onClick={handleCancelSubscription} disabled={isUpdating}>
                      {isUpdating ? "Loading..." : "Cancel Subscription"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Active Subscription</h3>
                  <p className="text-muted-foreground mb-6">
                    You're currently on the free plan. Upgrade to access premium features.
                  </p>
                  <Link href="/pricing">
                    <Button>Choose a Plan</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment History */}
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>View your past invoices and payments</CardDescription>
            </CardHeader>
            <CardContent>
              {hasActiveSubscription ? (
                <div className="space-y-4">
                  {mockPaymentHistory.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <CreditCard className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{payment.description}</p>
                          <p className="text-sm text-muted-foreground">{formatDate(payment.date)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-medium">{payment.amount}</p>
                          <Badge variant="secondary" className="text-xs">
                            {payment.status}
                          </Badge>
                        </div>
                        <Button variant="ghost" size="sm">
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No payment history available.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
