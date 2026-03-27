import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — list agency prospects (leads from AI scanner)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '200');
  const status = searchParams.get('status');

  let query = supabase
    .from('agency_prospects')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data || [] });
}

// PATCH — update lead status
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('agency_prospects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lead: data });
}

// POST — convert lead to client
export async function POST(request: NextRequest) {
  const { lead, business_id } = await request.json();
  if (!lead || !business_id) {
    return NextResponse.json({ error: 'lead and business_id required' }, { status: 400 });
  }

  // Create client record
  const { data: newClient, error: clientError } = await supabase
    .from('clients')
    .insert({
      business_id,
      first_name: lead.first_name || lead.name,
      last_name: lead.last_name || '',
      phone: lead.phone,
      email: lead.email,
      source: lead.source || 'agency_lead',
      notes: lead.notes,
    })
    .select()
    .single();

  if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 });

  // Mark prospect as converted
  await supabase
    .from('agency_prospects')
    .update({ status: 'converted', updated_at: new Date().toISOString() })
    .eq('id', lead.id);

  return NextResponse.json({ client: newClient });
}
