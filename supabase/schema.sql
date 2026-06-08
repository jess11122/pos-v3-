-- TabFlow POS Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Settings (single row per venue)
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_name TEXT NOT NULL DEFAULT 'My Venue',
  table_count INTEGER NOT NULL DEFAULT 10,
  admin_pin TEXT NOT NULL DEFAULT '1234',
  floor_map JSONB DEFAULT '{"tables": []}',
  menu_items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Waiter',
  colour TEXT NOT NULL DEFAULT '#d97706',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  table_number INTEGER NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  note TEXT,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'complete')),
  tab_closed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  payment_method TEXT,
  id_checked BOOLEAN NOT NULL DEFAULT FALSE,
  allergy_checked BOOLEAN NOT NULL DEFAULT FALSE,
  allergens JSONB DEFAULT '[]',
  staff_name TEXT,
  staff_colour TEXT
);

-- Order items routed to bar or kitchen
CREATE TABLE IF NOT EXISTS order_items_routed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('food', 'drink')),
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'making', 'ready', 'complete')),
  routed_to TEXT NOT NULL CHECK (routed_to IN ('bar', 'kitchen')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 2,
  table_preference TEXT,
  occasion TEXT,
  dietary_notes TEXT,
  special_requests TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'arrived', 'no_show', 'cancelled')),
  deposit_paid BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  marketing_email BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_sms BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_phone BOOLEAN NOT NULL DEFAULT FALSE
);

-- Tips (separate from orders)
CREATE TABLE IF NOT EXISTS tips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_number INTEGER NOT NULL,
  staff_name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_tab_closed ON orders(tab_closed);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_table_number ON orders(table_number);
CREATE INDEX IF NOT EXISTS idx_order_items_routed_order_id ON order_items_routed(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_routed_status ON order_items_routed(status);
CREATE INDEX IF NOT EXISTS idx_order_items_routed_to ON order_items_routed(routed_to);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_tips_created_at ON tips(created_at);
CREATE INDEX IF NOT EXISTS idx_tips_staff_name ON tips(staff_name);

-- Enable Row Level Security (configure policies per your auth setup)
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items_routed ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tips ENABLE ROW LEVEL SECURITY;

-- Open policies for anon access (tablet-based POS — no user auth)
-- In production, restrict to your venue's IP or use Supabase service role key
CREATE POLICY "Allow all anon settings" ON settings FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Allow all anon staff" ON staff FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Allow all anon orders" ON orders FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Allow all anon routed" ON order_items_routed FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Allow all anon bookings" ON bookings FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Allow all anon tips" ON tips FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

-- Enable Realtime on key tables
-- Run in Supabase Dashboard > Database > Replication > Tables
-- Or via SQL:
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items_routed;

-- Sample staff data (optional, delete before production)
-- INSERT INTO staff (name, role, colour, active) VALUES
--   ('Alice', 'Waiter', '#16a34a', TRUE),
--   ('Bob', 'Bartender', '#d97706', TRUE),
--   ('Charlie', 'Kitchen', '#dc2626', TRUE);
