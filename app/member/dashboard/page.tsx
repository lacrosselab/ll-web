"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { CreditCard, Settings, Receipt, User } from "lucide-react"
import Link from "next/link"

interface Payment {
  id: string
  amount: number
  currency: string
  status: string
  created_at: string
}

export default function MemberDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [recentPayments, setRecentPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabaseClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) {
        fetchRecentPayments(user.id)
      }
    })

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchRecentPayments(session.user.id)
      }
    })

    return () => authSubscription.unsubscribe()
  }, [])

  const fetchRecentPayments = async (userId: string) => {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "succeeded")
        .order("created_at", { ascending: false })
        .limit(3)

      if (error) {
        console.error("Error fetching payments:", error)
        return
      }

      setRecentPayments(data || [])
    } catch (error) {
      console.error("Error fetching payments:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  }

  return (
    <div className="bg-background">
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.user_metadata?.full_name || "Member"}!</h1>
            <p className="text-muted-foreground">Manage your account and view your session history.</p>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <Link href="/member/settings">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Profile</h3>
                      <p className="text-sm text-muted-foreground">Update your information</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/member/billing">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <CreditCard className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Billing</h3>
                      <p className="text-sm text-muted-foreground">View payments & history</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/member/settings">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Settings className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Settings</h3>
                      <p className="text-sm text-muted-foreground">Account preferences</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Recent Activity */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Recent Purchases
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span>Loading purchases...</span>
                  </div>
                ) : recentPayments.length > 0 ? (
                  <div className="space-y-4">
                    {recentPayments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <CreditCard className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">Session Purchase</p>
                            <p className="text-sm text-muted-foreground">{formatDate(payment.created_at)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatAmount(payment.amount, payment.currency)}</p>
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            Completed
                          </Badge>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2">
                      <Link href="/member/billing">
                        <Button variant="outline" size="sm">
                          View All Payments
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">No purchases yet</Badge>
                      <span className="text-sm text-muted-foreground">Browse available sessions to get started</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Get Started</p>
                        <p className="text-sm text-muted-foreground">Purchase your first session</p>
                      </div>
                      <Link href="/pricing">
                        <Button size="sm">Browse Sessions</Button>
                      </Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
