"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { logger } from '@/lib/utils'
import { X } from 'lucide-react'

interface WaiverModalProps {
  isOpen: boolean
  onClose: () => void
  onWaiverSigned: () => void
  hasMinors: boolean
  minorAthleteNames?: string[]
}

export function WaiverModal({
  isOpen,
  onClose,
  onWaiverSigned,
  hasMinors,
  minorAthleteNames = []
}: WaiverModalProps) {
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const { showToast } = useToast()

  if (!isOpen) return null

  const handleSign = async () => {
    if (!agreed) {
      showToast('Please check the box to agree to the waiver', 'error')
      return
    }

    try {
      setLoading(true)

      const response = await fetch('/api/waiver/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to sign waiver')
      }

      showToast('Waiver signed successfully', 'success')
      onWaiverSigned()
    } catch (error) {
      logger.error('Error signing waiver', { error })
      showToast('Failed to sign waiver. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>
          <CardTitle>Waiver and Release Form</CardTitle>
          <CardDescription>
            {hasMinors
              ? 'As the parent/guardian, please review and sign this waiver for your athlete(s)'
              : 'Please review and sign this waiver to continue'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 overflow-y-auto flex-1">
          {/* Waiver Content Section */}
          <div className="prose prose-sm max-w-none bg-muted p-4 rounded-lg max-h-96 overflow-y-auto text-sm">
            <h4 className="font-semibold text-base mt-0">PARTICIPANT WAIVER AND RELEASE OF LIABILITY</h4>

            {hasMinors && minorAthleteNames.length > 0 && (
              <p className="font-medium text-primary">
                Signing on behalf of: {minorAthleteNames.join(', ')}
              </p>
            )}

            <p>
              In consideration for being permitted to participate in The Lacrosse Lab
              training sessions and activities, I hereby acknowledge and agree to the following:
            </p>

            <ol className="space-y-3 pl-4">
              <li>
                <strong>Assumption of Risk:</strong> I understand that lacrosse and related
                athletic activities involve inherent risks including but not limited to
                physical contact, falls, equipment failure, and other injuries. I voluntarily
                assume all risks associated with participation.
              </li>
              <li>
                <strong>Release of Liability:</strong> I, for myself and on behalf of my
                heirs, assigns, personal representatives and next of kin, hereby release,
                indemnify, and hold harmless The Lacrosse Lab, its officers, officials,
                agents, employees, and volunteers from any and all claims, demands, losses,
                and liability arising out of or related to any injury, disability, or death
                that may occur as a result of participation.
              </li>
              <li>
                <strong>Medical Authorization:</strong> I authorize The Lacrosse Lab to
                obtain emergency medical treatment for the participant if needed. I understand
                that I am responsible for any medical expenses incurred.
              </li>
              <li>
                <strong>Media Release:</strong> I grant permission for photographs and
                video taken during activities to be used for promotional and marketing purposes.
              </li>
              <li>
                <strong>Rules and Conduct:</strong> I agree to follow all rules, instructions,
                and safety guidelines provided by The Lacrosse Lab staff. I understand that
                failure to comply may result in removal from the program without refund.
              </li>
            </ol>

            {/* RBA West Section */}
            <div className="mt-6 border-t pt-4">
              <h4 className="font-semibold text-base">RBA WEST</h4>
              <p className="mt-2">
                In signing this release, I attest and verify that my child has full knowledge of the risks involved
                with the sport associated with the activity he/she is attending. My child is physically fit and
                sufficiently trained to participate in the activity. To the best of my knowledge, my child does not
                have any diseases or injuries that would medically prohibit him/her from participating in the
                activity. I do hereby release and forever discharge RBA West, its agents, officers, instructors and
                employees from any responsibility or liability for recurrence of any pre-existing, any undisclosed
                injury or illness, or any personal injury or property damage sustained by my child during or
                because of participation. I also give permission for any emergency procedures that are deemed
                necessary for my child during the activity.
              </p>
              <ul className="list-disc pl-5 mt-1">
                <li>Private Lessons</li>
                <li>Camps</li>
                <li>Team Workouts/Practices</li>
                <li>Cage/Facility Rental</li>
                <li>Total Pitching Development</li>
              </ul>
            </div>

            {hasMinors ? (
              <p className="font-medium mt-4 border-t pt-4">
                PARENT/GUARDIAN ACKNOWLEDGMENT: I am the parent or legal guardian of the
                minor participant(s) listed above. I have read this waiver and release
                and understand its terms. I sign it voluntarily and with full knowledge
                of its significance. I agree to indemnify and hold harmless The Lacrosse Lab
                from any claims brought by or on behalf of the minor participant(s).
              </p>
            ) : (
              <p className="font-medium mt-4 border-t pt-4">
                ADULT PARTICIPANT ACKNOWLEDGMENT: I am at least 18 years of age. I have read
                this waiver and release and understand its terms. I sign it voluntarily and
                with full knowledge of its significance.
              </p>
            )}
          </div>

          {/* Agreement Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer p-3 border rounded-lg hover:bg-muted/50">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-gray-300"
              disabled={loading}
            />
            <span className="text-sm">
              {hasMinors
                ? 'I am the parent/legal guardian of the participant(s) and I have read, understand, and agree to the terms of this waiver and release.'
                : 'I have read, understand, and agree to the terms of this waiver and release.'
              }
            </span>
          </label>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSign}
              disabled={loading || !agreed}
              className="flex-1"
            >
              {loading ? 'Signing...' : 'Sign Waiver & Continue to Checkout'}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
