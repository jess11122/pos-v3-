-- TabFlow v3 Migration — Premium Features
-- Run in Supabase SQL Editor

-- ─── New tables ────────────────────────────────────────────────────────────

-- Digital receipts
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number INTEGER,
  email TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  total NUMERIC(10,2) DEFAULT 0,
  tip NUMERIC(10,2) DEFAULT 0,
  payment_method TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  venue_name TEXT,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty stamp cards
CREATE TABLE IF NOT EXISTS loyalty_stamps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  stamp_count INTEGER DEFAULT 0,
  last_stamp TIMESTAMPTZ,
  reward_redeemed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allergen compliance log (Natasha's Law)
CREATE TABLE IF NOT EXISTS compliance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number INTEGER,
  staff_name TEXT,
  allergens TEXT[] DEFAULT '{}',
  items JSONB DEFAULT '[]'::jsonb,
  id_checked BOOLEAN DEFAULT false,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NPS survey responses
CREATE TABLE IF NOT EXISTS nps_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score INTEGER CHECK (score >= 0 AND score <= 10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── New columns on existing tables ────────────────────────────────────────

-- Add closing time to settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS closing_time TEXT;

-- Add white label config
ALTER TABLE settings ADD COLUMN IF NOT EXISTS white_label JSONB;

-- Add loyalty config
ALTER TABLE settings ADD COLUMN IF NOT EXISTS loyalty JSONB;

-- Add integrations config
ALTER TABLE settings ADD COLUMN IF NOT EXISTS integrations JSONB;

-- Add Anthropic API key (encrypted at rest via Supabase)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT;

-- Add completed_at to orders (for reorder query)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add payment_method to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- ─── RLS Policies for new tables ───────────────────────────────────────────

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_stamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_responses ENABLE ROW LEVEL SECURITY;

-- receipts: anon can select and insert (for receipt lookup), no delete
CREATE POLICY "receipts_select" ON receipts FOR SELECT TO anon USING (true);
CREATE POLICY "receipts_insert" ON receipts FOR INSERT TO anon WITH CHECK (true);

-- loyalty_stamps: anon can select, insert, update (upsert pattern), no delete
CREATE POLICY "loyalty_select" ON loyalty_stamps FOR SELECT TO anon USING (true);
CREATE POLICY "loyalty_insert" ON loyalty_stamps FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "loyalty_update" ON loyalty_stamps FOR UPDATE TO anon USING (true);

-- compliance_log: anon can insert and select, no delete
CREATE POLICY "compliance_select" ON compliance_log FOR SELECT TO anon USING (true);
CREATE POLICY "compliance_insert" ON compliance_log FOR INSERT TO anon WITH CHECK (true);

-- nps_responses: anon can insert only (anonymous)
CREATE POLICY "nps_insert" ON nps_responses FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "nps_select" ON nps_responses FOR SELECT TO anon USING (true);

-- ─── Indexes for performance ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_receipts_sent_at ON receipts(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_email ON receipts(email);
CREATE INDEX IF NOT EXISTS idx_loyalty_email ON loyalty_stamps(email);
CREATE INDEX IF NOT EXISTS idx_compliance_created ON compliance_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_completed_at ON orders(completed_at DESC);

-- ─── Realtime for new tables ────────────────────────────────────────────────
-- (Only if not already in publication)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'receipts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE receipts;
  END IF;
END $$;

-- ─── Verification ──────────────────────────────────────────────────────────
SELECT 'receipts' as tbl, COUNT(*) FROM receipts
UNION ALL SELECT 'loyalty_stamps', COUNT(*) FROM loyalty_stamps
UNION ALL SELECT 'compliance_log', COUNT(*) FROM compliance_log
UNION ALL SELECT 'nps_responses', COUNT(*) FROM nps_responses;
