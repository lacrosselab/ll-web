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

export const metadata: Metadata = {
  title: "Lacrosse Lab",
  description: "Professional SaaS application with subscription management",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={
          <div className="bg-background">
            <div className="border-b bg-background/95 backdrop-blur">
              <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                  <Skeleton className="h-6 w-24" />
                  <div className="hidden md:flex items-center space-x-4">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              </div>
            </div>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="space-y-6">
                <Skeleton className="h-8 w-1/3" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              </div>
            </div>
          </div>
        }>
          <Navigation />
          {/* TODO: Import and configure Futura Condensed ExtraBold for headings */}
          {/* TODO: Import and configure Helvetica for body text */}
          {children}
          <Analytics />
        </Suspense>
        <Footer />
      </body>
    </html>
  )
}
