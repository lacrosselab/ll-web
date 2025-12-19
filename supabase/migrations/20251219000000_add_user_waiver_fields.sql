-- Add waiver fields to users table (per-user account, not per-athlete)
-- This enables a one-time waiver signing requirement before checkout

-- Add waiver tracking columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS waiver_signed BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS waiver_signed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS waiver_ip_address TEXT;

-- Create index for faster waiver status lookups during checkout
CREATE INDEX IF NOT EXISTS idx_users_waiver_signed ON users(waiver_signed);

-- Add column comments for documentation
COMMENT ON COLUMN users.waiver_signed IS 'Whether the user has signed the waiver/release form';
COMMENT ON COLUMN users.waiver_signed_at IS 'Timestamp when the waiver was signed';
COMMENT ON COLUMN users.waiver_ip_address IS 'IP address of the user when signing the waiver (for audit trail)';
