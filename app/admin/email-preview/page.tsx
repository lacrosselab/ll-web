'use client'

import React, { useState, useEffect } from 'react'
import { PurchaseConfirmationEmail } from '@/emails/purchase-confirmation'
import { BroadcastEmail } from '@/emails/broadcast-template'

/**
 * Email preview page for dev testing
 * 
 * This page renders email templates with mock data for manual verification.
 * No server-only APIs (like Resend client) are imported here.
 */
export default function EmailPreviewPage() {
  const [orderDate, setOrderDate] = useState<string>('')
  
  useEffect(() => {
    setOrderDate(new Date().toISOString())
  }, [])

  // Mock data for PurchaseConfirmationEmail
  const mockPurchaseData = {
    orderNumber: 'LAB-123456',
    orderDate: orderDate || '2024-01-01T00:00:00.000Z',
    customerName: 'John Doe',
    items: [
      {
        productName: 'Elite Training Session',
        athleteName: 'Jane Smith',
        quantity: 1,
        unitPriceCents: 10000,
        sessionDate: '2024-02-15',
        sessionTime: '14:30:00',
        location: 'Richmond Field',
      },
      {
        productName: 'Advanced Skills Workshop',
        athleteName: 'John Doe Jr.',
        quantity: 2,
        unitPriceCents: 7500,
        sessionDate: '2024-02-20',
        sessionTime: '16:00:00',
        location: 'Main Stadium',
      },
    ],
    totalAmountCents: 25000,
    currency: 'USD',
  }

  // Mock data for BroadcastEmail
  const mockBroadcastData = {
    subject: 'Important Update: New Training Schedule',
    bodyText: `# Welcome to The Lacrosse Lab

We're excited to announce some important updates to our training schedule.

## New Session Times

Starting next week, we'll be offering additional evening sessions to accommodate more athletes.

## Registration

Please make sure to register early as spots are limited.

If you have any questions, please don't hesitate to contact us.`,
    preview: 'Important Update: New Training Schedule',
  }

  return (
    <div className="container mx-auto p-8 space-y-12">
      <h1 className="text-3xl font-bold mb-8">Email Template Previews</h1>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Purchase Confirmation Email</h2>
        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <div className="prose max-w-none">
            <PurchaseConfirmationEmail {...mockPurchaseData} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Broadcast Email</h2>
        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <div className="prose max-w-none">
            <BroadcastEmail {...mockBroadcastData} />
          </div>
        </div>
      </section>
    </div>
  )
}

