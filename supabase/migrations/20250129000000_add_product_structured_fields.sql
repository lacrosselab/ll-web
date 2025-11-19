-- Add new structured fields to products table
ALTER TABLE products 
ADD COLUMN gender TEXT CHECK (gender IN ('boys', 'girls', 'co-ed')),
ADD COLUMN min_grade TEXT,
ADD COLUMN max_grade TEXT,
ADD COLUMN skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced'));

-- Add comments for documentation
COMMENT ON COLUMN products.gender IS 'Target gender: boys, girls, or co-ed';
COMMENT ON COLUMN products.min_grade IS 'Minimum grade level (K, 1-12)';
COMMENT ON COLUMN products.max_grade IS 'Maximum grade level (K, 1-12)';
COMMENT ON COLUMN products.skill_level IS 'Skill level: beginner, intermediate, or advanced';

-- Create product_sessions table for multiple session times
CREATE TABLE IF NOT EXISTS product_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    session_time TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_product_sessions_product_id ON product_sessions(product_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_product_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_product_sessions_updated_at
    BEFORE UPDATE ON product_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_product_sessions_updated_at();

-- Migrate existing session_date and session_time data to product_sessions
-- This creates one session per product from the existing data
INSERT INTO product_sessions (product_id, session_date, session_time)
SELECT 
    id as product_id,
    session_date,
    COALESCE(session_time, '00:00:00'::TIME) as session_time
FROM products
WHERE session_date IS NOT NULL;

-- Enable Row Level Security on product_sessions table
ALTER TABLE product_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to view product_sessions for active products
-- This matches the pattern used for the products table
CREATE POLICY "Anyone can view product_sessions for active products" 
ON product_sessions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.id = product_sessions.product_id 
    AND products.is_active = true
  )
);

-- Create policies to allow admins to manage product_sessions
-- This matches the pattern used for the products table (see 20250926113900_remote_schema.sql)
CREATE POLICY "Admins can manage all product_sessions" 
ON product_sessions 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() 
    AND users.email ~~ '%@thelacrosselab.com'::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() 
    AND users.email ~~ '%@thelacrosselab.com'::text
  )
);

