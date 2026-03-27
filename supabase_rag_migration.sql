-- RAG Knowledge Base Migration
-- Run this in Supabase SQL Editor

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Knowledge base table — stores business-specific content with embeddings
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('service', 'faq', 'pricing', 'hours', 'policy', 'staff', 'location', 'general')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),  -- OpenAI/Claude text-embedding-3-small dimensions
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Index for fast vector similarity search
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx
  ON knowledge_base
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 4. Index for business_id lookups
CREATE INDEX IF NOT EXISTS knowledge_base_business_id_idx ON knowledge_base(business_id);
CREATE INDEX IF NOT EXISTS knowledge_base_category_idx ON knowledge_base(business_id, category);

-- 5. RLS policies
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own knowledge_base" ON knowledge_base;
CREATE POLICY "Users can read own knowledge_base"
  ON knowledge_base FOR SELECT
  USING (
    business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "Users can manage own knowledge_base" ON knowledge_base;
CREATE POLICY "Users can manage own knowledge_base"
  ON knowledge_base FOR ALL
  USING (
    business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
  );

-- 6. Vector similarity search function (used by the API)
CREATE OR REPLACE FUNCTION search_knowledge_base(
  p_business_id UUID,
  p_query_embedding vector(1536),
  p_match_count INT DEFAULT 5,
  p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  category TEXT,
  title TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.category,
    kb.title,
    kb.content,
    kb.metadata,
    1 - (kb.embedding <=> p_query_embedding) AS similarity
  FROM knowledge_base kb
  WHERE
    kb.business_id = p_business_id
    AND kb.is_active = TRUE
    AND kb.embedding IS NOT NULL
    AND (p_category IS NULL OR kb.category = p_category)
  ORDER BY kb.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;

-- 7. Updated_at trigger
CREATE OR REPLACE FUNCTION update_knowledge_base_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_knowledge_base_updated_at ON knowledge_base;
CREATE TRIGGER update_knowledge_base_updated_at
  BEFORE UPDATE ON knowledge_base
  FOR EACH ROW EXECUTE FUNCTION update_knowledge_base_updated_at();
