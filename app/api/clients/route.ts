import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — list clients or get single client with detail
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get('business_id');
  const clientId = searchParams.get('client_id');
  const limit = parseInt(searchParams.get('limit') || '200');

  if (!businessId) {
    return NextResponse.json({ error: 'business_id required' }, { status: 400 });
  }

  // Single client detail view
  if (clientId) {
    const [{ data: appointments }, { data: messages }, { data: followUps }] = await Promise.all([
      supabase
        .from('appointments')
        .select('id, start_time, treatment_type, amount, status')
        .eq('client_id', clientId)
        .eq('business_id', businessId)
        .order('start_time', { ascending: false })
        .limit(10),
      supabase
        .from('messages')
        .select('id, direction, content, created_at, channel')
        .eq('client_id', clientId)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('follow_ups')
        .select('id, type, status, scheduled_for')
        .eq('client_id', clientId)
        .in('status', ['pending', 'scheduled'])
        .order('scheduled_for', { ascending: true }),
    ]);

    return NextResponse.json({
      appointments: appointments || [],
      messages: messages || [],
      followUps: followUps || [],
    });
  }

  // List all clients
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('business_id', businessId)
    .order('last_visit_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clients: data || [] });
}
