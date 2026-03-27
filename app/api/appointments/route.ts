import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — list appointments with client info and follow-up status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get('business_id');
  const status = searchParams.get('status');
  const source = searchParams.get('source');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const limit = parseInt(searchParams.get('limit') || '100');

  if (!businessId) {
    return NextResponse.json({ error: 'business_id required' }, { status: 400 });
  }

  let query = supabase
    .from('appointments')
    .select(`*, clients (id, first_name, last_name, phone, email)`)
    .eq('business_id', businessId)
    .order('start_time', { ascending: false })
    .limit(limit);

  if (status && status !== 'all') query = query.eq('status', status);
  if (source && source !== 'all') {
    if (source === 'ai-agent') {
      query = query.in('source', ['ai-agent', 'ai_phone']);
    } else {
      query = query.eq('source', source);
    }
  }
  if (startDate) query = query.gte('start_time', startDate);
  if (endDate) query = query.lte('start_time', endDate + 'T23:59:59');

  const { data: appointments, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Load follow-ups for all appointments in one query
  const apptIds = (appointments || []).map((a: any) => a.id);
  const { data: followUps } = apptIds.length > 0
    ? await supabase
        .from('follow_ups')
        .select('*')
        .in('appointment_id', apptIds)
        .order('scheduled_for', { ascending: true })
    : { data: [] };

  // Group follow-ups by appointment
  const followUpMap: Record<string, any[]> = {};
  (followUps || []).forEach((f: any) => {
    if (!followUpMap[f.appointment_id]) followUpMap[f.appointment_id] = [];
    followUpMap[f.appointment_id].push(f);
  });

  // Compute follow-up status per appointment
  const enriched = (appointments || []).map((appt: any) => {
    const fups = followUpMap[appt.id] || [];
    let followUpStatus = 'pending';
    if (fups.length > 0) {
      const completedCount = fups.filter((f: any) =>
        f.status === 'completed' || f.status === 'sent'
      ).length;
      if (completedCount === fups.length) followUpStatus = 'completed';
      else if (completedCount > 0) followUpStatus = 'in_progress';
    }
    const clientName = appt.clients
      ? `${appt.clients.first_name} ${appt.clients.last_name || ''}`.trim()
      : 'Unknown Client';

    return {
      ...appt,
      client_name: clientName,
      follow_up_status: followUpStatus,
      follow_ups: fups,
    };
  });

  return NextResponse.json({ appointments: enriched });
}

// PATCH — update appointment status/notes
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, business_id, ...updates } = body;

  if (!id || !business_id) {
    return NextResponse.json({ error: 'id and business_id required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('appointments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('business_id', business_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ appointment: data });
}
