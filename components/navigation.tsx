// components/navigation.tsx
"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import Image from "next/image"
import { Menu, X } from "lucide-react"
import { CartIcon } from "@/components/cart-icon"
import { useState } from "react"
import { logger } from "@/lib/utils"

export function Navigation() {
  const pathname = usePathname()
  const { user, signOut, loading } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    try {
      await signOut()
      setIsMobileMenuOpen(false)
    } catch (error) {
      logger.error("Sign out failed", { error })
      setIsMobileMenuOpen(false)
    }
  }

  // Check if user is admin
  const isAdmin = user?.email?.endsWith('@thelacrosselab.com')

  // Show loading state while auth is initializing
  if (loading) {
    return (
      <nav className="w-full border-b bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <Image src="/logo.svg" alt="Lacrosse Lab" width={120} height={16} className="h-6 w-auto" />
              </Link>
            </div>
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="w-full border-b bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <Image src="/logo.svg" alt="Lacrosse Lab" width={120} height={16} className="h-6 w-auto" />
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Cart Icon */}
            <CartIcon />
            {/* Conditional items based on auth status */}
            {user ? (
              <>
                {/* Admin Dashboard Button - only for admin users */}
                {isAdmin && (
                  <Link href="/admin/products">
                    <Button variant="outline" size="sm" className="bg-primary border-red-200 text-cream hover:bg-cream hover:text-primary">
                      Admin Dashboard
                    </Button>
                  </Link>
                )}

                 {/* Available Sessions - always shown */}
                 <Link href="/pricing">
                  <Button variant="outline" size="sm">
                    Available Sessions
                  </Button>
                </Link>
            
                <Link href="/member/dashboard">
                  <Button variant="outline" size="sm">
                    Dashboard
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-md transition-all duration-200 hover:bg-red-600 hover:text-white"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu overlay - full screen takeover */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[1] md:hidden">
          {/* Backdrop - covers entire screen */}
          <div 
            className="absolute inset-0 backdrop-blur-sm bg-cream"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Menu panel - full screen overlay */}
          <div className="absolute inset-0 bg-background">
            <div className="px-6 py-3 h-full flex flex-col">
              {/* Header with logo and close button */}
              <div className="flex items-center justify-between mb-12">
                <Link href="/" className="flex items-center" onClick={() => setIsMobileMenuOpen(false)}>
                  <Image src="/logo.svg" alt="Lacrosse Lab" width={120} height={16} className="h-6 w-auto" />
                </Link>
                <button
                  className="p-2 rounded-md transition-all duration-200 hover:bg-red-600 hover:text-white"
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label="Close mobile menu"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Navigation links */}
              <nav className="space-y-8 flex-1">
                <Link
                  href="/pricing"
                  className={`block text-3xl font-semibold transition-colors ${
                    pathname === "/pricing" ? "text-primary" : "text-foreground hover:text-primary"
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Available Sessions
                </Link>
                
                <Link
                  href="/cart"
                  className={`block text-3xl font-semibold transition-colors ${
                    pathname === "/cart" ? "text-primary" : "text-foreground hover:text-primary"
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Cart
                </Link>
              </nav>

              {/* User actions */}
              <div className="pt-8 border-t border-border space-y-6 flex flex-col gap-4">
                {user ? (
                  <>
                    {/* Admin Dashboard Button - only for admin users */}
                    {isAdmin && (
                      <Link href="/admin/products" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button variant="outline" className="w-full text-lg py-6 h-auto">
                          Admin Dashboard
                        </Button>
                      </Link>
                    )}
                    
                    <Link href="/member/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full text-lg py-6 h-auto">
                        Dashboard
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      className="w-full text-lg py-6 h-auto hover:bg-red-50 hover:text-red-600"
                      onClick={handleSignOut}
                    >
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="default" className="w-full text-lg py-6 h-auto">
                      Sign In
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}