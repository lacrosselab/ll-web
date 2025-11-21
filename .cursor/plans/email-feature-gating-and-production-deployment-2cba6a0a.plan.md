<!-- 2cba6a0a-fd58-4b5d-a508-c7bfae1cdddc a4102d49-845d-4b72-97c1-2a3bfdc62467 -->
# Email Feature Gating and Production Deployment Plan

## Current State Analysis

### Working Features

- ✅ Purchase confirmation email (`sendPurchaseConfirmation`) - fully implemented in Stripe webhook
- ✅ Contact addition to Resend (`addContactToResend`) - implemented but needs gating
- ✅ Broadcast email feature (`sendBroadcastToAudience`) - implemented but needs gating
- ✅ Database migration for `email_sent_at` already exists (`20250128000000_add_webhook_events_and_email_sent_at.sql`)

### Features That Need Gating

1. **Broadcast feature** - Admin UI at `/admin/broadcast` and API route `/api/admin/broadcast`
2. **Contact addition** - Currently called from:

- Signup page (`app/signup/page.tsx`)
- Stripe webhook (`app/api/webhooks/stripe/route.ts`)

## Implementation Steps

### 1. Add Feature Flags via Environment Variables

Add feature flag checks using environment variables:

- `ENABLE_RESEND_CONTACT_ADDITION` - Controls adding contacts to Resend (signup + purchase)
- `ENABLE_BROADCAST_FEATURE` - Controls broadcast email functionality

**Files to modify:**

- `lib/email/service.tsx` - Add feature flag checks in `addContactToResend()` and `sendBroadcastToAudience()`
- `app/api/admin/broadcast/route.ts` - Add feature flag check
- `app/admin/broadcast/page.tsx` - Add UI indication when feature is disabled
- `app/signup/page.tsx` - Add feature flag check before calling add-contact API
- `app/api/webhooks/stripe/route.ts` - Add feature flag check before calling `addContactToResend()`

### 2. Database Migrations

**No new migrations needed** - The required migration `20250128000000_add_webhook_events_and_email_sent_at.sql` already exists and adds:

- `webhook_events` table for idempotency
- `email_sent_at` column on `payments` table

**Action:** Verify this migration has been run in production database.

### 3. Code Changes for Gating

#### 3.1 Gate Contact Addition (`lib/email/service.tsx`)

- Add feature flag check at start of `addContactToResend()` function
- Log when feature is disabled but don't throw error (graceful degradation)

#### 3.2 Gate Broadcast Feature (`lib/email/service.tsx`)

- Add feature flag check at start of `sendBroadcastToAudience()` function
- Throw error with clear message when disabled

#### 3.3 Gate Broadcast API Route (`app/api/admin/broadcast/route.ts`)

- Check feature flag early in POST handler
- Return 503 Service Unavailable with clear message

#### 3.4 Gate Broadcast UI (`app/admin/broadcast/page.tsx`)

- Check feature flag on page load
- Show disabled state with message explaining feature is not available

#### 3.5 Gate Signup Contact Addition (`app/signup/page.tsx`)

