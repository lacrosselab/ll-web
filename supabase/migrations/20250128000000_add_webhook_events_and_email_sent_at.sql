-- Create webhook_events table for idempotency
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add email_sent_at column to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP WITH TIME ZONE;

-- Create index on stripe_event_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_event_id ON webhook_events(stripe_event_id);

-- Enable Row Level Security on webhook_events table
-- This aligns with the codebase pattern where all tables have RLS enabled
-- Service role (used by getSupabaseService()) bypasses RLS automatically
-- Authenticated users will be denied access via the explicit deny-all policy
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Explicit deny-all policy for authenticated users
-- This makes it clear that only service role should access this table
-- Service role bypasses RLS by design in Supabase, so webhook handler continues to work
CREATE POLICY "Deny all access to webhook_events" 
ON webhook_events 
FOR ALL 
USING (false);

-- Create RPC function to process payment in a transaction
CREATE OR REPLACE FUNCTION process_payment_webhook(
  p_stripe_payment_intent_id TEXT,
  p_user_id UUID,
  p_amount INTEGER,
  p_currency TEXT,
  p_line_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_id UUID;
  v_line_item JSONB;
  v_product_id UUID;
  v_athlete_id UUID;
  v_quantity INTEGER;
  v_unit_price_cents INTEGER;
  v_rows_affected INTEGER;
BEGIN
  -- Upsert payment record
  INSERT INTO payments (
    user_id,
    stripe_payment_intent_id,
    amount,
    currency,
    status
  )
  VALUES (
    p_user_id,
    p_stripe_payment_intent_id,
    p_amount,
    p_currency,
    'succeeded'
  )
  ON CONFLICT (stripe_payment_intent_id) 
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    amount = EXCLUDED.amount,
    currency = EXCLUDED.currency,
    status = EXCLUDED.status
  RETURNING id INTO v_payment_id;

  -- Process each line item
  FOR v_line_item IN SELECT * FROM jsonb_array_elements(p_line_items)
  LOOP
    v_product_id := (v_line_item->>'product_id')::UUID;
    v_athlete_id := (v_line_item->>'athlete_id')::UUID;
    v_quantity := (v_line_item->>'quantity')::INTEGER;
    v_unit_price_cents := (v_line_item->>'unit_price_cents')::INTEGER;

    -- Insert payment_athletes record if it doesn't exist
    INSERT INTO payment_athletes (
      payment_id,
      athlete_id,
      product_id,
      quantity,
      unit_price_cents
    )
    SELECT 
      v_payment_id,
      v_athlete_id,
      v_product_id,
      v_quantity,
      v_unit_price_cents
    WHERE NOT EXISTS (
      SELECT 1 FROM payment_athletes
      WHERE payment_id = v_payment_id
        AND athlete_id = v_athlete_id
        AND product_id = v_product_id
    );

    -- Check if row was inserted (GET DIAGNOSTICS returns number of rows affected)
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    -- Decrement stock with guard (only if stock is sufficient and record was newly created)
    IF v_rows_affected > 0 THEN
      UPDATE products
      SET stock_quantity = stock_quantity - v_quantity
      WHERE id = v_product_id
        AND stock_quantity >= v_quantity;
    END IF;
  END LOOP;

  RETURN v_payment_id;
END;
$$;

