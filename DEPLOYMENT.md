# Lacrosse Lab - Production Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Setup
- [ ] Copy `.env.production.local.template` to `.env.production.local`
- [ ] Fill in all production environment variables
- [ ] Verify all API keys are production keys (not test keys)
- [ ] Set `NODE_ENV=production`

### 2. Database Setup
- [ ] Run all SQL migration scripts in production Supabase:
  - `scripts/001-create-tables.sql`
  - `scripts/002-create-functions.sql`
  - `scripts/007-simple-rls-fix.sql`
  - `scripts/008-add-customer-id-to-users.sql`
  - `scripts/009-cart-and-stock-management.sql`
  - `scripts/010-remove-session-id-from-cart.sql`
  - `scripts/011-performance-optimizations.sql`
  - `scripts/013-revert-all-rls-policies.sql`
- [ ] Verify RLS policies are properly configured
- [ ] Test database connections

### 3. Stripe Configuration
- [ ] Set up production Stripe webhook endpoint: `https://your-domain.com/api/webhooks/stripe`
- [ ] Configure webhook events: `checkout.session.completed`, `payment_intent.succeeded`
- [ ] Test webhook signature verification
- [ ] Verify tax codes are set (`txcd_20030000` for services)

### 4. Security Verification
- [ ] Admin email check is working (`@thelacrosselab.com` only)
- [ ] Security headers are configured
- [ ] No dangerous Next.js config settings
- [ ] Environment variables are secure

## Build and Deploy

### 1. Build the Application
```bash
# Install dependencies
pnpm install

# Run production build
pnpm build

# Test the build locally
pnpm start
```

### 2. Deploy to Production
- Deploy to your hosting platform (Vercel, Netlify, etc.)
- Ensure environment variables are set in production
- Verify the deployment is successful

### 3. Post-Deployment Testing
- [ ] Test health check endpoint: `/api/health`
- [ ] Test user registration and login
- [ ] Test athlete creation and management
- [ ] Test cart functionality
- [ ] Test checkout process
- [ ] Test admin functionality
- [ ] Test webhook functionality
- [ ] Test responsive design on mobile

## Monitoring Setup

### 1. Error Monitoring
- Set up Sentry or similar error monitoring service
- Configure alerts for critical errors
- Monitor error rates and performance

### 2. Uptime Monitoring
- Set up UptimeRobot, Pingdom, or similar
- Monitor key endpoints: `/`, `/api/health`
- Set up alerts for downtime

### 3. Analytics
- Verify Google Analytics is working
- Set up Stripe dashboard monitoring
- Monitor key metrics and conversions

## Rollback Procedure

If issues occur after deployment:

1. **Immediate Rollback**
   - Revert to previous deployment version
   - Check error logs and monitoring
   - Notify users if necessary

2. **Investigation**
   - Review error logs
   - Check environment variables
   - Verify external service status (Stripe, Supabase)

3. **Fix and Redeploy**
   - Fix identified issues
   - Test thoroughly in staging
   - Deploy fix to production

## Emergency Contacts

- **Stripe Support**: [Stripe Dashboard Support](https://dashboard.stripe.com/support)
- **Supabase Support**: [Supabase Support](https://supabase.com/support)
- **Hosting Provider**: [Your hosting provider support]

## Environment Variables Reference

### Required Variables
- `NEXT_PUBLIC_SUPABASE_URL`: Production Supabase URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Production Supabase anon key
- `SUPABASE_SECRET_KEY`: Production Supabase service role key
- `STRIPE_SECRET_KEY`: Production Stripe secret key (sk_live_...)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Production Stripe publishable key (pk_live_...)
- `STRIPE_WEBHOOK_SECRET`: Production Stripe webhook secret
- `RESEND_API_KEY`: Resend API key for sending emails
- `RESEND_SEGMENT_ID`: Resend segment UUID for adding contacts to the segment. Can be found in your Resend dashboard under Audiences/Segments. Required for adding customers to the segment on signup and purchase. This is the segment ID used with `resend.contacts.segments.add()`.
- `NEXT_PUBLIC_SITE_URL`: Production site URL
- `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`: Production auth callback URL

### Optional Variables
- `GOOGLE_SITE_VERIFICATION`: Google Search Console verification
- `SENTRY_DSN`: Error monitoring service DSN
- `NODE_ENV`: Set to "production"
- `RESEND_FROM_EMAIL`: Email address to send from (defaults to `noreply@thelacrosselab.com`)
- `ENABLE_DEBUG_LOGS`: Set to `"true"` to enable debug logging in production (defaults to development only)
- `ENABLE_PII_LOGS`: Set to `"true"` to include full email addresses in logs (defaults to masked emails for privacy)
- `ENABLE_RESEND_CONTACT_ADDITION`: Set to `"true"` to enable adding contacts to Resend audience on signup and purchase. Defaults to disabled (`false`). When disabled, contacts are not added to Resend but purchase confirmation emails still work.
- `ENABLE_BROADCAST_FEATURE`: Set to `"true"` to enable the broadcast email feature for admins. Defaults to disabled (`false`). When disabled, the `/admin/broadcast` page will show a disabled state.

## Email Service Configuration

### Required Environment Variables
- `RESEND_API_KEY`: Resend API key for sending emails
- `RESEND_SEGMENT_ID`: Resend segment UUID for adding contacts to the segment. This is used when customers sign up or make a purchase to automatically add them to your Resend segment using `resend.contacts.segments.add()`. Can be found in your Resend dashboard under Audiences/Segments. Only required if `ENABLE_RESEND_CONTACT_ADDITION=true`.
- `RESEND_FROM_EMAIL`: (Optional) Email address to send from. Defaults to `noreply@thelacrosselab.com` if not set.

### Feature Flags
- `ENABLE_RESEND_CONTACT_ADDITION`: Set to `"true"` to enable adding contacts to Resend audience on signup and purchase. When disabled (`false`), contacts are not added to Resend but purchase confirmation emails still work. Defaults to `false` for initial deployment.
- `ENABLE_BROADCAST_FEATURE`: Set to `"true"` to enable the broadcast email feature for admins at `/admin/broadcast`. When disabled (`false`), the broadcast UI shows a disabled state and API returns 503. Defaults to `false` for initial deployment.

### Logging Configuration
- `ENABLE_DEBUG_LOGS`: Set to `"true"` to enable debug-level logging in production. By default, debug logs are only enabled in development mode.
- `ENABLE_PII_LOGS`: Set to `"true"` to include full email addresses in logs. By default, email addresses are masked (e.g., `t**t@example.com`) to protect privacy. Only enable this for debugging purposes.

### Operational Notes
- **Retry Behavior**: Email sends use exponential backoff retry with 3 attempts, 300ms base delay, and 8 second timeout per request.
- **Rate Limiting**: Broadcast emails are sent in batches of 10 with 1 second delay between batches to respect Resend rate limits.
- **Error Handling**: Email failures are logged but do not block payment processing or user signup flows.
- **Structured Logging**: All email operations use structured logging with trace IDs for observability. Logs include masked email addresses, batch information, and error details.

## Security Notes

- All admin routes require `@thelacrosselab.com` email addresses
- Security headers are configured in `next.config.mjs`
- Environment variables are properly secured
- No dangerous build settings are enabled
- Email addresses in logs are masked by default to protect user privacy
