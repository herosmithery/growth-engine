-- Migration 006: Google Calendar Integration
-- Adds fields for Google Calendar OAuth and event sync

-- =============================================================================
-- ADD GOOGLE CALENDAR COLUMNS TO BUSINESSES
-- =============================================================================

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS google_calendar_tokens JSONB;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS google_calendar_connected BOOLEAN DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS google_calendar_id TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS google_calendar_sync_enabled BOOLEAN DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS google_calendar_last_synced_at TIMESTAMPTZ;

-- =============================================================================
-- ADD GOOGLE EVENT ID TO APPOINTMENTS
-- =============================================================================

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_calendar_synced BOOLEAN DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_calendar_sync_error TEXT;

-- Index for finding appointments by Google event ID
CREATE INDEX IF NOT EXISTS idx_appointments_google_event_id ON appointments(google_event_id) WHERE google_event_id IS NOT NULL;

-- =============================================================================
-- CALENDAR SYNC LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS calendar_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    sync_direction TEXT NOT NULL CHECK (sync_direction IN ('to_google', 'from_google')),
    sync_action TEXT NOT NULL CHECK (sync_action IN ('create', 'update', 'delete')),
    google_event_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
    error_message TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_sync_log_business ON calendar_sync_log(business_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_log_appointment ON calendar_sync_log(appointment_id);

-- =============================================================================
-- GOOGLE CALENDAR WEBHOOK SUBSCRIPTIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS google_calendar_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL UNIQUE,
    resource_id TEXT NOT NULL,
    expiration TIMESTAMPTZ NOT NULL,
    calendar_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_google_calendar_webhooks_business ON google_calendar_webhooks(business_id);
CREATE INDEX IF NOT EXISTS idx_google_calendar_webhooks_channel ON google_calendar_webhooks(channel_id);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE calendar_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_calendar_webhooks ENABLE ROW LEVEL SECURITY;

-- Users can view their business's sync logs
CREATE POLICY "Users can view own business calendar_sync_log" ON calendar_sync_log
    FOR SELECT USING (user_has_business_access(business_id));

CREATE POLICY "Service role full access on calendar_sync_log" ON calendar_sync_log
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Webhook subscriptions - service role only
CREATE POLICY "Service role full access on google_calendar_webhooks" ON google_calendar_webhooks
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- HELPER FUNCTION: Check if business has Google Calendar connected
-- =============================================================================

CREATE OR REPLACE FUNCTION is_google_calendar_connected(p_business_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM businesses
        WHERE id = p_business_id
        AND google_calendar_connected = true
        AND google_calendar_tokens IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGER: Auto-sync appointment to Google Calendar on create/update
-- =============================================================================

-- This trigger will be used to queue sync operations
-- The actual sync is handled by an Edge Function

CREATE OR REPLACE FUNCTION queue_google_calendar_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- Only queue if business has Google Calendar connected
    IF (SELECT google_calendar_sync_enabled FROM businesses WHERE id = NEW.business_id) = true THEN
        -- Log the sync request (Edge Function will process this)
        INSERT INTO calendar_sync_log (
            business_id,
            appointment_id,
            sync_direction,
            sync_action,
            status,
            payload
        ) VALUES (
            NEW.business_id,
            NEW.id,
            'to_google',
            CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END,
            'pending',
            jsonb_build_object(
                'treatment_type', NEW.treatment_type,
                'start_time', NEW.start_time,
                'status', NEW.status
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_queue_google_calendar_sync ON appointments;
CREATE TRIGGER trigger_queue_google_calendar_sync
    AFTER INSERT OR UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION queue_google_calendar_sync();

-- =============================================================================
-- TRIGGER: Handle appointment deletion - remove from Google Calendar
-- =============================================================================

CREATE OR REPLACE FUNCTION queue_google_calendar_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Only queue if appointment had a Google event ID
    IF OLD.google_event_id IS NOT NULL THEN
        INSERT INTO calendar_sync_log (
            business_id,
            sync_direction,
            sync_action,
            google_event_id,
            status,
            payload
        ) VALUES (
            OLD.business_id,
            'to_google',
            'delete',
            OLD.google_event_id,
            'pending',
            jsonb_build_object('deleted_appointment_id', OLD.id)
        );
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_queue_google_calendar_delete ON appointments;
CREATE TRIGGER trigger_queue_google_calendar_delete
    BEFORE DELETE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION queue_google_calendar_delete();
