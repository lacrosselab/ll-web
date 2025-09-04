"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { usePathname } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Settings, LogOut, Home, Shield } from "lucide-react"

export function AdminNavigation() {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const supabase = getSupabaseClient()

    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
  }

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/admin/dashboard" className="text-xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Admin Panel
            </Link>
          </div>

          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <Link
                href="/admin/dashboard"
                className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary ${
                  pathname === "/admin/dashboard" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Dashboard
              </Link>
              <Link
                href="/admin/users"
                className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary ${
                  pathname === "/admin/users" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Users
              </Link>
              <Link
                href="/admin/subscriptions"
                className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary ${
                  pathname === "/admin/subscriptions" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Subscriptions
              </Link>
              <Link
                href="/admin/analytics"
                className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary ${
                  pathname === "/admin/analytics" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Analytics
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <Home className="h-4 w-4 mr-2" />
                Site
              </Button>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.user_metadata?.avatar_url || "/placeholder.svg"} alt={user?.email} />
                    <AvatarFallback>{user?.email?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.user_metadata?.full_name || "Admin"}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  )
}
