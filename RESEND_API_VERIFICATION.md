# Resend API Calls Verification

## Summary
All Resend API calls have been verified for correct parameters and server-side usage.

## Fixed Issues

### ✅ Fixed: `app/api/resend/list-contacts/route.ts`
- **Issue**: Missing required `audienceId` parameter in `contacts.list()` call
- **Fix**: Added `audienceId: RESEND_AUDIENCE_ID` parameter
- **Status**: Fixed and verified

## Verified Resend API Calls

### 1. `lib/email/service.tsx`

#### ✅ `emails.send()` (Lines 60, 979, 1224)
- **Parameters**: `{ from, to, subject, html }`
- **Status**: ✅ Correct - Matches `CreateEmailOptions` SDK type
- **Server-side**: ✅ Yes (service function)

#### ✅ `contacts.create()` (Line 417)
- **Parameters**: `{ email, unsubscribed, audienceId }`
- **Status**: ✅ Correct - Matches `CreateContactOptions` SDK type
- **Server-side**: ✅ Yes (service function)

#### ⚠️ `contacts.segments.add()` (Lines 660, 675, 684)
- **Parameters**: `{ contactId, segmentId }` or `{ email, segmentId }`
- **Status**: ⚠️ Undocumented API (not in SDK types, but working in production)
- **Server-side**: ✅ Yes (service function)
- **Note**: This API is functional but not documented in the SDK types

#### ✅ `broadcasts.create()` (Line 1084)
- **Parameters**: `{ audienceId, from, subject, html }`
- **Status**: ✅ Correct - Matches `CreateBroadcastOptions` SDK type
- **Server-side**: ✅ Yes (service function)

#### ✅ `broadcasts.send()` (Line 1111)
- **Parameters**: `broadcastId` (string)
- **Status**: ✅ Correct - Matches SDK signature `send(id: string)`
- **Server-side**: ✅ Yes (service function)

#### ⚠️ `segments.list()` (Line 217)
- **Parameters**: `{ limit: 10 }`
- **Status**: ⚠️ Undocumented API (not in SDK types, but working)
- **Server-side**: ✅ Yes (service function)
- **Note**: Kept as-is per plan requirements

### 2. `app/api/resend/add-contact/route.ts`
- **Method**: Uses service function `addContactToResend()`
- **Status**: ✅ Correct - Delegates to service layer
- **Server-side**: ✅ Yes (API route, no "use client")

### 3. `app/api/resend/list-contacts/route.ts`
- **Method**: `contacts.list({ audienceId })`
- **Status**: ✅ Fixed - Now includes required `audienceId` parameter
- **Server-side**: ✅ Yes (API route, no "use client")

### 4. `app/api/resend/list-segments/route.ts`
- **Method**: `segments.list({ limit: 10 })`
- **Status**: ⚠️ Undocumented API (kept as-is per plan)
- **Server-side**: ✅ Yes (API route, no "use client")

### 5. `scripts/backfill-resend-audience.js`
- **Method**: `contacts.segments.add({ email, segmentId })`
- **Status**: ⚠️ Undocumented API (but working)
- **Server-side**: ✅ Yes (Node.js script)

## Server-Side Verification

✅ **All Resend API calls are server-side only**
- No "use client" directives in API routes
- All calls use `getResend()` which requires server-side environment variables
- Client-side code only makes HTTP requests to API routes, never directly calls Resend

## Undocumented APIs

The following APIs are used but not documented in the Resend SDK TypeScript definitions:
1. `contacts.segments.add()` - Used for adding contacts to segments
2. `segments.list()` - Used for listing segments

These APIs are functional in production but may not have full TypeScript support. They are accessed via `as any` type assertions where needed.

## Recommendations

1. ✅ **Completed**: Fixed `contacts.list()` to include required `audienceId` parameter
2. ⚠️ **Monitor**: Keep an eye on undocumented APIs (`contacts.segments.add`, `segments.list`) for potential SDK updates
3. ✅ **Verified**: All Resend calls are server-side only - no security concerns

