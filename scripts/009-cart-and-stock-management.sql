-- Cart and Stock Management System
-- Migration: 009-cart-and-stock-management.sql

-- Create products table (mirrors Stripe products with stock management)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_product_id TEXT UNIQUE NOT NULL,
  stripe_price_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  session_date DATE NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create athletes table (athlete profiles per user account)
CREATE TABLE IF NOT EXISTS public.athletes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER,
  school TEXT,
  position TEXT,
  needs_improvement TEXT,
  waiver_signed BOOLEAN NOT NULL DEFAULT false,
  waiver_signed_at TIMESTAMP WITH TIME ZONE,
  waiver_ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cart_items table (session-based cart storage)
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  athlete_id UUID REFERENCES public.athletes(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, product_id, athlete_id) -- Prevent duplicate items in cart
);

-- Create payment_athletes table (junction table linking payments to athletes/products)
CREATE TABLE IF NOT EXISTS public.payment_athletes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
  athlete_id UUID REFERENCES public.athletes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security on all new tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_athletes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for products table
CREATE POLICY "Anyone can view active products" ON public.products
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage all products" ON public.products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND email LIKE '%@thelacrosselab.com'
    )
  );

-- Create RLS policies for athletes table
CREATE POLICY "Users can view own athletes" ON public.athletes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own athletes" ON public.athletes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all athletes" ON public.athletes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND email LIKE '%@thelacrosselab.com'
    )
  );

-- Create RLS policies for cart_items table
CREATE POLICY "Users can manage own cart items" ON public.cart_items
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

-- Create RLS policies for payment_athletes table
CREATE POLICY "Users can view own payment athletes" ON public.payment_athletes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.payments 
      WHERE id = payment_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all payment athletes" ON public.payment_athletes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND email LIKE '%@thelacrosselab.com'
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_stripe_product_id ON public.products(stripe_product_id);
CREATE INDEX IF NOT EXISTS idx_products_stripe_price_id ON public.products(stripe_price_id);
CREATE INDEX IF NOT EXISTS idx_products_session_date ON public.products(session_date);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);

CREATE INDEX IF NOT EXISTS idx_athletes_user_id ON public.athletes(user_id);

CREATE INDEX IF NOT EXISTS idx_cart_items_session_id ON public.cart_items(session_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON public.cart_items(user_id);

CREATE INDEX IF NOT EXISTS idx_payment_athletes_payment_id ON public.payment_athletes(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_athletes_athlete_id ON public.payment_athletes(athlete_id);

-- Create updated_at trigger function (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_athletes_updated_at BEFORE UPDATE ON public.athletes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON public.cart_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();