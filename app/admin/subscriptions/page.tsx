"use client"

import { AdminNavigation } from "@/components/admin-navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useEffect, useState } from "react"
import { Search, MoreHorizontal, CreditCard, Calendar, DollarSign, TrendingUp } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface SubscriptionData {
  id: string
  user_email: string
  user_name: string
  plan: string
  status: "active" | "canceled" | "past_due" | "unpaid"
  amount: number
  current_period_start: string
  current_period_end: string
  created_at: string
}

export default function AdminSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        // In a real app, this would fetch from your database
        // For now, we'll use mock data
        const mockSubscriptions: SubscriptionData[] = [
          {
            id: "sub_1",
            user_email: "john@example.com",
            user_name: "John Smith",
            plan: "Monthly",
            status: "active",
            amount: 999,
            current_period_start: "2024-01-15T00:00:00Z",
            current_period_end: "2024-02-15T00:00:00Z",
            created_at: "2024-01-15T10:30:00Z",
          },
          {
            id: "sub_2",
            user_email: "lisa@example.com",
            user_name: "Lisa Brown",
            plan: "Yearly",
            status: "active",
            amount: 9999,
            current_period_start: "2024-01-05T00:00:00Z",
            current_period_end: "2025-01-05T00:00:00Z",
            created_at: "2024-01-05T13:45:00Z",
          },
          {
            id: "sub_3",
            user_email: "mike@example.com",
            user_name: "Mike Wilson",
            plan: "Monthly",
            status: "canceled",
            amount: 999,
            current_period_start: "2023-12-20T00:00:00Z",
            current_period_end: "2024-01-20T00:00:00Z",
            created_at: "2023-12-20T11:20:00Z",
          },
          {
            id: "sub_4",
            user_email: "emma@example.com",
            user_name: "Emma Davis",
            plan: "Monthly",
            status: "past_due",
            amount: 999,
            current_period_start: "2024-01-10T00:00:00Z",
            current_period_end: "2024-02-10T00:00:00Z",
            created_at: "2024-01-10T09:15:00Z",
          },
        ]
        setSubscriptions(mockSubscriptions)
      } catch (error) {
        console.error("Error fetching subscriptions:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchSubscriptions()
  }, [])

  const filteredSubscriptions = subscriptions.filter(
    (sub) =>
      sub.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.user_name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatAmount = (amount: number) => {
    return `$${(amount / 100).toFixed(2)}`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Active
          </Badge>
        )
      case "canceled":
        return (
          <Badge variant="outline" className="text-gray-600">
            Canceled
          </Badge>
        )
      case "past_due":
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-800">
            Past Due
          </Badge>
        )
      case "unpaid":
        return (
          <Badge variant="destructive" className="bg-orange-100 text-orange-800">
            Unpaid
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const totalRevenue = subscriptions.filter((sub) => sub.status === "active").reduce((sum, sub) => sum + sub.amount, 0)

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
            <h1 className="text-3xl font-bold mb-2">Subscription Management</h1>
            <p className="text-muted-foreground">Monitor and manage all subscriptions and billing.</p>
          </div>

          {/* Stats */}
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{subscriptions.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{subscriptions.filter((s) => s.status === "active").length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatAmount(totalRevenue)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Past Due</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{subscriptions.filter((s) => s.status === "past_due").length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Subscriptions Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Subscriptions</CardTitle>
                  <CardDescription>Manage all user subscriptions and billing information</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search subscriptions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Current Period</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.map((subscription) => (
                    <TableRow key={subscription.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{subscription.user_name}</p>
                          <p className="text-sm text-muted-foreground">{subscription.user_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{subscription.plan}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(subscription.status)}</TableCell>
                      <TableCell className="font-medium">{formatAmount(subscription.amount)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{formatDate(subscription.current_period_start)}</p>
                          <p className="text-muted-foreground">to {formatDate(subscription.current_period_end)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Update Plan</DropdownMenuItem>
                            <DropdownMenuItem>Pause Subscription</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Cancel Subscription</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
