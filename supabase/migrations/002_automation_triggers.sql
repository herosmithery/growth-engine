-- MedSpa Dashboard Automation Triggers
-- Run after 001_create_tables.sql
-- These triggers automate the Growth Engine agents (Aura, Phoenix, Star, Sage)

-- ============================================
-- 1. Auto-update client last_visit_at on appointment completion
-- ============================================
CREATE OR REPLACE FUNCTION update_client_last_visit()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        UPDATE clients
        SET last_visit_at = NEW.appointment_date,
            total_visits = COALESCE(total_visits, 0) + 1
        WHERE id = NEW.client_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_client_last_visit ON appointments;
CREATE TRIGGER trigger_update_client_last_visit
    AFTER INSERT OR UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_client_last_visit();

-- ============================================
-- 2. Auto-create review request follow-up when appointment completes (Star Agent)
-- ============================================
CREATE OR REPLACE FUNCTION create_review_request_followup()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Only create if no review request exists for this appointment
        IF NOT EXISTS (
            SELECT 1 FROM follow_ups
            WHERE appointment_id = NEW.id AND type = 'review_request'
        ) THEN
            INSERT INTO follow_ups (
                business_id,
                client_id,
                appointment_id,
                type,
                channel,
                status,
                scheduled_for,
                message_template
            )
            SELECT
                NEW.business_id,
                NEW.client_id,
                NEW.id,
                'review_request',
                'sms',
                'scheduled',
                NEW.appointment_date + INTERVAL '48 hours',
                'Hi ' || COALESCE(c.first_name, 'there') || '! We hope you loved your visit. Would you mind leaving us a quick review? ⭐'
            FROM clients c
            WHERE c.id = NEW.client_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_review_request ON appointments;
CREATE TRIGGER trigger_create_review_request
    AFTER INSERT OR UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION create_review_request_followup();

-- ============================================
-- 3. Auto-create post-treatment follow-up (Sage Agent)
-- ============================================
CREATE OR REPLACE FUNCTION create_post_treatment_followup()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Only create if no post-treatment follow-up exists
        IF NOT EXISTS (
            SELECT 1 FROM follow_ups
            WHERE appointment_id = NEW.id AND type = 'post_treatment'
        ) THEN
            INSERT INTO follow_ups (
                business_id,
                client_id,
                appointment_id,
                type,
                channel,
                status,
                scheduled_for,
                message_template
            )
            SELECT
                NEW.business_id,
                NEW.client_id,
                NEW.id,
                'post_treatment',
                'sms',
                'scheduled',
                NEW.appointment_date + INTERVAL '24 hours',
                'Hi ' || COALESCE(c.first_name, 'there') || '! How are you feeling after your treatment yesterday? Let us know if you have any questions. 💆‍♀️'
            FROM clients c
            WHERE c.id = NEW.client_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_post_treatment ON appointments;
CREATE TRIGGER trigger_create_post_treatment
    AFTER INSERT OR UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION create_post_treatment_followup();

-- ============================================
-- 4. Auto-update campaign metrics when message is sent
-- ============================================
CREATE OR REPLACE FUNCTION update_campaign_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update sent count when message status changes to 'sent'
    IF NEW.status = 'sent' AND OLD.status = 'pending' AND NEW.campaign_id IS NOT NULL THEN
        UPDATE campaigns
        SET delivered_count = COALESCE(delivered_count, 0) + 1
        WHERE id = NEW.campaign_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_campaign_metrics ON messages;
CREATE TRIGGER trigger_update_campaign_metrics
    AFTER UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_metrics();

