-- Add stripe_customer_id to users table for one-time payments
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
