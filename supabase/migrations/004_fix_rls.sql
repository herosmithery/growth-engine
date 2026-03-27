-- Migration 004: Fix RLS Policies
-- Replaces insecure "Allow all" policies with proper business-scoped policies

-- =============================================================================
-- DROP INSECURE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Allow all on leads" ON leads;
DROP POLICY IF EXISTS "Allow all on follow_ups" ON follow_ups;
DROP POLICY IF EXISTS "Allow all on reviews" ON reviews;
DROP POLICY IF EXISTS "Allow all on messages" ON messages;
DROP POLICY IF EXISTS "Allow all on user_businesses" ON user_businesses;
DROP POLICY IF EXISTS "Allow all on settings" ON settings;
DROP POLICY IF EXISTS "Allow all on webhook_logs" ON webhook_logs;

-- =============================================================================
-- CREATE PROPER BUSINESS-SCOPED POLICIES
-- =============================================================================

-- Helper function to check if user has access to a business
CREATE OR REPLACE FUNCTION user_has_business_access(p_business_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_businesses
        WHERE user_id = auth.uid()
        AND business_id = p_business_id
    ) OR EXISTS (
        SELECT 1 FROM businesses
        WHERE id = p_business_id
        AND owner_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- LEADS
CREATE POLICY "Users can view own business leads" ON leads
    FOR SELECT USING (user_has_business_access(business_id));

CREATE POLICY "Users can insert own business leads" ON leads
    FOR INSERT WITH CHECK (user_has_business_access(business_id));

CREATE POLICY "Users can update own business leads" ON leads
    FOR UPDATE USING (user_has_business_access(business_id));

CREATE POLICY "Users can delete own business leads" ON leads
    FOR DELETE USING (user_has_business_access(business_id));

-- FOLLOW_UPS
CREATE POLICY "Users can view own business follow_ups" ON follow_ups
    FOR SELECT USING (user_has_business_access(business_id));

CREATE POLICY "Users can insert own business follow_ups" ON follow_ups
    FOR INSERT WITH CHECK (user_has_business_access(business_id));

CREATE POLICY "Users can update own business follow_ups" ON follow_ups
    FOR UPDATE USING (user_has_business_access(business_id));

CREATE POLICY "Users can delete own business follow_ups" ON follow_ups
    FOR DELETE USING (user_has_business_access(business_id));

-- REVIEWS
CREATE POLICY "Users can view own business reviews" ON reviews
    FOR SELECT USING (user_has_business_access(business_id));

CREATE POLICY "Users can insert own business reviews" ON reviews
    FOR INSERT WITH CHECK (user_has_business_access(business_id));

CREATE POLICY "Users can update own business reviews" ON reviews
    FOR UPDATE USING (user_has_business_access(business_id));

CREATE POLICY "Users can delete own business reviews" ON reviews
    FOR DELETE USING (user_has_business_access(business_id));

-- MESSAGES
CREATE POLICY "Users can view own business messages" ON messages
    FOR SELECT USING (user_has_business_access(business_id));

CREATE POLICY "Users can insert own business messages" ON messages
    FOR INSERT WITH CHECK (user_has_business_access(business_id));

CREATE POLICY "Users can update own business messages" ON messages
    FOR UPDATE USING (user_has_business_access(business_id));

CREATE POLICY "Users can delete own business messages" ON messages
    FOR DELETE USING (user_has_business_access(business_id));

-- USER_BUSINESSES
CREATE POLICY "Users can view own user_businesses" ON user_businesses
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Business owners can manage user_businesses" ON user_businesses
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM businesses
            WHERE id = business_id
            AND owner_id = auth.uid()
        )
    );

-- SETTINGS
CREATE POLICY "Users can view own business settings" ON settings
    FOR SELECT USING (user_has_business_access(business_id));

CREATE POLICY "Users can insert own business settings" ON settings
    FOR INSERT WITH CHECK (user_has_business_access(business_id));

CREATE POLICY "Users can update own business settings" ON settings
    FOR UPDATE USING (user_has_business_access(business_id));

-- WEBHOOK_LOGS
CREATE POLICY "Users can view own business webhook_logs" ON webhook_logs
    FOR SELECT USING (user_has_business_access(business_id));

CREATE POLICY "Users can insert own business webhook_logs" ON webhook_logs
    FOR INSERT WITH CHECK (user_has_business_access(business_id));

-- =============================================================================
-- SERVICE ROLE BYPASS FOR EDGE FUNCTIONS
-- =============================================================================

-- Service role has full access to all tables for Edge Functions
CREATE POLICY "Service role full access on leads" ON leads
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on follow_ups" ON follow_ups
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on reviews" ON reviews
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on messages" ON messages
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on settings" ON settings
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on webhook_logs" ON webhook_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on user_businesses" ON user_businesses
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- DEMO MODE POLICY (Optional - for unauthenticated demo access)
-- =============================================================================

-- Allow unauthenticated read access to demo business data
-- Uncomment these if you want a public demo mode

-- CREATE POLICY "Public read access for demo business" ON businesses
--     FOR SELECT USING (id = 'demo-biz-001');

-- CREATE POLICY "Public read access for demo clients" ON clients
--     FOR SELECT USING (business_id = 'demo-biz-001');
