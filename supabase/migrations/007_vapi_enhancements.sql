-- VAPI Enhancement Migration
-- Run this in Supabase SQL Editor

-- =============================================================================
-- ADD MISSING VAPI COLUMNS TO BUSINESSES
-- =============================================================================
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS vapi_phone_number_id TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS vapi_enabled BOOLEAN DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS business_hours JSONB;

-- =============================================================================
-- ADD MISSING COLUMNS TO CALL_LOGS
-- =============================================================================
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS caller_name TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS outcome TEXT;

-- Update outcome column if it exists but doesn't have the 'pending' value
DO $$
BEGIN
    -- Check if the constraint exists and update it
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'call_logs_outcome_check'
    ) THEN
        ALTER TABLE call_logs DROP CONSTRAINT call_logs_outcome_check;
    END IF;
END $$;

ALTER TABLE call_logs ADD CONSTRAINT call_logs_outcome_check
    CHECK (outcome IN ('pending', 'booked', 'callback_requested', 'info_only', 'dropped', 'voicemail', 'transferred', 'no_answer'));

-- =============================================================================
-- ADD MISSING COLUMNS TO APPOINTMENTS
-- =============================================================================
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS treatment_type TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_calendar_synced BOOLEAN DEFAULT false;

-- Copy data from appointment_date to start_time if start_time is null
UPDATE appointments
SET start_time = appointment_date
WHERE start_time IS NULL AND appointment_date IS NOT NULL;

-- Set end_time based on start_time + duration if not set
UPDATE appointments
SET end_time = start_time + (duration_minutes || ' minutes')::INTERVAL
WHERE end_time IS NULL AND start_time IS NOT NULL;

-- =============================================================================
-- ADD MISSING COLUMNS TO CLIENTS
-- =============================================================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_visit_date TIMESTAMPTZ;

-- Copy data from last_visit_at to last_visit_date if exists
UPDATE clients
SET last_visit_date = last_visit_at
WHERE last_visit_date IS NULL AND last_visit_at IS NOT NULL;

-- =============================================================================
-- ADD MISSING COLUMNS TO FOLLOW_UPS
-- =============================================================================
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS message_content TEXT;
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- Copy from message_template if message_content is null
UPDATE follow_ups
SET message_content = message_template
WHERE message_content IS NULL AND message_template IS NOT NULL;

-- =============================================================================
-- CREATE CALENDAR_SYNC_LOG TABLE IF NOT EXISTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS calendar_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    google_event_id TEXT,
    sync_direction TEXT CHECK (sync_direction IN ('to_google', 'from_google')),
    sync_action TEXT CHECK (sync_action IN ('create', 'update', 'delete')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_calendar_sync_log_business ON calendar_sync_log(business_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_log_status ON calendar_sync_log(status);

-- Enable RLS on calendar_sync_log
ALTER TABLE calendar_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own business calendar_sync_log" ON calendar_sync_log
    FOR ALL USING (
        business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())
    );

-- =============================================================================
-- SERVICE ROLE BYPASS POLICIES (for webhooks and background jobs)
-- =============================================================================
-- These allow the service role key to bypass RLS for API routes

CREATE POLICY "Service role full access businesses" ON businesses
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access clients" ON clients
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access appointments" ON appointments
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access call_logs" ON call_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access messages" ON messages
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access follow_ups" ON follow_ups
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access leads" ON leads
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access reviews" ON reviews
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access campaigns" ON campaigns
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access calendar_sync_log" ON calendar_sync_log
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- UPDATE BUSINESS WITH VAPI CONFIG (replace with your business ID)
-- =============================================================================
-- This is a template - uncomment and modify with actual values:
-- UPDATE businesses
-- SET
--     vapi_assistant_id = '823f2208-47d6-44a7-af02-3b9b7f9581da',
--     vapi_phone_number = '+19103708465',
--     vapi_phone_number_id = 'ce33d019-a0a3-40c5-a850-c473815bd2ed',
--     vapi_enabled = true
-- WHERE id = 'your-business-id-here';
