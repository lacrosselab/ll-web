import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
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
        <Suspense fallback={<div>Loading...</div>}>
          {/* TODO: Import and configure Futura Condensed ExtraBold for headings */}
          {/* TODO: Import and configure Helvetica for body text */}
          {children}
          <Analytics />
        </Suspense>
      </body>
    </html>
  )
}
