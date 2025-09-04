"use client"

import { AdminNavigation } from "@/components/admin-navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useEffect, useState } from "react"
import { Search, MoreHorizontal, UserCheck, UserX, Mail } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface UserData {
  id: string
  email: string
  full_name: string
  created_at: string
  subscription_status: "active" | "inactive" | "trial"
  last_login: string
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        // In a real app, this would fetch from your database
        // For now, we'll use mock data
        const mockUsers: UserData[] = [
          {
            id: "1",
            email: "john@example.com",
            full_name: "John Smith",
            created_at: "2024-01-15T10:30:00Z",
            subscription_status: "active",
            last_login: "2024-01-20T14:22:00Z",
          },
          {
            id: "2",
            email: "sarah@example.com",
            full_name: "Sarah Johnson",
            created_at: "2024-01-10T09:15:00Z",
            subscription_status: "trial",
            last_login: "2024-01-19T16:45:00Z",
          },
          {
            id: "3",
            email: "mike@example.com",
            full_name: "Mike Wilson",
            created_at: "2023-12-20T11:20:00Z",
            subscription_status: "inactive",
            last_login: "2024-01-18T08:30:00Z",
          },
          {
            id: "4",
            email: "lisa@example.com",
            full_name: "Lisa Brown",
            created_at: "2024-01-05T13:45:00Z",
            subscription_status: "active",
            last_login: "2024-01-20T12:15:00Z",
          },
        ]
        setUsers(mockUsers)
      } catch (error) {
        console.error("Error fetching users:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [])

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <UserCheck className="h-3 w-3 mr-1" />
            Active
          </Badge>
        )
      case "trial":
        return (
          <Badge variant="secondary">
            <UserCheck className="h-3 w-3 mr-1" />
            Trial
          </Badge>
        )
      case "inactive":
        return (
          <Badge variant="outline">
            <UserX className="h-3 w-3 mr-1" />
            Inactive
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

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
            <h1 className="text-3xl font-bold mb-2">User Management</h1>
            <p className="text-muted-foreground">Manage and monitor all users on your platform.</p>
          </div>

          {/* Stats */}
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{users.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {users.filter((u) => u.subscription_status === "active").length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Trial Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {users.filter((u) => u.subscription_status === "trial").length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Inactive Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {users.filter((u) => u.subscription_status === "inactive").length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Users</CardTitle>
                  <CardDescription>A list of all users and their subscription status</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
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
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src="/placeholder.svg" alt={user.full_name} />
                            <AvatarFallback>{user.full_name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.full_name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(user.subscription_status)}</TableCell>
                      <TableCell>{formatDate(user.created_at)}</TableCell>
                      <TableCell>{formatDate(user.last_login)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Mail className="mr-2 h-4 w-4" />
                              Send Email
                            </DropdownMenuItem>
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Manage Subscription</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Suspend User</DropdownMenuItem>
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
