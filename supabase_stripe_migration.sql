-- Stripe Billing Migration
-- Run this in your Supabase SQL Editor after supabase_whitelabel_migration.sql

-- ─────────────────────────────────────────────
-- 1. Add Stripe columns to businesses table
-- ─────────────────────────────────────────────
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS billing_email TEXT;

CREATE INDEX IF NOT EXISTS idx_businesses_stripe_customer ON businesses(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_businesses_stripe_sub ON businesses(stripe_subscription_id);

-- ─────────────────────────────────────────────
-- 2. Stripe events log (raw webhook events)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stripe_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  payload JSONB,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_business_id ON stripe_events(business_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(event_type);

ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage stripe_events" ON stripe_events
  FOR ALL USING (is_admin());

-- ─────────────────────────────────────────────
-- 3. Subscription history (audit trail)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- created, upgraded, downgraded, renewed, cancelled, payment_failed
  from_plan TEXT,
  to_plan TEXT,
  stripe_subscription_id TEXT,
  amount_cents INTEGER,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_business ON subscription_history(business_id);

ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage subscription_history" ON subscription_history
  FOR ALL USING (is_admin());

CREATE POLICY "Users view own subscription_history" ON subscription_history
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
      UNION
      SELECT business_id FROM user_businesses WHERE user_id = auth.uid()
    )
  );
