import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Generate embedding via OpenAI text-embedding-3-small (1536 dims)
async function generateEmbedding(text: string): Promise<number[]> {
  // Use OpenAI-compatible embedding if available, otherwise fall back to a hash-based approach
  // For production, swap this for OpenAI text-embedding-3-small or Voyage AI
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (response.ok) {
    const data = await response.json();
    return data.data[0].embedding;
  }

  // Fallback: zero vector (entry saved without embedding, search won't match it)
  return new Array(1536).fill(0);
}

// GET — list all knowledge entries for a business
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get('business_id');
  const category = searchParams.get('category');

  if (!businessId) return NextResponse.json({ error: 'business_id required' }, { status: 400 });

  let query = supabase
    .from('knowledge_base')
    .select('id, category, title, content, metadata, is_active, created_at')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('category')
    .order('created_at', { ascending: false });

  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ entries: data || [] });
}

// POST — add or update a knowledge entry
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { business_id, category, title, content, metadata, id } = body;

  if (!business_id || !category || !title || !content) {
    return NextResponse.json({ error: 'business_id, category, title, content required' }, { status: 400 });
  }

  // Generate embedding for the content
  const embeddingInput = `${title}\n${content}`;
  const embedding = await generateEmbedding(embeddingInput);

  const payload = {
    business_id,
    category,
    title,
    content,
    metadata: metadata || {},
    embedding,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  let result;
  if (id) {
    // Update existing
    result = await supabase
      .from('knowledge_base')
      .update(payload)
      .eq('id', id)
      .eq('business_id', business_id)
      .select('id, category, title, content, created_at')
      .single();
  } else {
    // Insert new
    result = await supabase
      .from('knowledge_base')
      .insert(payload)
      .select('id, category, title, content, created_at')
      .single();
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });

  return NextResponse.json({ entry: result.data, embedded: embedding.some(v => v !== 0) });
}

// DELETE — remove a knowledge entry
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const businessId = searchParams.get('business_id');

  if (!id || !businessId) return NextResponse.json({ error: 'id and business_id required' }, { status: 400 });

  const { error } = await supabase
    .from('knowledge_base')
    .update({ is_active: false })
    .eq('id', id)
    .eq('business_id', businessId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