-- ============================================
-- 5. Auto-update campaign reply count when reply received
-- ============================================
CREATE OR REPLACE FUNCTION update_campaign_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    -- When an inbound message is received, check if it's a reply to a campaign
    IF NEW.direction = 'inbound' THEN
        -- Find the most recent outbound campaign message to this client
        UPDATE campaigns
        SET replied_count = COALESCE(replied_count, 0) + 1
        WHERE id IN (
            SELECT campaign_id FROM messages
            WHERE client_id = NEW.client_id
            AND campaign_id IS NOT NULL
            AND direction = 'outbound'
            AND created_at > NOW() - INTERVAL '7 days'
            ORDER BY created_at DESC
            LIMIT 1
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_campaign_reply ON messages;
CREATE TRIGGER trigger_update_campaign_reply
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_reply_count();

-- ============================================
-- 6. Create booking follow-up when call results in booking (Aura Agent)
-- ============================================
CREATE OR REPLACE FUNCTION create_booking_confirmation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.outcome = 'booked' AND (OLD.outcome IS NULL OR OLD.outcome != 'booked') THEN
        -- Create a follow-up to confirm the booking
        INSERT INTO follow_ups (
            business_id,
            client_id,
            type,
            channel,
            status,
            scheduled_for,
            message_template
        )
        SELECT
            NEW.business_id,
            NEW.client_id,
            'booking_reminder',
            'sms',
            'scheduled',
            NOW() + INTERVAL '1 hour',
            'Thanks for booking with us! We''ll send you a reminder before your appointment. 📅'
        WHERE NEW.client_id IS NOT NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_booking_confirmation ON call_logs;
CREATE TRIGGER trigger_booking_confirmation
    AFTER INSERT OR UPDATE ON call_logs
    FOR EACH ROW
    EXECUTE FUNCTION create_booking_confirmation();

-- ============================================
-- 7. Auto-track conversion when appointment is booked from campaign
-- ============================================
CREATE OR REPLACE FUNCTION track_campaign_conversion()
RETURNS TRIGGER AS $$
BEGIN
    -- When a new appointment is created, check if client had recent campaign message
    UPDATE campaigns
    SET converted_count = COALESCE(converted_count, 0) + 1
    WHERE id IN (
        SELECT DISTINCT campaign_id FROM messages
        WHERE client_id = NEW.client_id
        AND campaign_id IS NOT NULL
        AND created_at > NOW() - INTERVAL '14 days'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_track_campaign_conversion ON appointments;
CREATE TRIGGER trigger_track_campaign_conversion
    AFTER INSERT ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION track_campaign_conversion();

-- ============================================
-- 8. Create view for Growth Engine dashboard metrics
-- ============================================
CREATE OR REPLACE VIEW growth_engine_metrics AS
SELECT
    b.id as business_id,
    b.name as business_name,
    -- Aura Agent: Calls handled
    (SELECT COUNT(*) FROM call_logs cl WHERE cl.business_id = b.id AND cl.created_at > NOW() - INTERVAL '30 days') as calls_this_month,
    (SELECT COUNT(*) FROM call_logs cl WHERE cl.business_id = b.id AND cl.outcome = 'booked' AND cl.created_at > NOW() - INTERVAL '30 days') as bookings_from_calls,
    -- Phoenix Agent: Reactivations
    (SELECT COUNT(*) FROM campaigns c WHERE c.business_id = b.id AND c.type = 'reactivation' AND c.status = 'active') as active_reactivation_campaigns,
    (SELECT COALESCE(SUM(converted_count), 0) FROM campaigns c WHERE c.business_id = b.id AND c.type = 'reactivation') as reactivation_conversions,
    -- Star Agent: Reviews
    (SELECT COUNT(*) FROM follow_ups f WHERE f.business_id = b.id AND f.type = 'review_request' AND f.status = 'sent' AND f.created_at > NOW() - INTERVAL '30 days') as review_requests_sent,
    (SELECT COUNT(*) FROM reviews r WHERE r.business_id = b.id AND r.rating >= 4 AND r.created_at > NOW() - INTERVAL '30 days') as positive_reviews,
    -- Sage Agent: Nurture
    (SELECT COUNT(*) FROM follow_ups f WHERE f.business_id = b.id AND f.status = 'scheduled') as pending_followups,
    (SELECT COUNT(*) FROM follow_ups f WHERE f.business_id = b.id AND f.status = 'completed' AND f.created_at > NOW() - INTERVAL '30 days') as completed_followups
FROM businesses b;

-- ============================================
-- 9. Add indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_business_date ON appointments(business_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled ON follow_ups(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_follow_ups_type ON follow_ups(type);
CREATE INDEX IF NOT EXISTS idx_messages_campaign ON messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_clients_last_visit ON clients(business_id, last_visit_at);
CREATE INDEX IF NOT EXISTS idx_call_logs_outcome ON call_logs(outcome);

-- ============================================
-- 10. Grant permissions
-- ============================================
GRANT SELECT ON growth_engine_metrics TO authenticated;
