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
    default: "The Lacrosse Lab | Richmond Youth Lacrosse Training",
    template: "%s | The Lacrosse Lab"
  },
  description: "Richmond & central Virginia's premier lacrosse training program. Offseason training for players of all ages. Skill development, stick work, shooting, and game strategy.",
  keywords: [
    "richmond va lacrosse training",
    "central virginia lacrosse",
    "middle school lacrosse training richmond",
    "high school lacrosse training richmond",
    "lacrosse offseason training richmond va",
    "women's lacrosse training richmond",
    "lacrosse skills development richmond",
    "lacrosse coaching richmond va",
    "lacrosse training sessions richmond",
    "girls lacrosse training richmond",
    "lacrosse camps richmond va",
    "lacrosse lessons richmond",
    "lacrosse development richmond",
    "collegiate school lacrosse",
    "douglas freeman lacrosse",
    "richmond lacrosse clubs"
  ],
  authors: [{ name: "The Lacrosse Lab" }],
  creator: "The Lacrosse Lab",
  publisher: "The Lacrosse Lab",
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
    title: "The Lacrosse Lab | Richmond Youth Lacrosse Training",
    description: "Richmond & central Virginia's premier girls lacrosse training program. Offseason training for middle and high school players. Skill development, stick work, shooting, and game strategy.",
    siteName: "The Lacrosse Lab",
    images: [
      {
        url: '/web-bg.png',
        width: 1200,
        height: 630,
        alt: 'The Lacrosse Lab - Richmond VA Lacrosse Training',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "The Lacrosse Lab | Richmond Youth Lacrosse Training",
    description: "Richmond & central Virginia's premier girls lacrosse training program. Offseason training for middle and high school players. Skill development, stick work, shooting, and game strategy.",
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
        
        {/* Local Business Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SportsActivityLocation",
              "name": "The Lacrosse Lab",
              "description": "Richmond & central Virginia's premier girls lacrosse training program. Offseason training for middle and high school players. Skill development, stick work, shooting, and game strategy.",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Richmond",
                "addressRegion": "VA",
                "addressCountry": "US"
              },
              "sport": "Lacrosse",
              "audience": ["Middle School", "High School", "Elementary School"],
              "offers": {
                "@type": "Offer",
                "description": "female-first lacrosse training sessions",
                "category": "Sports Training"
              },
              "url": process.env.NEXT_PUBLIC_SITE_URL || 'https://lacrosselab.com'
            })
          }}
        />
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