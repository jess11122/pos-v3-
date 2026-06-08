-- TabFlow v2 Migration
-- Run this in Supabase SQL Editor AFTER the original schema.sql

-- ─────────────────────────────────────────────
-- FEATURE 9: Multi-venue support
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add venue_id to all tables (nullable for backwards compat with existing data)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id);
ALTER TABLE order_items_routed ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id);
ALTER TABLE tips ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id);

-- Indexes for venue filtering
CREATE INDEX IF NOT EXISTS idx_orders_venue_id ON orders(venue_id);
CREATE INDEX IF NOT EXISTS idx_bookings_venue_id ON bookings(venue_id);
CREATE INDEX IF NOT EXISTS idx_staff_venue_id ON staff(venue_id);
CREATE INDEX IF NOT EXISTS idx_tips_venue_id ON tips(venue_id);

-- RLS for venues
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all anon venues" ON venues FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

-- ─────────────────────────────────────────────
-- FEATURE 2: Voids / Refunds
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  amount NUMERIC(10,2) NOT NULL,
  reason TEXT NOT NULL,
  voided_by TEXT NOT NULL,
  venue_id UUID REFERENCES venues(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voids_order_id ON voids(order_id);
CREATE INDEX IF NOT EXISTS idx_voids_created_at ON voids(created_at);

ALTER TABLE voids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all anon voids" ON voids FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

-- Add voided_items column to orders so totals stay accurate
ALTER TABLE orders ADD COLUMN IF NOT EXISTS voided_amount NUMERIC(10,2) DEFAULT 0;

-- ─────────────────────────────────────────────
-- FEATURE 3: Split bill tracking
-- ─────────────────────────────────────────────
-- Splits are recorded as multiple payment records against one set of orders
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_number INTEGER NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  tip NUMERIC(10,2) NOT NULL DEFAULT 0,
  method TEXT NOT NULL,
  split_index INTEGER DEFAULT 1,
  split_total INTEGER DEFAULT 1,
  staff_name TEXT,
  venue_id UUID REFERENCES venues(id),
  order_ids JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_venue_id ON payments(venue_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all anon payments" ON payments FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

-- Enable realtime on new tables
ALTER PUBLICATION supabase_realtime ADD TABLE voids;

-- ─────────────────────────────────────────────
-- FEATURE 6: Happy Hour config in settings
-- ─────────────────────────────────────────────
ALTER TABLE settings ADD COLUMN IF NOT EXISTS happy_hour JSONB DEFAULT '{"enabled":false,"start":"17:00","end":"19:00","discount_percent":20,"categories":[]}'::jsonb;

-- ─────────────────────────────────────────────
-- FEATURE 7: SMS / Twilio credentials in settings
-- ─────────────────────────────────────────────
ALTER TABLE settings ADD COLUMN IF NOT EXISTS twilio JSONB DEFAULT '{}'::jsonb;

-- ─────────────────────────────────────────────
-- Enable realtime on settings so all devices pick up
-- happy hour / 86 toggle changes instantly
-- ─────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
