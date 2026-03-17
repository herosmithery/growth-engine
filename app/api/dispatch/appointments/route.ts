import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUSINESS_ID = 'ab445992-80fd-46d0-bec0-138a86e1d607';

// Score no-show risk based on appointment history + time of day
function scoreNoShowRisk(appt: Record<string, unknown>): 'LOW' | 'MEDIUM' | 'HIGH' {
  const hour = parseInt((appt.start_time as string || '09:00').split(':')[0]);
  const status = appt.status as string;
  // Early morning or afternoon gaps = higher risk
  if (status === 'scheduled' && (hour < 9 || hour >= 14)) return 'HIGH';
  if (status === 'scheduled') return 'MEDIUM';
  return 'LOW';
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select(`
        id, treatment_name, treatment_type, treatment_category,
        provider_name, start_time, end_time, duration_minutes,
        status, price, amount, notes, appointment_date,
        clients (id, first_name, last_name, phone, email)
      `)
      .eq('business_id', BUSINESS_ID)
      .eq('appointment_date', date)
      .order('start_time', { ascending: true });

    if (error) throw error;

    // Shape data for the Dispatch page
    const shaped = (appointments || []).map((a, idx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = a.clients as any;
      return {
      id: a.id,
      time: a.start_time?.slice(0, 5) || '00:00',
      client: c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : 'Unknown',
      phone: c?.phone || '',
      service: a.treatment_name || a.treatment_type || 'Service',
      provider: a.provider_name || 'Unassigned',
      status: a.status || 'scheduled',
      noShowRisk: scoreNoShowRisk(a as Record<string, unknown>),
      notes: a.notes || '',
      duration: a.duration_minutes || 30,
      price: a.price || a.amount || 0,
      order: idx,
    };});

    return NextResponse.json({ appointments: shaped, date });
  } catch (err) {
    console.error('[dispatch/appointments] error:', err);
    // Return mock data if DB not ready
    return NextResponse.json({
      appointments: [],
      date: new Date().toISOString().split('T')[0],
      error: 'DB fetch failed — no appointments found',
    });
  }
}

// PATCH: Update appointment status (confirm, complete, no_show)
export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json();
    if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });

    const { error } = await supabase
      .from('appointments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('business_id', BUSINESS_ID);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
