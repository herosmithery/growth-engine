-- RLS Policies — Run this in Supabase SQL Editor
-- Allows authenticated users to read their own business data in the dashboard.
-- Safe to run multiple times (DROP IF EXISTS before each CREATE).

-- Helper: get business_id from the logged-in user's JWT metadata
-- Works for both user_metadata.business_id and checks admin role

-- ─────────────────────────────────────────────
-- call_logs
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own business call_logs" ON call_logs;
CREATE POLICY "Users can read own business call_logs"
  ON call_logs FOR SELECT
  USING (
    business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin')
  );

-- ─────────────────────────────────────────────
-- appointments
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own business appointments" ON appointments;
CREATE POLICY "Users can read own business appointments"
  ON appointments FOR SELECT
  USING (
    business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "Users can insert own business appointments" ON appointments;
CREATE POLICY "Users can insert own business appointments"
  ON appointments FOR INSERT
  WITH CHECK (
    business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin')
  );

-- ─────────────────────────────────────────────
-- clients
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own business clients" ON clients;
CREATE POLICY "Users can read own business clients"
  ON clients FOR SELECT
  USING (
    business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin')
  );

-- ─────────────────────────────────────────────
-- messages
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own business messages" ON messages;
CREATE POLICY "Users can read own business messages"
  ON messages FOR SELECT
  USING (
    business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin')
  );

-- ─────────────────────────────────────────────
-- follow_ups
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own business follow_ups" ON follow_ups;
CREATE POLICY "Users can read own business follow_ups"
  ON follow_ups FOR SELECT
  USING (
    business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin')
  );

-- ─────────────────────────────────────────────
-- reviews
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own business reviews" ON reviews;
CREATE POLICY "Users can read own business reviews"
  ON reviews FOR SELECT
  USING (
    business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin')
  );

-- ─────────────────────────────────────────────
-- campaigns
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own business campaigns" ON campaigns;
CREATE POLICY "Users can read own business campaigns"
  ON campaigns FOR SELECT
  USING (
    business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin')
  );

-- ─────────────────────────────────────────────
-- leads
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own business leads" ON leads;
CREATE POLICY "Users can read own business leads"
  ON leads FOR SELECT
  USING (
    business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin')
  );

-- ─────────────────────────────────────────────
-- businesses (read own)
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own business" ON businesses;
CREATE POLICY "Users can read own business"
  ON businesses FOR SELECT
  USING (
    id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
    OR owner_id = auth.uid()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "Users can update own business" ON businesses;
CREATE POLICY "Users can update own business"
  ON businesses FOR UPDATE
  USING (
    id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
    OR owner_id = auth.uid()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin')
  );

-- ─────────────────────────────────────────────
-- calendar_sync_log
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own calendar_sync_log" ON calendar_sync_log;
CREATE POLICY "Users can read own calendar_sync_log"
  ON calendar_sync_log FOR SELECT
  USING (
    business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin')
  );
