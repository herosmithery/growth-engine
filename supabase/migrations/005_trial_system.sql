-- Migration 005: 7-Day Trial System with Stripe Billing
-- Adds trial tracking, usage limits, and Stripe subscription fields

-- =============================================================================
-- ADD TRIAL & STRIPE COLUMNS TO BUSINESSES
-- =============================================================================

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial'
    CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled', 'expired'));
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subscription_plan TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS billing_email TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ;

-- =============================================================================
-- TRIAL LIMITS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS trial_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_name TEXT NOT NULL UNIQUE,
    trial_limit INTEGER NOT NULL,
    starter_limit INTEGER,
    growth_limit INTEGER,
    enterprise_limit INTEGER,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default trial limits
INSERT INTO trial_limits (feature_name, trial_limit, starter_limit, growth_limit, enterprise_limit, description) VALUES
    ('ai_calls', 10, 50, 150, -1, 'AI phone calls per month (-1 = unlimited)'),
    ('sms_messages', 50, 200, 500, -1, 'SMS messages per month'),
    ('campaigns', 2, 2, 5, -1, 'Active campaigns'),
    ('clients', 50, 200, 500, -1, 'Total clients in database'),
    ('team_members', 1, 2, 5, -1, 'Team member accounts'),
    ('integrations', 1, 2, 3, -1, 'Third-party integrations (Google Calendar, etc.)')
ON CONFLICT (feature_name) DO UPDATE SET
    trial_limit = EXCLUDED.trial_limit,
    starter_limit = EXCLUDED.starter_limit,
    growth_limit = EXCLUDED.growth_limit,
    enterprise_limit = EXCLUDED.enterprise_limit;

-- =============================================================================
-- USAGE TRACKING TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    feature_name TEXT NOT NULL,
    usage_count INTEGER DEFAULT 0,
    period_start TIMESTAMPTZ DEFAULT date_trunc('month', NOW()),
    period_end TIMESTAMPTZ DEFAULT date_trunc('month', NOW()) + INTERVAL '1 month',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, feature_name, period_start)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_usage_tracking_business_feature ON usage_tracking(business_id, feature_name);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period ON usage_tracking(period_start, period_end);

-- =============================================================================
-- STRIPE EVENTS LOG (for webhook processing)
-- =============================================================================

CREATE TABLE IF NOT EXISTS stripe_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
    payload JSONB,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_events_business ON stripe_events(business_id);

-- =============================================================================
-- SUBSCRIPTION HISTORY TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscription_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'created', 'upgraded', 'downgraded', 'cancelled', 'renewed', 'payment_failed'
    from_plan TEXT,
    to_plan TEXT,
    stripe_subscription_id TEXT,
    amount_cents INTEGER,
    currency TEXT DEFAULT 'usd',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_business ON subscription_history(business_id);

-- =============================================================================
-- AUTO-INITIALIZE TRIAL ON BUSINESS CREATION
-- =============================================================================

CREATE OR REPLACE FUNCTION initialize_trial()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set trial fields if they're not already set
    IF NEW.trial_started_at IS NULL THEN
        NEW.trial_started_at := NOW();
    END IF;
    IF NEW.trial_expires_at IS NULL THEN
        NEW.trial_expires_at := NOW() + INTERVAL '7 days';
    END IF;
    IF NEW.subscription_status IS NULL THEN
        NEW.subscription_status := 'trial';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_initialize_trial ON businesses;
CREATE TRIGGER trigger_initialize_trial
    BEFORE INSERT ON businesses
    FOR EACH ROW
    EXECUTE FUNCTION initialize_trial();

-- =============================================================================
-- UPDATE EXISTING BUSINESSES WITH TRIAL (for migration)
-- =============================================================================

UPDATE businesses
SET
    trial_started_at = COALESCE(trial_started_at, created_at),
    trial_expires_at = COALESCE(trial_expires_at, created_at + INTERVAL '7 days'),
    subscription_status = COALESCE(subscription_status, 'trial')
