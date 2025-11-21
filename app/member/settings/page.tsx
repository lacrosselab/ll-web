"use client"

import type React from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { UserIcon, Shield } from "lucide-react"
import { logger } from "@/lib/utils"

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export default function MemberSettings() {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const supabase = getSupabaseClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) {
        fetchUserProfile(user.id)
        setEmail(user.email || "")
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        fetchUserProfile(currentUser.id)
        setEmail(currentUser.email || "")
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserProfile = async (userId: string) => {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setUserProfile(data)
      // @ts-ignore - Supabase TypeScript types not properly generated
      setFullName(data?.full_name || "")
    } catch (error) {
      logger.error('Error fetching user profile', { error })
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const supabase = getSupabaseClient()
      
      if (!user) {
        setError("No user found")
        return
      }

      // Update both auth metadata and database
      const [authResult, dbResult] = await Promise.all([
        // Update auth metadata
        supabase.auth.updateUser({
          data: { full_name: fullName },
        }),
        // Update database
        supabase
          // @ts-ignore - Supabase TypeScript types not properly generated
          .from('users')
          // @ts-ignore - Supabase TypeScript types not properly generated
          .update({ 
            full_name: fullName,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)
      ])

      if (authResult.error) {
        setError(authResult.error.message)
        return
      }

      if (dbResult.error) {
        setError(dbResult.error.message)
        return
      }

      // Refresh user profile data
      await fetchUserProfile(user.id)
      setSuccess("Profile updated successfully!")
    } catch (err) {
      logger.error('Error updating profile', { error: err })
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-background">
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Account Settings</h1>
            <p className="text-muted-foreground">Manage your account preferences and security settings.</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Profile Settings */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserIcon className="h-5 w-5" />
                    Profile Information
                  </CardTitle>
                  <CardDescription>Update your personal information and preferences.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input id="email" value={email} disabled placeholder="Email cannot be changed here" />
                      <p className="text-xs text-muted-foreground">Contact <a href="mailto:hello@thelacrosselab.com" className="text-primary hover:underline">support</a> to change your email address.</p>
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    {success && <p className="text-sm text-green-600">{success}</p>}
                    <Button type="submit" disabled={loading}>
                      {loading ? "Updating..." : "Update Profile"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Security
                  </CardTitle>
                  <CardDescription>Manage your account security settings.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Change Password</p>
                      <p className="text-sm text-muted-foreground">Update your account password</p>
                    </div>
                    <Button variant="outline" size="sm">
                      Change
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Account Overview */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Account Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">Account Status</p>
                    <p className="text-sm text-muted-foreground">Active</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Member Since</p>
                    <p className="text-sm text-muted-foreground">
                      {userProfile?.created_at
                        ? new Date(userProfile.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Last Login</p>
                    <p className="text-sm text-muted-foreground">Today</p>
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