- Remove or conditionally call add-contact API based on feature flag
- Fail silently if disabled (don't block signup)

#### 3.6 Gate Webhook Contact Addition (`app/api/webhooks/stripe/route.ts`)

- Add feature flag check before calling `addContactToResend()` (line 332)
- Keep purchase confirmation email working regardless of flag

### 4. Environment Variable Configuration

**Production environment variables:**

- `ENABLE_RESEND_CONTACT_ADDITION=false` (disabled for initial deployment)
- `ENABLE_BROADCAST_FEATURE=false` (disabled for initial deployment)
- `RESEND_API_KEY` - Required (already set)
- `RESEND_SEGMENT_ID` - Optional (only needed if contact addition enabled)
- `RESEND_FROM_EMAIL` - Optional (defaults to noreply@thelacrosselab.com)

**Preview/Staging environment variables:**

- `ENABLE_RESEND_CONTACT_ADDITION=true` (for testing)
- `ENABLE_BROADCAST_FEATURE=true` (for testing)

### 5. Testing Checklist for Preview Environment

#### Purchase Confirmation Email Testing

- [ ] Complete a test purchase via Stripe checkout
- [ ] Verify purchase confirmation email is received
- [ ] Verify email contains correct order details (order number, items, total)
- [ ] Verify `email_sent_at` is set in `payments` table
- [ ] Verify email is not sent twice (idempotency check)
- [ ] Test with multiple line items
- [ ] Test with products that have multiple sessions

#### Contact Addition Testing (when enabled)

- [ ] Test signup flow - verify contact is added to Resend
- [ ] Test purchase flow - verify contact is added after purchase
- [ ] Verify contacts appear in Resend dashboard
- [ ] Test with existing contact (should handle gracefully)

#### Broadcast Feature Testing (when enabled)

- [ ] Access `/admin/broadcast` page as admin user
- [ ] Compose and preview email
- [ ] Send test broadcast
- [ ] Verify broadcast appears in Resend dashboard
- [ ] Verify emails are received by test recipients

#### Feature Flag Testing

- [ ] Test with `ENABLE_RESEND_CONTACT_ADDITION=false` - verify signup/purchase still work
- [ ] Test with `ENABLE_BROADCAST_FEATURE=false` - verify broadcast UI shows disabled state
- [ ] Test with flags enabled - verify features work

#### Error Handling

- [ ] Test with invalid Resend API key (should fail gracefully)
- [ ] Test with missing `RESEND_SEGMENT_ID` when contact addition enabled
- [ ] Verify errors don't block payment processing

### 6. Production Deployment Steps

1. **Pre-deployment:**

- [ ] Verify `20250128000000_add_webhook_events_and_email_sent_at.sql` migration has been run in production
- [ ] Set production environment variables:
- `ENABLE_RESEND_CONTACT_ADDITION=false`
- `ENABLE_BROADCAST_FEATURE=false`
- `RESEND_API_KEY` (production key)
- `RESEND_FROM_EMAIL` (if different from default)

2. **Deploy to production:**

- [ ] Merge branch `email-feature-251104` to `head-1125`
- [ ] Deploy to production
- [ ] Verify deployment successful

3. **Post-deployment verification:**

- [ ] Test purchase confirmation email with real purchase
- [ ] Verify purchase confirmation emails are being sent
- [ ] Verify contact addition is NOT happening (feature disabled)
- [ ] Verify broadcast feature is NOT accessible (feature disabled)
- [ ] Check application logs for any errors

### 7. Future Roadmap: Enabling Features

#### Phase 1: Enable Contact Addition

1. Set `ENABLE_RESEND_CONTACT_ADDITION=true` in production
2. Monitor logs for contact addition errors
3. Verify contacts are being added to Resend audience
4. Test signup and purchase flows

#### Phase 2: Enable Broadcast Feature

1. Set `ENABLE_BROADCAST_FEATURE=true` in production
2. Test broadcast functionality in production
3. Send test broadcast to small segment first
4. Monitor Resend dashboard for delivery status

#### Phase 3: Cleanup (Optional)

- Remove feature flags once features are stable
- Remove debug pages (`/admin/debug-resend`) if no longer needed
- Update documentation

## Key Files to Modify

1. `lib/email/service.tsx` - Add feature flag checks
2. `app/api/admin/broadcast/route.ts` - Add feature flag check
3. `app/admin/broadcast/page.tsx` - Add disabled state UI
4. `app/signup/page.tsx` - Conditionally call add-contact API
5. `app/api/webhooks/stripe/route.ts` - Add feature flag check
6. `DEPLOYMENT.md` - Document new environment variables

## Risk Mitigation

- Feature flags allow safe rollback without code changes
- Purchase confirmation emails work independently of contact addition
- All email failures are logged but don't block critical flows
- Graceful degradation when features are disabled

### To-dos

- [ ] Add feature flag checks in lib/email/service.tsx for addContactToResend() and sendBroadcastToAudience() functions
- [ ] Add feature flag check in app/api/admin/broadcast/route.ts to return 503 when disabled
- [ ] Add disabled state UI in app/admin/broadcast/page.tsx when feature flag is off
- [ ] Add conditional check in app/signup/page.tsx to skip add-contact API call when feature flag is disabled
- [ ] Add feature flag check in app/api/webhooks/stripe/route.ts before calling addContactToResend()
- [ ] Update DEPLOYMENT.md with new environment variables (ENABLE_RESEND_CONTACT_ADDITION, ENABLE_BROADCAST_FEATURE)
- [ ] Verify 20250128000000_add_webhook_events_and_email_sent_at.sql migration has been run in production database
- [ ] Test purchase confirmation emails, feature flags, and error handling in preview environment