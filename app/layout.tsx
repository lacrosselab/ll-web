// app/layout.tsx
import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import "./globals.css"
import { CartProvider } from "@/contexts/cart-context"
import { AuthProvider } from "@/contexts/auth-context"
import { ToastProvider } from '@/components/ui/toast'

export const metadata: Metadata = {
  title: "Lacrosse Lab",
  description: "Professional lacrosse training and development",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <Navigation />
              {children}
              <Analytics />
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
        <Footer />
      </body>
    </html>
  )
}