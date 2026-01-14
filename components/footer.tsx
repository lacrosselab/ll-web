"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { usePathname } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import Image from "next/image"
import { Menu, X } from "lucide-react"
import { RichmondClock } from "@/components/richmond-clock"

export function Footer() {
  const [currentYear, setCurrentYear] = useState<number>(2024) // Default fallback
  
  useEffect(() => {
    setCurrentYear(new Date().getFullYear())
  }, [])

  return (
        <footer className="flex-shrink-0 border-t border-navy/10 py-6">
        <div className="container mx-auto">
        {/* Top row: Copyright and Contact */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-1 mb-2">
            <div className="text-navy/60 text-sm">
            &copy; {currentYear} Lacrosse Lab
            </div>
            <RichmondClock />
            <div className="flex items-center gap-4 text-sm">
            <a 
                href="mailto:carter@thelacrosselab.com" 
                className="text-navy/60 hover:text-navy transition-colors"
            >
                Contact
            </a>
            <a 
                href="https://instagram.com/lacrosse.lab" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-navy/60 hover:text-navy transition-colors"
            >
                Instagram
            </a>
            </div>

        </div>
        
        </div>
        </footer>
  )}