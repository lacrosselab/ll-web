-- Add session_time field to products table
ALTER TABLE products ADD COLUMN session_time TIME;

-- Set default time to midnight (00:00:00) for existing sessions
UPDATE products SET session_time = '00:00:00' WHERE session_time IS NULL;

-- Make the field NOT NULL with default
ALTER TABLE products ALTER COLUMN session_time SET NOT NULL;
ALTER TABLE products ALTER COLUMN session_time SET DEFAULT '00:00:00';
