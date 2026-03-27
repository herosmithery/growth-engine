import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });

  if (response.ok) {
    const data = await response.json();
    return data.data[0].embedding;
  }
  return new Array(1536).fill(0);
}

// POST — semantic search over knowledge base
export async function POST(request: NextRequest) {
  const { business_id, query, category, limit = 5 } = await request.json();

  if (!business_id || !query) {
    return NextResponse.json({ error: 'business_id and query required' }, { status: 400 });
  }

  const embedding = await generateEmbedding(query);
  const hasEmbedding = embedding.some(v => v !== 0);

  if (!hasEmbedding) {
    // Fallback to text search if embedding fails
    const { data } = await supabase
      .from('knowledge_base')
      .select('id, category, title, content, metadata')
      .eq('business_id', business_id)
      .eq('is_active', true)
      .ilike('content', `%${query}%`)
      .limit(limit);

    return NextResponse.json({ results: data || [], method: 'text_fallback' });
  }

  const embeddingStr = `[${embedding.join(',')}]`;

  const { data, error } = await supabase.rpc('search_knowledge_base', {
    p_business_id: business_id,
    p_query_embedding: embeddingStr,
    p_match_count: limit,
    p_category: category || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Only return results with decent similarity (>0.5)
  const filtered = (data || []).filter((r: any) => r.similarity > 0.5);

  return NextResponse.json({ results: filtered, method: 'vector' });
}
