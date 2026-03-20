-- Schema Patch — Run this in Supabase SQL Editor
-- Adds all columns the Vapi webhook requires that are missing from the live DB.
-- Safe to run multiple times (IF NOT EXISTS on everything).

-- ─────────────────────────────────────────────
-- businesses
-- ─────────────────────────────────────────────
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS vapi_phone_number TEXT,
  ADD COLUMN IF NOT EXISTS vapi_assistant_id TEXT,
  ADD COLUMN IF NOT EXISTS vapi_phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS niche_type TEXT,
  ADD COLUMN IF NOT EXISTS business_hours JSONB;

-- ─────────────────────────────────────────────
-- clients
-- ─────────────────────────────────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS last_visit_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS tags TEXT[];

-- ─────────────────────────────────────────────
-- call_logs
-- ─────────────────────────────────────────────
ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS vapi_call_id TEXT,
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS caller_name TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_call_logs_appointment ON call_logs(appointment_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_vapi_call ON call_logs(vapi_call_id);

-- ─────────────────────────────────────────────
-- appointments
-- ─────────────────────────────────────────────
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS google_event_id TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_synced BOOLEAN DEFAULT FALSE;

-- ─────────────────────────────────────────────
-- Google Calendar columns on businesses
-- (also in supabase_calendar_migration.sql — safe to run again)
-- ─────────────────────────────────────────────
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS google_calendar_tokens JSONB,
  ADD COLUMN IF NOT EXISTS google_calendar_id TEXT DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS google_calendar_connected BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS google_calendar_sync_enabled BOOLEAN DEFAULT FALSE;

-- ─────────────────────────────────────────────
-- calendar_sync_log (safe to re-create)
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

CREATE INDEX IF NOT EXISTS idx_calendar_sync_log_pending ON calendar_sync_log(status) WHERE status = 'pending';

-- ─────────────────────────────────────────────
-- follow_ups
-- ─────────────────────────────────────────────
ALTER TABLE follow_ups
  ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'sms';
