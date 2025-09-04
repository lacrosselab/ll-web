"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { usePathname } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import Image from "next/image"

export function Navigation() {
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

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <Image src="/logo.svg" alt="Lacrosse Lab" width={120} height={16} className="h-6 w-auto" />
            </Link>
          </div>

          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <Link
                href="/"
                className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary ${
                  pathname === "/" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Home
              </Link>
              <Link
                href="/pricing"
                className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary ${
                  pathname === "/pricing" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Pricing
              </Link>
              <Link
                href="/about"
                className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary ${
                  pathname === "/about" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                About
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <Link href="/member/dashboard">
                  <Button variant="outline" size="sm">
                    Dashboard
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const supabase = getSupabaseClient()
                    await supabase.auth.signOut()
                  }}
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
