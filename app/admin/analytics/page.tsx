"use client"

import { AdminNavigation } from "@/components/admin-navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useEffect, useState } from "react"
import { TrendingUp, Users, DollarSign, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react"

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate loading analytics data
    const timer = setTimeout(() => {
      setLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  const analyticsData = {
    revenue: {
      current: 8920,
      previous: 7750,
      growth: 15.1,
    },
    users: {
      current: 1247,
      previous: 1113,
      growth: 12.0,
    },
    subscriptions: {
      current: 892,
      previous: 825,
      growth: 8.1,
    },
    churn: {
      current: 3.2,
      previous: 2.7,
      growth: -18.5, // Negative because higher churn is bad
    },
  }

  const topMetrics = [
    {
      title: "Monthly Recurring Revenue",
      value: `$${analyticsData.revenue.current.toLocaleString()}`,
      change: analyticsData.revenue.growth,
      icon: DollarSign,
    },
    {
      title: "Total Users",
      value: analyticsData.users.current.toLocaleString(),
      change: analyticsData.users.growth,
      icon: Users,
    },
    {
      title: "Active Subscriptions",
      value: analyticsData.subscriptions.current.toLocaleString(),
      change: analyticsData.subscriptions.growth,
      icon: TrendingUp,
    },
    {
      title: "Churn Rate",
      value: `${analyticsData.churn.current}%`,
      change: analyticsData.churn.growth,
      icon: Calendar,
      inverse: true, // For churn, negative change is good
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
            <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
            <p className="text-muted-foreground">Track your platform's performance and growth metrics.</p>
          </div>

          {/* Key Metrics */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {topMetrics.map((metric, index) => {
              const Icon = metric.icon
              const isPositive = metric.inverse ? metric.change < 0 : metric.change > 0
              const changeColor = isPositive ? "text-green-600" : "text-red-600"
              const ChangeIcon = isPositive ? ArrowUpRight : ArrowDownRight

              return (
                <Card key={index}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold mb-1">{metric.value}</div>
                    <div className={`flex items-center text-xs ${changeColor}`}>
                      <ChangeIcon className="h-3 w-3 mr-1" />
                      {Math.abs(metric.change)}% from last month
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            {/* Revenue Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
                <CardDescription>Monthly recurring revenue by plan type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-primary rounded-full" />
                      <span className="text-sm">Monthly Plans</span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">$6,240</div>
                      <div className="text-xs text-muted-foreground">70% of total</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full" />
                      <span className="text-sm">Yearly Plans</span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">$2,680</div>
                      <div className="text-xs text-muted-foreground">30% of total</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* User Growth */}
            <Card>
              <CardHeader>
                <CardTitle>User Growth Trends</CardTitle>
                <CardDescription>New user registrations over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">This Month</span>
                    <div className="text-right">
                      <div className="font-medium">134 new users</div>
                      <div className="text-xs text-green-600">+12% vs last month</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Last Month</span>
                    <div className="text-right">
                      <div className="font-medium">119 new users</div>
                      <div className="text-xs text-muted-foreground">Previous period</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Average Daily</span>
                    <div className="text-right">
                      <div className="font-medium">4.3 users/day</div>
                      <div className="text-xs text-muted-foreground">Current rate</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Analytics */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Conversion Funnel */}
            <Card>
              <CardHeader>
                <CardTitle>Conversion Funnel</CardTitle>
                <CardDescription>User journey from signup to subscription</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Signups</span>
                    <Badge variant="outline">1,247</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Trial Started</span>
                    <Badge variant="outline">1,089 (87%)</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Converted to Paid</span>
                    <Badge variant="default">892 (82%)</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Performing Content */}
            <Card>
              <CardHeader>
                <CardTitle>Popular Features</CardTitle>
                <CardDescription>Most used platform features</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Dashboard</span>
                    <span className="text-xs text-muted-foreground">98% usage</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Premium Content</span>
                    <span className="text-xs text-muted-foreground">87% usage</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Analytics</span>
                    <span className="text-xs text-muted-foreground">65% usage</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">API Access</span>
                    <span className="text-xs text-muted-foreground">34% usage</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Support Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Support Metrics</CardTitle>
                <CardDescription>Customer support performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg Response Time</span>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      2.3 hours
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Resolution Rate</span>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      94%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Customer Satisfaction</span>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      4.8/5
                    </Badge>
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
