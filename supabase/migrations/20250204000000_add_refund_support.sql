-- Add refund support to payments table
-- Expand status check constraint to include new statuses
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check 
  CHECK (status = ANY (ARRAY['succeeded'::text, 'pending'::text, 'failed'::text, 'refunded'::text, 'partial_refund'::text, 'cash'::text]));

-- Add RLS policy for admins to view all payments (required for roster management)
DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
CREATE POLICY "Admins can view all payments" ON payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.email LIKE '%@thelacrosselab.com'
    )
  );

-- Add RLS policy for admins to insert payments (for cash/manual registrations)
DROP POLICY IF EXISTS "Admins can insert payments" ON payments;
CREATE POLICY "Admins can insert payments" ON payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.email LIKE '%@thelacrosselab.com'
    )
  );

-- Add RLS policy for admins to update payments (for refunds)
DROP POLICY IF EXISTS "Admins can update payments" ON payments;
CREATE POLICY "Admins can update payments" ON payments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.email LIKE '%@thelacrosselab.com'
    )
  );

-- Add RLS policy for admins to insert payment_athletes
DROP POLICY IF EXISTS "Admins can insert payment athletes" ON payment_athletes;
CREATE POLICY "Admins can insert payment athletes" ON payment_athletes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.email LIKE '%@thelacrosselab.com'
    )
  );

-- Add RLS policy for admins to update payment_athletes (for refunds)
DROP POLICY IF EXISTS "Admins can update payment athletes" ON payment_athletes;
CREATE POLICY "Admins can update payment athletes" ON payment_athletes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.email LIKE '%@thelacrosselab.com'
    )
  );

-- Add stripe_refund_id to track Stripe refunds
ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT;

-- Add refunded_at timestamp to payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE;

-- Add refunded_at to payment_athletes for granular (line-item) refunds
ALTER TABLE payment_athletes ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE;

-- Add stripe_refund_id to payment_athletes for tracking individual refunds
ALTER TABLE payment_athletes ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT;

-- Create index for faster refund lookups
CREATE INDEX IF NOT EXISTS idx_payments_stripe_refund_id ON payments(stripe_refund_id);
CREATE INDEX IF NOT EXISTS idx_payment_athletes_refunded_at ON payment_athletes(refunded_at);

-- Create RPC function to process refund in a transaction
CREATE OR REPLACE FUNCTION process_refund(
  p_payment_athlete_ids UUID[],
  p_stripe_refund_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_athlete_id UUID;
  v_payment_id UUID;
  v_product_id UUID;
  v_quantity INTEGER;
  v_total_refunded INTEGER := 0;
  v_all_refunded BOOLEAN;
  v_refund_amount INTEGER := 0;
BEGIN
  -- Process each payment_athlete record
  FOREACH v_payment_athlete_id IN ARRAY p_payment_athlete_ids
  LOOP
    -- Get the payment_athlete details
    SELECT payment_id, product_id, quantity, unit_price_cents
    INTO v_payment_id, v_product_id, v_quantity, v_refund_amount
    FROM payment_athletes
    WHERE id = v_payment_athlete_id
      AND refunded_at IS NULL;

    IF NOT FOUND THEN
      CONTINUE; -- Skip if already refunded or not found
    END IF;

    -- Mark payment_athlete as refunded
    UPDATE payment_athletes
    SET refunded_at = NOW(),
        stripe_refund_id = p_stripe_refund_id
    WHERE id = v_payment_athlete_id;

    -- Restore stock quantity for the product
    UPDATE products
    SET stock_quantity = stock_quantity + v_quantity
    WHERE id = v_product_id;

    v_total_refunded := v_total_refunded + (v_refund_amount * v_quantity);
  END LOOP;

  -- Check if all payment_athletes for this payment are now refunded
  -- Get the payment_id from the first item
  SELECT payment_id INTO v_payment_id
  FROM payment_athletes
  WHERE id = p_payment_athlete_ids[1];

  IF v_payment_id IS NOT NULL THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM payment_athletes
      WHERE payment_id = v_payment_id
        AND refunded_at IS NULL
    ) INTO v_all_refunded;

    -- Update payment status based on refund completeness
    IF v_all_refunded THEN
      UPDATE payments
      SET status = 'refunded',
          refunded_at = NOW(),
          stripe_refund_id = p_stripe_refund_id
      WHERE id = v_payment_id;
    ELSE
      UPDATE payments
      SET status = 'partial_refund'
      WHERE id = v_payment_id
        AND status = 'succeeded';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'total_refunded_cents', v_total_refunded,
    'all_refunded', v_all_refunded
  );
END;
$$;

-- Create RPC function to add athlete to session without payment (cash/in-person)
CREATE OR REPLACE FUNCTION add_athlete_to_session_cash(
  p_athlete_id UUID,
  p_product_id UUID,
  p_user_id UUID,
  p_quantity INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_id UUID;
  v_payment_athlete_id UUID;
  v_price_cents INTEGER;
  v_stock_quantity INTEGER;
BEGIN
  -- Get product price and check stock
  SELECT price_cents, stock_quantity INTO v_price_cents, v_stock_quantity
  FROM products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found');
  END IF;

  IF v_stock_quantity < p_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient stock');
  END IF;

  -- Create payment record with 'cash' status
  INSERT INTO payments (
    user_id,
    amount,
    currency,
    status
  )
  VALUES (
    p_user_id,
    v_price_cents * p_quantity,
    'usd',
    'cash'
  )
  RETURNING id INTO v_payment_id;

  -- Create payment_athletes record
  INSERT INTO payment_athletes (
    payment_id,
    athlete_id,
    product_id,
    quantity,
    unit_price_cents
  )
  VALUES (
    v_payment_id,
    p_athlete_id,
    p_product_id,
    p_quantity,
    v_price_cents
  )
  RETURNING id INTO v_payment_athlete_id;

  -- Decrement stock quantity
  UPDATE products
  SET stock_quantity = stock_quantity - p_quantity
  WHERE id = p_product_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'payment_athlete_id', v_payment_athlete_id
  );
END;
$$;

