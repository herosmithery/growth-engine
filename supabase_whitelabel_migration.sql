-- White-Label SaaS Migration
-- Run this in your Supabase SQL Editor to enable multi-tenant white-labeling
-- This builds on top of the existing supabase_schema.sql

-- ─────────────────────────────────────────────
-- 1. Add white-label branding fields to businesses
-- ─────────────────────────────────────────────
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#7c3aed',
  ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#a78bfa',
  ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#f59e0b',
  ADD COLUMN IF NOT EXISTS mrr NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT;

-- Generate slugs for existing businesses (from name)
UPDATE businesses
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9\s]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL;

-- Index for fast slug lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);
CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);
CREATE INDEX IF NOT EXISTS idx_businesses_subscription_tier ON businesses(subscription_tier);

-- ─────────────────────────────────────────────
-- 2. Agency prospects / leads (from Python backend)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agency_prospects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  website TEXT,
  email TEXT,
  phone TEXT,
  niche TEXT,
  city TEXT,
  location TEXT,
  website_score INTEGER DEFAULT 0,
  tag TEXT DEFAULT 'COLD',
  status TEXT DEFAULT 'scouted',
  notes TEXT,
  last_action TEXT,
  next_action TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agency_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name TEXT,
  message TEXT,
  prospect_id UUID REFERENCES agency_prospects(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agency_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  tier INTEGER DEFAULT 1,
  vertical TEXT,
  mrr NUMERIC(10,2) DEFAULT 0,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agency_prospects_status ON agency_prospects(status);
CREATE INDEX IF NOT EXISTS idx_agency_prospects_niche ON agency_prospects(niche);
CREATE INDEX IF NOT EXISTS idx_agency_clients_business_id ON agency_clients(business_id);

-- ─────────────────────────────────────────────
-- 3. Subscriptions table (Stripe integration ready)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_tier TEXT DEFAULT 'starter',
  status TEXT DEFAULT 'active',
  mrr NUMERIC(10,2) DEFAULT 0,
  current_period_end TIMESTAMP WITH TIME ZONE,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_business_id ON subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ─────────────────────────────────────────────
-- 4. Super admin RLS policies
-- Admin users (role = 'admin' or 'super_admin' in app_metadata)
-- can read/write ALL businesses and related data
-- ─────────────────────────────────────────────

-- Helper function: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin' OR
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Businesses: admin can see all
DROP POLICY IF EXISTS "Admins can view all businesses" ON businesses;
CREATE POLICY "Admins can view all businesses" ON businesses
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update all businesses" ON businesses;
CREATE POLICY "Admins can update all businesses" ON businesses
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert businesses" ON businesses;
CREATE POLICY "Admins can insert businesses" ON businesses
  FOR INSERT WITH CHECK (is_admin() OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Admins can delete businesses" ON businesses;
CREATE POLICY "Admins can delete businesses" ON businesses
  FOR DELETE USING (is_admin());

-- Admin policies for all child tables
DROP POLICY IF EXISTS "Admins can view all clients" ON clients;
CREATE POLICY "Admins can view all clients" ON clients
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can view all appointments" ON appointments;
CREATE POLICY "Admins can view all appointments" ON appointments
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can view all call_logs" ON call_logs;
CREATE POLICY "Admins can view all call_logs" ON call_logs
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can view all messages" ON messages;
CREATE POLICY "Admins can view all messages" ON messages
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can view all leads" ON leads;
CREATE POLICY "Admins can view all leads" ON leads
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can view all campaigns" ON campaigns;
CREATE POLICY "Admins can view all campaigns" ON campaigns
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can view all reviews" ON reviews;
CREATE POLICY "Admins can view all reviews" ON reviews
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can view all follow_ups" ON follow_ups;
CREATE POLICY "Admins can view all follow_ups" ON follow_ups
  FOR SELECT USING (is_admin());

-- Agency tables RLS
ALTER TABLE agency_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage agency_prospects" ON agency_prospects
  FOR ALL USING (is_admin());

CREATE POLICY "Admins manage agency_activities" ON agency_activities
  FOR ALL USING (is_admin());

CREATE POLICY "Admins manage agency_clients" ON agency_clients
  FOR ALL USING (is_admin());

CREATE POLICY "Admins manage subscriptions" ON subscriptions
  FOR ALL USING (is_admin());

-- Clients can view their own subscription
CREATE POLICY "Users view own subscription" ON subscriptions
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
      UNION
      SELECT business_id FROM user_businesses WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- 5. Trigger for subscriptions updated_at
-- ─────────────────────────────────────────────
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
