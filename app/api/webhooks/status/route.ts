import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get('business_id');
  const isAdmin = searchParams.get('admin') === 'true';

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch recent events from all sources in parallel
  const [
    vapiCalls,
    stripeEvents,
    aiAppointments,
    elevenLabsCalls,
  ] = await Promise.all([
    // Vapi: recent call_logs
    supabase
      .from('call_logs')
      .select('id, vapi_call_id, caller_phone, outcome, created_at, business_id, businesses(name)')
      .gte('created_at', since7d)
      .order('created_at', { ascending: false })
      .limit(50),

    // Stripe: stripe_events table
    supabase
      .from('stripe_events')
      .select('id, stripe_event_id, event_type, processed_at, business_id')
      .gte('processed_at', since7d)
      .order('processed_at', { ascending: false })
      .limit(50),

    // AI Phone bookings → ElevenLabs/Vapi appointments
    supabase
      .from('appointments')
      .select('id, treatment_type, status, source, created_at, business_id, businesses(name)')
      .in('source', ['ai_phone', 'ai-agent', 'elevenlabs'])
      .gte('created_at', since7d)
      .order('created_at', { ascending: false })
      .limit(50),

    // ElevenLabs: call_logs with elevenlabs vapi_call_id pattern
    supabase
      .from('call_logs')
      .select('id, vapi_call_id, caller_phone, outcome, created_at')
      .like('vapi_call_id', 'el_%')
      .gte('created_at', since7d)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  // Filter by business if not admin
  const filterBiz = (items: any[], field = 'business_id') =>
    isAdmin || !businessId
      ? items
      : items.filter((i: any) => i[field] === businessId);

  const vapiData = filterBiz(vapiCalls.data || []);
  const stripeData = filterBiz(stripeEvents.data || []);
  const apptData = filterBiz(aiAppointments.data || []);

  // Health determination: green if event in last 24h, yellow if last 7d, red if none
  const health = (items: any[], dateField = 'created_at') => {
    if (!items.length) return 'inactive';
    const latest = new Date(items[0][dateField] || items[0].processed_at);
    if (latest > new Date(since24h)) return 'active';
    return 'degraded';
  };

  // Unified event log — merge and sort all events by time
  const events = [
    ...vapiData.map((c: any) => ({
      id: c.id,
      source: 'vapi',
      event_type: `call.${c.outcome || 'received'}`,
      summary: `Call from ${c.caller_phone || 'unknown'} — ${c.outcome || 'in progress'}`,
      business: (c.businesses as any)?.name || '—',
      timestamp: c.created_at,
      status: c.outcome === 'booked' ? 'success' : c.outcome === 'dropped' ? 'warning' : 'info',
    })),
    ...stripeData.map((e: any) => ({
      id: e.id,
      source: 'stripe',
      event_type: e.event_type,
      summary: e.event_type.replace(/\./g, ' → '),
      business: '—',
      timestamp: e.processed_at,
      status: e.event_type.includes('failed') ? 'error' : 'success',
    })),
    ...apptData.map((a: any) => ({
      id: a.id,
      source: a.source === 'elevenlabs' ? 'elevenlabs' : 'vapi',
      event_type: 'appointment.booked',
      summary: `${a.treatment_type || 'Appointment'} booked — ${a.status}`,
      business: (a.businesses as any)?.name || '—',
      timestamp: a.created_at,
      status: 'success',
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({
    health: {
      vapi: health(vapiData),
      stripe: health(stripeData, 'processed_at'),
      elevenlabs: health(apptData.filter((a: any) => a.source === 'elevenlabs')),
      calendar: 'unknown', // checked separately
    },
    counts: {
      vapi_calls_24h: vapiData.filter((c: any) => new Date(c.created_at) > new Date(since24h)).length,
      vapi_bookings_24h: vapiData.filter((c: any) => c.outcome === 'booked' && new Date(c.created_at) > new Date(since24h)).length,
      stripe_events_24h: stripeData.filter((e: any) => new Date(e.processed_at) > new Date(since24h)).length,
      ai_bookings_7d: apptData.length,
    },
    events: events.slice(0, 100),
  });
}
