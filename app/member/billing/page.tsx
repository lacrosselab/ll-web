"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { CreditCard, Download, Receipt, Calendar, User, DollarSign } from "lucide-react"
import Link from "next/link"

interface PaymentAthlete {
  id: string
  quantity: number
  unit_price_cents: number
  created_at: string
  athlete: {
    id: string
    name: string
    age?: number
    school?: string
  }
  product: {
    id: string
    name: string
    session_date: string
    description?: string
  }
}

interface Payment {
  id: string
  amount: number
  currency: string
  status: string
  stripe_payment_intent_id: string
  created_at: string
  payment_athletes: PaymentAthlete[]
}

export default function MemberBilling() {
  const [user, setUser] = useState<User | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabaseClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) {
        fetchPayments(user.id)
      }
    })

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchPayments(session.user.id)
      }
    })

    return () => authSubscription.unsubscribe()
  }, [])

  const fetchPayments = async (userId: string) => {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          payment_athletes (
            id,
            quantity,
            unit_price_cents,
            created_at,
            athlete:athletes (
              id,
              name,
              age,
              school
            ),
            product:products (
              id,
              name,
              session_date,
              description
            )
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching payments:", error)
        return
      }

      setPayments(data || [])
    } catch (error) {
      console.error("Error fetching payments:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatSessionDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "succeeded":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Paid</Badge>
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>
      case "failed":
        return <Badge className="bg-red-100 text-red-800 border-red-200">Failed</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Payment History</h1>
          <p className="text-muted-foreground mt-2">
            View all your session purchases and payment details
          </p>
        </div>

        <div className="space-y-6">
          {payments.length > 0 ? (
            payments.map((payment) => (
              <Card key={payment.id} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <CreditCard className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          Payment #{payment.id.slice(-8)}
                        </CardTitle>
                        <CardDescription>
                          {formatDate(payment.created_at)}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-semibold">
                        {formatAmount(payment.amount, payment.currency)}
                      </div>
                      {getStatusBadge(payment.status)}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {payment.payment_athletes.map((paymentAthlete) => (
                      <div key={paymentAthlete.id} className="border rounded-lg p-4 bg-muted/30">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold text-lg mb-1">
                              {paymentAthlete.product.name}
                            </h4>
                            {paymentAthlete.product.description && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {paymentAthlete.product.description}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">
                              {formatAmount(paymentAthlete.unit_price_cents * paymentAthlete.quantity, payment.currency)}
                            </div>
                            {paymentAthlete.quantity > 1 && (
                              <div className="text-sm text-muted-foreground">
                                {paymentAthlete.quantity} × {formatAmount(paymentAthlete.unit_price_cents, payment.currency)}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Session Date:</span>
                            <span>{formatSessionDate(paymentAthlete.product.session_date)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Athlete:</span>
                            <span>
                              {paymentAthlete.athlete.name}
                              {paymentAthlete.athlete.age && ` (Age ${paymentAthlete.athlete.age})`}
                              {paymentAthlete.athlete.school && ` - ${paymentAthlete.athlete.school}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex justify-end pt-4 border-t">
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Download Receipt
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Payment History</h3>
                <p className="text-muted-foreground mb-6">
                  You haven't made any purchases yet. Browse our available sessions to get started.
                </p>
                <Link href="/pricing">
                  <Button>Browse Sessions</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
