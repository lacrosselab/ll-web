-- Add location column to product_sessions table
ALTER TABLE product_sessions 
ADD COLUMN location TEXT;

-- Add index for efficient queries
CREATE INDEX idx_product_sessions_location ON product_sessions(location);

-- Add comment for documentation
COMMENT ON COLUMN product_sessions.location IS 'Session location address (e.g., "3006 Impala Place, Unit B, Henrico, VA 23228")';

