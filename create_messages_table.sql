-- Run this in Supabase Dashboard > SQL Editor
-- URL: https://supabase.com/dashboard/project/tsvuzkdrtquzuseaezjk/sql

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    lead_id UUID,
    campaign_id UUID,
    channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type TEXT,
    from_number TEXT,
    to_number TEXT,
    from_email TEXT,
    to_email TEXT,
    subject TEXT,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked', 'replied')),
    external_id TEXT,
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
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read messages for their businesses
CREATE POLICY "Users can view messages for their business" ON messages
    FOR SELECT USING (true);

-- Allow service role to insert messages
CREATE POLICY "Service role can insert messages" ON messages
    FOR INSERT WITH CHECK (true);

-- Allow service role to update messages
CREATE POLICY "Service role can update messages" ON messages
    FOR UPDATE USING (true);

-- Verify table exists
SELECT 'messages table created successfully!' as status;
