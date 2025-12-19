"use client"

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Calendar, ClipboardList, Mail, Users } from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const checkAdminAccess = async () => {
      const supabase = getSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login?redirect=' + encodeURIComponent(pathname))
        return
      }

      if (!user.email?.endsWith('@thelacrosselab.com')) {
        router.push('/')
        return
      }
    }

    checkAdminAccess()
  }, [router, pathname])

  const navItems = [
    { href: '/admin/products', label: 'Sessions', icon: Calendar },
    { href: '/admin/athletes', label: 'Athletes', icon: Users },
    { href: '/admin/roster', label: 'Roster', icon: ClipboardList },
    { href: '/admin/broadcast', label: 'Broadcast', icon: Mail },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">Admin Tabs</h1>
        {/* Sidebar */}
          <div className="flex flex-col gap-4">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? 'default' : 'ghost'}
                    className="w-full justify-start"
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </Button>
                </Link>
              )
            })}
          </div>
          </div>


          {/* Main Content */}
          <div className="flex-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
