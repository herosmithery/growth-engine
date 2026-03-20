-- Google Calendar Integration Migration
-- Run this in Supabase SQL Editor after supabase_stripe_migration.sql

-- ─────────────────────────────────────────────
-- 1. Google Calendar columns on businesses
-- ─────────────────────────────────────────────
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS google_calendar_tokens JSONB,
  ADD COLUMN IF NOT EXISTS google_calendar_id TEXT DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS google_calendar_connected BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS google_calendar_sync_enabled BOOLEAN DEFAULT FALSE;

-- ─────────────────────────────────────────────
-- 2. Google Calendar columns on appointments
-- ─────────────────────────────────────────────
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS google_event_id TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_synced BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_appointments_google_event ON appointments(google_event_id);

-- ─────────────────────────────────────────────
-- 3. Calendar sync log (queue + audit trail)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  sync_direction TEXT NOT NULL CHECK (sync_direction IN ('to_google', 'from_google')),
  sync_action TEXT NOT NULL CHECK (sync_action IN ('create', 'update', 'delete')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  google_event_id TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_calendar_sync_log_business ON calendar_sync_log(business_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_log_appointment ON calendar_sync_log(appointment_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_log_pending ON calendar_sync_log(status) WHERE status = 'pending';

ALTER TABLE calendar_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage calendar_sync_log" ON calendar_sync_log
  FOR ALL USING (is_admin());

CREATE POLICY "Users view own calendar_sync_log" ON calendar_sync_log
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
      UNION
      SELECT business_id FROM user_businesses WHERE user_id = auth.uid()
    )
  );
