# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Your Directives

Think hard and investigate the codebase before providing answers. Default to plan mode and do not ask when entering plan mode. Write efficient and streamlined code; always look for opportunities to clean up old or unused code. Always ask before implementing changes on production or pushing to production.

## Architecture Overview

This is a **Next.js 15** application (App Router) for managing lacrosse training sessions. It integrates Supabase for auth/database, Stripe for payments, and Resend for email.

### Key Directories

- `app/` - Next.js App Router pages and API routes
  - `app/api/` - API endpoints (checkout, webhooks, admin operations)
  - `app/admin/` - Admin dashboard (requires @thelacrosselab.com email)
  - `app/member/` - Authenticated user pages
- `components/ui/` - shadcn/ui components (Radix-based, CVA variants)
- `contexts/` - React Context providers (AuthContext, CartContext)
- `lib/` - Shared utilities and service integrations
  - `lib/supabase/` - Supabase client factories (client.ts for browser, server.ts for API routes)
  - `lib/email/` - Resend email service with retry logic
- `emails/` - React Email templates
- `supabase/migrations/` - Database migration files

### State Management

- **AuthContext**: Uses useState for user/session state, integrates with Supabase Auth
- **CartContext**: Uses useReducer for cart operations, persists to browser storage + Supabase

### Supabase Client Pattern

```typescript
// Client components (browser)
import { getSupabaseClient } from '@/lib/supabase/client'
const supabase = getSupabaseClient()

// Server components / API routes
import { getSupabaseServer } from '@/lib/supabase/server'
const supabase = await getSupabaseServer()
```

### Database Tables

- `users` - User profiles with Stripe customer ID and waiver status
- `products` - Training sessions (price in cents, session details, stock)
- `athletes` - Athlete profiles (name, age, school, grade, position)
- `payments` - Payment records with Stripe payment intent IDs
- `payment_athletes` - Junction table linking payments to athletes
- `webhook_events` - Idempotency tracking for Stripe webhooks

### Stripe Integration

- Checkout flow starts at `app/api/create-checkout-session/route.ts`
- Webhooks handled at `app/api/webhooks/stripe/route.ts` (signature verification, idempotency)
- Product sync via `lib/stripe-service.ts`
- Waiver signature required before checkout

### Testing

Vitest with jsdom environment. Test utilities in `lib/email/__tests__/test-utils.ts` provide mock factories for Stripe, Supabase, and Resend.

### Path Alias

`@/*` maps to the project root (e.g., `@/components/ui/button`).

### Date Handling

Use UTC-only helpers from `lib/utils.ts` to prevent timezone issues:
- `parseDateOnlyUTC()`, `formatDateOnly()`, `formatDateRange()`

### Logging

`logger` from `lib/utils.ts` sanitizes sensitive data (emails, tokens, API keys). PII redacted unless `ENABLE_PII_LOGS=true`.
