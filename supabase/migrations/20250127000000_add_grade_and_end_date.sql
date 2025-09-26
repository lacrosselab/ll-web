-- Add grade field to athletes table
ALTER TABLE "public"."athletes" 
ADD COLUMN "grade" text;

-- Add end_date field to products table  
ALTER TABLE "public"."products" 
ADD COLUMN "end_date" date;

-- Add comments for documentation
COMMENT ON COLUMN "public"."athletes"."grade" IS 'Student grade level (K, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)';
COMMENT ON COLUMN "public"."products"."end_date" IS 'Optional end date for the session';
