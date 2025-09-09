"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { Lock, Play, FileText, Video, BookOpen, Download } from "lucide-react"
import Link from "next/link"

export default function MemberContent() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const supabase = getSupabaseClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const premiumContent = [
    {
      id: 1,
      title: "Advanced Business Strategies",
      description: "Deep dive into proven strategies that scale businesses from startup to enterprise level.",
      type: "Course",
      duration: "4 hours",
      icon: BookOpen,
      premium: true,
    },
    {
      id: 2,
      title: "Market Analysis Templates",
      description: "Professional templates and frameworks for conducting comprehensive market analysis.",
      type: "Templates",
      duration: "Download",
      icon: FileText,
      premium: true,
    },
    {
      id: 3,
      title: "Leadership Masterclass",
      description: "Exclusive video series on building and leading high-performance teams.",
      type: "Video Series",
      duration: "6 episodes",
      icon: Video,
      premium: true,
    },
    {
      id: 4,
      title: "Financial Planning Toolkit",
      description: "Complete toolkit for financial planning, budgeting, and forecasting.",
      type: "Toolkit",
      duration: "Download",
      icon: Download,
      premium: true,
    },
  ]

  const freeContent = [
    {
      id: 5,
      title: "Getting Started Guide",
      description: "Essential guide to help you get the most out of our platform.",
      type: "Guide",
      duration: "15 min read",
      icon: BookOpen,
      premium: false,
    },
    {
      id: 6,
      title: "Basic Templates",
      description: "Free templates to help you get started with your business planning.",
      type: "Templates",
      duration: "Download",
      icon: FileText,
      premium: false,
    },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="py-8 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto">
            <div className="flex items-center justify-center h-64">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Premium Content</h1>
            <p className="text-muted-foreground">
              Access exclusive resources, courses, and tools designed to help you succeed.
            </p>
          </div>

          {/* Subscription Status Banner */}
          {!hasActiveSubscription && (
            <Card className="mb-8 border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  Upgrade to Access Premium Content
                </CardTitle>
                <CardDescription>
                  Get unlimited access to all premium courses, templates, and exclusive resources.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/pricing">
                  <Button>Upgrade Now</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Premium Content */}
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-6">
              <h2 className="text-2xl font-bold">Premium Content</h2>
              <Badge variant="default">Premium</Badge>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {premiumContent.map((content) => {
                const Icon = content.icon
                const isAccessible = hasActiveSubscription

                return (
                  <Card
                    key={content.id}
                    className={`relative ${!isAccessible ? "opacity-60" : "hover:shadow-md transition-shadow"}`}
                  >
                    {!isAccessible && (
                      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
                        <div className="text-center">
                          <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm font-medium">Premium Content</p>
                          <p className="text-xs text-muted-foreground">Upgrade to access</p>
                        </div>
                      </div>
                    )}

                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{content.title}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {content.type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{content.duration}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="mb-4">{content.description}</CardDescription>
                      <Button
                        variant={isAccessible ? "default" : "secondary"}
                        size="sm"
                        disabled={!isAccessible}
                        className="w-full"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        {isAccessible ? "Access Content" : "Upgrade to Access"}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Free Content */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <h2 className="text-2xl font-bold">Free Resources</h2>
              <Badge variant="secondary">Free</Badge>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {freeContent.map((content) => {
                const Icon = content.icon

                return (
                  <Card key={content.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-secondary/10 rounded-lg">
                            <Icon className="h-5 w-5 text-secondary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{content.title}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {content.type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{content.duration}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="mb-4">{content.description}</CardDescription>
                      <Button variant="outline" size="sm" className="w-full bg-transparent">
                        <Play className="h-4 w-4 mr-2" />
                        Access Content
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
