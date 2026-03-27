-- MedSpa Dashboard Database Schema
-- Run this migration in Supabase SQL Editor

-- =============================================================================
-- BUSINESSES TABLE (Core business/location entity)
-- =============================================================================
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    website TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    vapi_phone_number TEXT,
    vapi_assistant_id TEXT,
    twilio_phone_number TEXT,
    timezone TEXT DEFAULT 'America/New_York',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- USER-BUSINESS JUNCTION TABLE (For multi-user access to businesses)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, business_id)
);

-- =============================================================================
-- CLIENTS TABLE (Customer records)
-- =============================================================================
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT,
    phone TEXT,
    email TEXT,
    date_of_birth DATE,
    source TEXT, -- 'walk-in', 'referral', 'google', 'facebook', 'instagram', etc.
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'vip', 'churned')),
    notes TEXT,
    total_visits INTEGER DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0,
    last_visit_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_business_id ON clients(business_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);

-- =============================================================================
-- APPOINTMENTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    treatment_name TEXT NOT NULL,
    treatment_category TEXT, -- 'botox', 'filler', 'laser', 'facial', etc.
    provider_name TEXT,
    appointment_date TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled')),
    price DECIMAL(10,2),
    notes TEXT,
    source TEXT, -- 'phone', 'website', 'walk-in', 'ai-agent'
    confirmed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_business_id ON appointments(business_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- =============================================================================
-- LEADS TABLE (Potential customers not yet converted to clients)
-- =============================================================================
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    email TEXT,
    source TEXT, -- 'google-ads', 'facebook', 'instagram', 'website', 'referral', 'ai-call'
    source_details TEXT, -- Campaign name, ad set, etc.
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'appointment_scheduled', 'converted', 'lost', 'nurturing')),
    interest TEXT, -- What treatment they're interested in
    notes TEXT,
    last_contacted_at TIMESTAMPTZ,
    converted_client_id UUID REFERENCES clients(id),
    converted_at TIMESTAMPTZ,
    lost_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_business_id ON leads(business_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- =============================================================================
-- CAMPAIGNS TABLE (Marketing campaigns for reactivation, nurture, etc.)
-- =============================================================================
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('reactivation', 'nurture', 'review_request', 'promotion', 'birthday', 'appointment_reminder')),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled')),
    channel TEXT DEFAULT 'sms' CHECK (channel IN ('sms', 'email', 'both')),
    message_template TEXT,
    subject_line TEXT, -- For email campaigns
    target_criteria JSONB, -- Filters for who to target
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    target_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    replied_count INTEGER DEFAULT 0,
    converted_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_business_id ON campaigns(business_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- =============================================================================
-- MESSAGES TABLE (All SMS and email communications)
-- =============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type TEXT, -- 'confirmation', 'followup', 'review_request', 'reactivation', 'nurture', 'manual'
    from_number TEXT,
    to_number TEXT,
    from_email TEXT,
    to_email TEXT,
    subject TEXT,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked', 'replied')),
    external_id TEXT, -- Twilio SID or email provider ID
    error_message TEXT,
    sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_business_id ON messages(business_id);
CREATE INDEX IF NOT EXISTS idx_messages_client_id ON messages(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_campaign_id ON messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- =============================================================================
-- CALL_LOGS TABLE (AI phone call records from VAPI)
-- =============================================================================
CREATE TABLE IF NOT EXISTS call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    caller_phone TEXT,
    vapi_call_id TEXT,
    direction TEXT CHECK (direction IN ('inbound', 'outbound')),
    duration_seconds INTEGER DEFAULT 0,
    outcome TEXT CHECK (outcome IN ('booked', 'callback_requested', 'info_only', 'dropped', 'voicemail', 'transferred', 'no_answer')),
    summary TEXT,
    transcript JSONB,
    recording_url TEXT,
    appointment_id UUID REFERENCES appointments(id),
    sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_business_id ON call_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at DESC);

-- =============================================================================
-- FOLLOW_UPS TABLE (Scheduled follow-up actions)
-- =============================================================================
CREATE TABLE IF NOT EXISTS follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('post_treatment', 'booking_reminder', 'reactivation', 'review_request', 'birthday', 'custom')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'sent', 'completed', 'skipped', 'failed')),
    channel TEXT DEFAULT 'sms' CHECK (channel IN ('sms', 'email', 'call')),
    message_template TEXT,
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    result TEXT, -- 'responded', 'no_response', 'booked', 'opted_out'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_business_id ON follow_ups(business_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_client_id ON follow_ups(client_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled_for ON follow_ups(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);

-- =============================================================================
-- REVIEWS TABLE (Review requests and responses)
-- =============================================================================
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    platform TEXT CHECK (platform IN ('google', 'yelp', 'facebook', 'healthgrades', 'internal')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'request_sent', 'clicked', 'reviewed', 'declined')),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    content TEXT,
    review_url TEXT, -- URL to the actual review
    request_sent_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_business_id ON reviews(business_id);
CREATE INDEX IF NOT EXISTS idx_reviews_client_id ON reviews(client_id);

-- =============================================================================
-- WEBHOOK_LOGS TABLE (CRM webhook processing audit)
-- =============================================================================
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    source TEXT NOT NULL, -- 'boulevard', 'gohighlevel', 'zenoti', 'vagaro', 'mindbody', etc.
    event_type TEXT NOT NULL, -- 'appointment.created', 'client.updated', etc.
    payload JSONB,
    processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_business_id ON webhook_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);

