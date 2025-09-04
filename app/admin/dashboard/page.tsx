"use client"

import { AdminNavigation } from "@/components/admin-navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { Users, CreditCard, TrendingUp, DollarSign, UserCheck, AlertCircle } from "lucide-react"

interface DashboardStats {
  totalUsers: number
  activeSubscriptions: number
  monthlyRevenue: number
  churnRate: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeSubscriptions: 0,
    monthlyRevenue: 0,
    churnRate: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const supabase = getSupabaseClient()

        // In a real app, these would be actual database queries
        // For now, we'll use mock data
        setStats({
          totalUsers: 1247,
          activeSubscriptions: 892,
          monthlyRevenue: 8920,
          churnRate: 3.2,
        })
      } catch (error) {
        console.error("Error fetching stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const recentActivity = [
    {
      id: 1,
      type: "subscription",
      message: "New subscription from john@example.com",
      time: "2 minutes ago",
      status: "success",
    },
    {
      id: 2,
      type: "user",
      message: "New user registration: sarah@example.com",
      time: "15 minutes ago",
      status: "info",
    },
    {
      id: 3,
      type: "payment",
      message: "Payment failed for mike@example.com",
      time: "1 hour ago",
      status: "error",
    },
    {
      id: 4,
      type: "subscription",
      message: "Subscription cancelled by lisa@example.com",
      time: "2 hours ago",
      status: "warning",
    },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AdminNavigation />
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
      <AdminNavigation />

      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">Overview of your SaaS platform performance and metrics.</p>
          </div>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-600">+12%</span> from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeSubscriptions.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-600">+8%</span> from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats.monthlyRevenue.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-600">+15%</span> from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.churnRate}%</div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-red-600">+0.5%</span> from last month
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Recent Activity */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest events and user actions on your platform</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          activity.status === "success"
                            ? "bg-green-500"
                            : activity.status === "error"
                              ? "bg-red-500"
                              : activity.status === "warning"
                                ? "bg-yellow-500"
                                : "bg-blue-500"
                        }`}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.message}</p>
                        <p className="text-xs text-muted-foreground">{activity.time}</p>
                      </div>
                      <Badge
                        variant={
                          activity.status === "success"
                            ? "default"
                            : activity.status === "error"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {activity.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common administrative tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <div className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">View All Users</span>
                    </div>
                  </div>
                  <div className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Subscription Reports</span>
                    </div>
                  </div>
                  <div className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Failed Payments</span>
                    </div>
                  </div>
                  <div className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Analytics Dashboard</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
