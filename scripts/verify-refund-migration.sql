-- Verification script for refund support migration
-- Run this after applying 20250204000000_add_refund_support.sql

-- 1. Check constraint was updated to include new statuses
SELECT 'Constraint Check' as test,
       CASE WHEN pg_get_constraintdef(oid) LIKE '%refunded%' 
            AND pg_get_constraintdef(oid) LIKE '%partial_refund%'
            AND pg_get_constraintdef(oid) LIKE '%cash%'
       THEN 'PASS' ELSE 'FAIL' END as result,
       pg_get_constraintdef(oid) as details
FROM pg_constraint 
WHERE conname = 'payments_status_check';

-- 2. Check new columns exist on payments table
SELECT 'payments.stripe_refund_id' as test,
       CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM information_schema.columns 
WHERE table_name = 'payments' AND column_name = 'stripe_refund_id';

SELECT 'payments.refunded_at' as test,
       CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM information_schema.columns 
WHERE table_name = 'payments' AND column_name = 'refunded_at';

-- 3. Check new columns exist on payment_athletes table
SELECT 'payment_athletes.stripe_refund_id' as test,
       CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM information_schema.columns 
WHERE table_name = 'payment_athletes' AND column_name = 'stripe_refund_id';

SELECT 'payment_athletes.refunded_at' as test,
       CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM information_schema.columns 
WHERE table_name = 'payment_athletes' AND column_name = 'refunded_at';

-- 4. Check RPC functions exist
SELECT 'process_refund function' as test,
       CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM pg_proc WHERE proname = 'process_refund';

SELECT 'add_athlete_to_session_cash function' as test,
       CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM pg_proc WHERE proname = 'add_athlete_to_session_cash';

-- 5. Check indexes exist
SELECT 'idx_payments_stripe_refund_id' as test,
       CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM pg_indexes WHERE indexname = 'idx_payments_stripe_refund_id';

SELECT 'idx_payment_athletes_refunded_at' as test,
       CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM pg_indexes WHERE indexname = 'idx_payment_athletes_refunded_at';

-- 6. Check RLS policies exist
SELECT policyname as test, 'EXISTS' as result
FROM pg_policies 
WHERE tablename IN ('payments', 'payment_athletes') 
  AND policyname LIKE 'Admins%'
ORDER BY tablename, policyname;

-- Summary
SELECT '=== MIGRATION VERIFICATION COMPLETE ===' as message;

