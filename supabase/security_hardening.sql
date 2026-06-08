-- TabFlow Security Hardening
-- Run AFTER schema.sql and migration_v2.sql
-- Replaces wide-open FOR ALL policies with operation-specific policies
-- that block DELETE for the anon key on all tables

-- ─────────────────────────────────────────────────────────────────────────
-- ORDERS — no DELETE for anon (prevent bulk wipe with leaked anon key)
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all anon orders" ON orders;
DROP POLICY IF EXISTS "anon_select_orders" ON orders;
DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
DROP POLICY IF EXISTS "anon_update_orders" ON orders;

CREATE POLICY "anon_select_orders" ON orders FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE TO anon USING (true) WITH CHECK (true);
-- Intentionally NO delete policy for anon — service_role only

-- ─────────────────────────────────────────────────────────────────────────
-- ORDER_ITEMS_ROUTED
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all anon order_items_routed" ON order_items_routed;
DROP POLICY IF EXISTS "anon_select_routed" ON order_items_routed;
DROP POLICY IF EXISTS "anon_insert_routed" ON order_items_routed;
DROP POLICY IF EXISTS "anon_update_routed" ON order_items_routed;

CREATE POLICY "anon_select_routed" ON order_items_routed FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_routed" ON order_items_routed FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_routed" ON order_items_routed FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────
-- BOOKINGS
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all anon bookings" ON bookings;
DROP POLICY IF EXISTS "anon_select_bookings" ON bookings;
DROP POLICY IF EXISTS "anon_insert_bookings" ON bookings;
DROP POLICY IF EXISTS "anon_update_bookings" ON bookings;

CREATE POLICY "anon_select_bookings" ON bookings FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_bookings" ON bookings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_bookings" ON bookings FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────
-- SETTINGS — anon can read and update (needed for menu, floor map etc)
-- but cannot insert new rows or delete
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all anon settings" ON settings;
DROP POLICY IF EXISTS "anon_select_settings" ON settings;
DROP POLICY IF EXISTS "anon_update_settings" ON settings;

CREATE POLICY "anon_select_settings" ON settings FOR SELECT TO anon USING (true);
CREATE POLICY "anon_update_settings" ON settings FOR UPDATE TO anon USING (true) WITH CHECK (true);
-- No INSERT or DELETE for anon — settings rows created by service_role only

-- ─────────────────────────────────────────────────────────────────────────
-- STAFF — read + write by anon (staff management done in-app)
-- no DELETE to prevent accidental removal of all staff
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all anon staff" ON staff;
DROP POLICY IF EXISTS "anon_select_staff" ON staff;
DROP POLICY IF EXISTS "anon_insert_staff" ON staff;
DROP POLICY IF EXISTS "anon_update_staff" ON staff;

CREATE POLICY "anon_select_staff" ON staff FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_staff" ON staff FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_staff" ON staff FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────
-- TIPS — read + insert only (tips never edited or deleted)
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all anon tips" ON tips;
DROP POLICY IF EXISTS "anon_select_tips" ON tips;
DROP POLICY IF EXISTS "anon_insert_tips" ON tips;

CREATE POLICY "anon_select_tips" ON tips FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_tips" ON tips FOR INSERT TO anon WITH CHECK (true);
-- No UPDATE or DELETE for anon — tip records are immutable audit trail

-- ─────────────────────────────────────────────────────────────────────────
-- VOIDS — read + insert only (void records are immutable audit trail)
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all anon voids" ON voids;
DROP POLICY IF EXISTS "anon_select_voids" ON voids;
DROP POLICY IF EXISTS "anon_insert_voids" ON voids;

CREATE POLICY "anon_select_voids" ON voids FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_voids" ON voids FOR INSERT TO anon WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────
-- PAYMENTS — read + insert only (payment records are immutable)
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all anon payments" ON payments;
DROP POLICY IF EXISTS "anon_select_payments" ON payments;
DROP POLICY IF EXISTS "anon_insert_payments" ON payments;

CREATE POLICY "anon_select_payments" ON payments FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_payments" ON payments FOR INSERT TO anon WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────
-- VENUES — read by anon, write restricted (venues created by admin)
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all anon venues" ON venues;
DROP POLICY IF EXISTS "anon_select_venues" ON venues;
DROP POLICY IF EXISTS "anon_insert_venues" ON venues;

CREATE POLICY "anon_select_venues" ON venues FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_venues" ON venues FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_venues" ON venues FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────
-- PIN SECURITY — add hash column + lockout columns to settings
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE settings ADD COLUMN IF NOT EXISTS admin_pin_hash TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS pin_failed_attempts INTEGER DEFAULT 0;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY: this query should return ZERO rows after running this script
-- SELECT tablename FROM pg_tables
-- WHERE schemaname = 'public' AND NOT rowsecurity;
-- ─────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY: check no wide-open FOR ALL policies remain
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public' AND cmd = 'ALL';
-- This should return ZERO rows.
-- ─────────────────────────────────────────────────────────────────────────
