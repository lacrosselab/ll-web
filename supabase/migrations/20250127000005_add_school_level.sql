-- Add school level field to products table
ALTER TABLE products 
ADD COLUMN is_high_school BOOLEAN DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN products.is_high_school IS 'True for high school sessions, false for middle school sessions, null if not specified';