WHERE trial_started_at IS NULL;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Check trial status for a business
CREATE OR REPLACE FUNCTION check_trial_status(p_business_id UUID)
RETURNS TABLE (
    is_trial BOOLEAN,
    days_remaining INTEGER,
    is_expired BOOLEAN,
    subscription_status TEXT,
    subscription_plan TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.subscription_status = 'trial' AS is_trial,
        GREATEST(0, EXTRACT(DAY FROM b.trial_expires_at - NOW())::INTEGER) AS days_remaining,
        (b.subscription_status = 'trial' AND b.trial_expires_at < NOW()) AS is_expired,
        b.subscription_status,
        b.subscription_plan
    FROM businesses b
    WHERE b.id = p_business_id;
END;
$$ LANGUAGE plpgsql;

-- Get current usage for a business
CREATE OR REPLACE FUNCTION get_business_usage(p_business_id UUID)
RETURNS TABLE (
    feature_name TEXT,
    usage_count INTEGER,
    limit_value INTEGER,
    is_at_limit BOOLEAN
) AS $$
DECLARE
    v_plan TEXT;
BEGIN
    -- Get current plan
    SELECT subscription_plan INTO v_plan FROM businesses WHERE id = p_business_id;

    RETURN QUERY
    SELECT
        tl.feature_name,
        COALESCE(ut.usage_count, 0) AS usage_count,
        CASE
            WHEN v_plan = 'enterprise' THEN tl.enterprise_limit
            WHEN v_plan = 'growth' THEN tl.growth_limit
            WHEN v_plan = 'starter' THEN tl.starter_limit
            ELSE tl.trial_limit
        END AS limit_value,
        CASE
            WHEN CASE
                WHEN v_plan = 'enterprise' THEN tl.enterprise_limit
                WHEN v_plan = 'growth' THEN tl.growth_limit
                WHEN v_plan = 'starter' THEN tl.starter_limit
                ELSE tl.trial_limit
            END = -1 THEN false -- Unlimited
            ELSE COALESCE(ut.usage_count, 0) >= CASE
                WHEN v_plan = 'enterprise' THEN tl.enterprise_limit
                WHEN v_plan = 'growth' THEN tl.growth_limit
                WHEN v_plan = 'starter' THEN tl.starter_limit
                ELSE tl.trial_limit
            END
        END AS is_at_limit
    FROM trial_limits tl
    LEFT JOIN usage_tracking ut ON ut.feature_name = tl.feature_name
        AND ut.business_id = p_business_id
        AND ut.period_start <= NOW()
        AND ut.period_end > NOW();
END;
$$ LANGUAGE plpgsql;

-- Increment usage for a feature
CREATE OR REPLACE FUNCTION increment_usage(p_business_id UUID, p_feature_name TEXT, p_amount INTEGER DEFAULT 1)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_usage INTEGER;
    v_limit INTEGER;
    v_plan TEXT;
BEGIN
    -- Get current plan
    SELECT subscription_plan INTO v_plan FROM businesses WHERE id = p_business_id;

    -- Get limit for this plan
    SELECT
        CASE
            WHEN v_plan = 'enterprise' THEN enterprise_limit
            WHEN v_plan = 'growth' THEN growth_limit
            WHEN v_plan = 'starter' THEN starter_limit
            ELSE trial_limit
        END INTO v_limit
    FROM trial_limits WHERE feature_name = p_feature_name;

    -- Unlimited (-1) always succeeds
    IF v_limit = -1 THEN
        INSERT INTO usage_tracking (business_id, feature_name, usage_count)
        VALUES (p_business_id, p_feature_name, p_amount)
        ON CONFLICT (business_id, feature_name, period_start)
        DO UPDATE SET usage_count = usage_tracking.usage_count + p_amount, updated_at = NOW();
        RETURN true;
    END IF;

    -- Get current usage
    SELECT COALESCE(usage_count, 0) INTO v_current_usage
    FROM usage_tracking
    WHERE business_id = p_business_id
        AND feature_name = p_feature_name
        AND period_start <= NOW()
        AND period_end > NOW();

    -- Check if would exceed limit
    IF COALESCE(v_current_usage, 0) + p_amount > v_limit THEN
        RETURN false;
    END IF;

    -- Increment usage
    INSERT INTO usage_tracking (business_id, feature_name, usage_count)
    VALUES (p_business_id, p_feature_name, p_amount)
    ON CONFLICT (business_id, feature_name, period_start)
    DO UPDATE SET usage_count = usage_tracking.usage_count + p_amount, updated_at = NOW();

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- RLS POLICIES FOR NEW TABLES
-- =============================================================================

ALTER TABLE trial_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

-- Trial limits are read-only for everyone
CREATE POLICY "Anyone can read trial_limits" ON trial_limits FOR SELECT USING (true);

-- Usage tracking - users can only see their business's usage
CREATE POLICY "Users can view own business usage" ON usage_tracking
    FOR SELECT USING (user_has_business_access(business_id));

CREATE POLICY "Service role full access on usage_tracking" ON usage_tracking
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Stripe events - service role only
CREATE POLICY "Service role full access on stripe_events" ON stripe_events
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Subscription history - users can view their business's history
CREATE POLICY "Users can view own business subscription_history" ON subscription_history
    FOR SELECT USING (user_has_business_access(business_id));

CREATE POLICY "Service role full access on subscription_history" ON subscription_history
    FOR ALL TO service_role USING (true) WITH CHECK (true);