-- =============================================================================
-- TREATMENT_TEMPLATES TABLE (Predefined treatments with follow-up sequences)
-- =============================================================================
CREATE TABLE IF NOT EXISTS treatment_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    default_duration_minutes INTEGER DEFAULT 60,
    default_price DECIMAL(10,2),
    follow_up_sequence JSONB, -- Array of follow-up actions with timing
    review_request_delay_hours INTEGER DEFAULT 24,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treatment_templates_business_id ON treatment_templates(business_id);

-- =============================================================================
-- SETTINGS TABLE (Business-level settings)
-- =============================================================================
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,

    -- Notification preferences
    notification_email TEXT,
    notification_sms BOOLEAN DEFAULT true,
    notification_email_enabled BOOLEAN DEFAULT true,

    -- Review settings
    review_request_enabled BOOLEAN DEFAULT true,
    review_request_delay_hours INTEGER DEFAULT 24,
    review_platforms TEXT[] DEFAULT ARRAY['google'],

    -- Follow-up settings
    follow_up_enabled BOOLEAN DEFAULT true,
    reactivation_enabled BOOLEAN DEFAULT true,
    reactivation_days_inactive INTEGER DEFAULT 90,

    -- AI settings
    ai_phone_enabled BOOLEAN DEFAULT false,
    ai_response_style TEXT DEFAULT 'professional',

    -- CRM integration
    crm_provider TEXT,
    crm_webhook_url TEXT,
    crm_api_key TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS POLICIES (Basic - users can access their business data)
-- =============================================================================

-- Businesses: Users can view businesses they're linked to
CREATE POLICY "Users can view own businesses" ON businesses
    FOR SELECT USING (
        id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())
        OR owner_id = auth.uid()
    );

CREATE POLICY "Users can update own businesses" ON businesses
    FOR UPDATE USING (
        id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
        OR owner_id = auth.uid()
    );

-- User-businesses: Users can see their own memberships
CREATE POLICY "Users can view own memberships" ON user_businesses
    FOR SELECT USING (user_id = auth.uid());

-- Generic policy for business-scoped tables
-- Apply this pattern to: clients, appointments, leads, campaigns, messages, call_logs, follow_ups, reviews, webhook_logs, treatment_templates, settings

CREATE POLICY "Users can view own business clients" ON clients
    FOR ALL USING (
        business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can view own business appointments" ON appointments
    FOR ALL USING (
        business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can view own business leads" ON leads
    FOR ALL USING (
        business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can view own business campaigns" ON campaigns
    FOR ALL USING (
        business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can view own business messages" ON messages
    FOR ALL USING (
        business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can view own business call_logs" ON call_logs
    FOR ALL USING (
        business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can view own business follow_ups" ON follow_ups
    FOR ALL USING (
        business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can view own business reviews" ON reviews
    FOR ALL USING (
        business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can view own business webhook_logs" ON webhook_logs
    FOR ALL USING (
        business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can view own business treatment_templates" ON treatment_templates
    FOR ALL USING (
        business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can view own business settings" ON settings
    FOR ALL USING (
        business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())
    );

-- =============================================================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_follow_ups_updated_at BEFORE UPDATE ON follow_ups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_treatment_templates_updated_at BEFORE UPDATE ON treatment_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ENABLE REALTIME FOR KEY TABLES
-- =============================================================================
-- Run these in Supabase Dashboard > Database > Replication
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
-- ALTER PUBLICATION supabase_realtime ADD TABLE call_logs;
-- ALTER PUBLICATION supabase_realtime ADD TABLE webhook_logs;
