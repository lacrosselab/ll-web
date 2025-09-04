"use client"

import { MemberNavigation } from "@/components/member-navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useSubscription } from "@/hooks/use-subscription"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { CreditCard, Settings, CheckCircle } from "lucide-react"
import Link from "next/link"

export default function MemberDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const { subscription, hasActiveSubscription, loading } = useSubscription(user)

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

  return (
    <div className="min-h-screen bg-background">
      <MemberNavigation />

      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.user_metadata?.full_name || "Member"}!</h1>
            <p className="text-muted-foreground">Manage your account settings and billing information.</p>
          </div>

          {/* Subscription Status */}
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Subscription Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span>Loading subscription...</span>
                  </div>
                ) : hasActiveSubscription ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Renews on {formatDate(subscription!.current_period_end)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Premium Plan</p>
                        <p className="text-sm text-muted-foreground">Full access to all features</p>
                      </div>
                      <Link href="/member/billing">
                        <Button variant="outline" size="sm">
                          Manage Billing
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Free Trial</Badge>
                      <span className="text-sm text-muted-foreground">Upgrade to unlock all features</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Limited Access</p>
                        <p className="text-sm text-muted-foreground">Upgrade to get full access</p>
                      </div>
                      <Link href="/pricing">
                        <Button size="sm">Upgrade Now</Button>
                      </Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Account Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Link href="/member/settings">
                    <Button variant="outline" className="w-full justify-start bg-transparent">
                      Update Profile Information
                    </Button>
                  </Link>
                  <Link href="/member/billing">
                    <Button variant="outline" className="w-full justify-start bg-transparent">
                      Manage Payment Methods
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Account Management Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <Link href="/member/settings">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="h-4 w-4 text-primary" />
                    Account Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>Update your email, password, and personal information</CardDescription>
                </CardContent>
              </Link>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <Link href="/member/billing">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    Billing & Payments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>View payment history and manage your payment methods</CardDescription>
                </CardContent>
              </Link>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
