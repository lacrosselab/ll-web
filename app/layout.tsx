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
import { ErrorBoundary } from "@/components/error-boundary"
import "./globals.css"
import { CartProvider } from "@/contexts/cart-context"
import { AuthProvider } from "@/contexts/auth-context"
import { ToastProvider } from '@/components/ui/toast'

export const metadata: Metadata = {
  title: {
    default: "Lacrosse Lab - Professional Lacrosse Training & Development",
    template: "%s | Lacrosse Lab"
  },
  description: "Professional lacrosse training and development programs. Expert coaching, personalized training sessions, and comprehensive development programs for athletes of all levels.",
  keywords: [
    "lacrosse training",
    "lacrosse coaching",
    "lacrosse development",
    "professional lacrosse",
    "lacrosse lessons",
    "lacrosse camps",
    "athlete development"
  ],
  authors: [{ name: "Lacrosse Lab" }],
  creator: "Lacrosse Lab",
  publisher: "Lacrosse Lab",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://lacrosselab.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://lacrosselab.com',
    title: "Lacrosse Lab - Professional Lacrosse Training & Development",
    description: "Professional lacrosse training and development programs. Expert coaching, personalized training sessions, and comprehensive development programs for athletes of all levels.",
    siteName: "Lacrosse Lab",
    images: [
      {
        url: '/web-bg.png',
        width: 1200,
        height: 630,
        alt: 'Lacrosse Lab - Professional Training',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Lacrosse Lab - Professional Lacrosse Training & Development",
    description: "Professional lacrosse training and development programs. Expert coaching, personalized training sessions, and comprehensive development programs for athletes of all levels.",
    images: ['/web-bg.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Add preload for background image */}
        <link 
          rel="preload" 
          as="image" 
          href="/web-bg.png" 
          type="image/png"
        />
        <meta name="theme-color" content="#000000" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <ErrorBoundary>
          <ToastProvider>
            <AuthProvider>
              <CartProvider>
                <Navigation />
                {children}
                <Analytics />
              </CartProvider>
            </AuthProvider>
          </ToastProvider>
        </ErrorBoundary>
        <Footer />
      </body>
    </html>
  )
}