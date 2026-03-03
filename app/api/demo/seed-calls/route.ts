import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_KEY = (svcKey && !svcKey.startsWith('your')) ? svcKey : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BUSINESS_ID = 'ab445992-80fd-46d0-bec0-138a86e1d607';

function sbHeaders() {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

const demoTranscript = (lines: string[][]) =>
  JSON.stringify(lines.map(([role, message], i) => ({ role, message, timestamp: `0:${String(i * 8).padStart(2, '0')}` })));

const DEMO_CALLS = [
  {
    business_id: BUSINESS_ID,
    caller_phone: '+19104521234',
    caller_name: 'Sarah Johnson',
    vapi_call_id: 'conv_demo_001',
    requested_treatment: 'Botox Consultation',
    outcome: 'booked',
    duration_seconds: 247,
    summary: 'Caller asked about Botox pricing. Aria explained the per-unit cost and typical ranges. Caller booked a complimentary consultation for Thursday at 10am.',
    transcript: demoTranscript([
      ['ai', 'Thank you for calling Glo MedSpa, this is Aria! How can I help you glow today?'],
      ['user', 'Hi, I wanted to ask about Botox. How much does it cost?'],
      ['ai', 'Botox at Glo starts at $12 per unit. Most areas typically need 20–40 units — so $240 to $480 for a full treatment. Best way to get an exact number is a quick free consultation!'],
      ['user', 'That sounds great. Can I book a consultation?'],
      ['ai', 'Absolutely! Can I get your first and last name?'],
      ['user', 'Sarah Johnson'],
      ['ai', 'We have Thursday at 10am or Friday at 2pm. Which works better?'],
      ['user', 'Thursday at 10 works great.'],
      ['ai', "Perfect! I've got you booked for a complimentary Botox consultation Thursday at 10am. You'll get a text confirmation shortly!"],
    ]),
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    business_id: BUSINESS_ID,
    caller_phone: '+19107893456',
    caller_name: null,
    vapi_call_id: 'conv_demo_002',
    requested_treatment: 'Lip Fillers',
    outcome: 'callback_requested',
    duration_seconds: 183,
    summary: 'Caller asked about lip filler pricing and expressed nervousness. Aria addressed concerns about pain and safety. Caller requested a callback.',
    transcript: demoTranscript([
      ['ai', 'Thank you for calling Glo MedSpa, this is Aria! How can I help you glow today?'],
      ['user', "I've been thinking about lip fillers but I'm kind of nervous about it."],
      ['ai', "That's completely normal — most of our clients felt the same way before their first visit. Our providers are incredibly gentle and walk you through everything. You're always in control."],
      ['user', 'Is it going to hurt a lot?'],
      ['ai', 'Most people describe it as a tiny pinch — over in seconds. We can apply numbing cream beforehand too. Most clients are surprised by how comfortable it is!'],
      ['user', 'How much would it cost?'],
      ['ai', 'Dermal fillers start at $650 per syringe. For lips, most clients need one syringe to start. Can I have a specialist call you back with more details?'],
      ['user', 'Yes please, that would be helpful.'],
    ]),
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    business_id: BUSINESS_ID,
    caller_phone: '+19103217890',
    caller_name: 'Marcus Williams',
    vapi_call_id: 'conv_demo_003',
    requested_treatment: 'HydraFacial Platinum',
    outcome: 'booked',
    duration_seconds: 312,
    summary: 'Returning client called to book a Platinum HydraFacial. Aria confirmed returning status and booked Saturday at 11am.',
    transcript: demoTranscript([
      ['ai', 'Thank you for calling Glo MedSpa, this is Aria! How can I help you glow today?'],
      ['user', "Hi, I'd like to book a HydraFacial. I've been there before."],
      ['ai', "Welcome back! So glad to have you returning. Which HydraFacial — the Elite at $195 or the Platinum at $225?"],
      ['user', 'The Platinum one, I did it last time and loved it.'],
      ['ai', 'Great choice! Can I get your name and best number?'],
      ['user', 'Marcus Williams, (910) 321-7890'],
      ['ai', 'We have Saturday at 11am or Monday at 2pm. Which works?'],
      ['user', 'Saturday works great.'],
      ['ai', "You're all set! Platinum HydraFacial Saturday at 11am. Text confirmation is on its way. See you then!"],
    ]),
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    business_id: BUSINESS_ID,
    caller_phone: '+19108564321',
    caller_name: null,
    vapi_call_id: 'conv_demo_004',
    requested_treatment: 'Laser Hair Removal',
    outcome: 'info_only',
    duration_seconds: 98,
    summary: "Caller asked about laser hair removal packages and pricing. Aria provided info. Caller said they'd think about it and call back.",
    transcript: demoTranscript([
      ['ai', 'Thank you for calling Glo MedSpa, this is Aria! How can I help you glow today?'],
      ['user', 'What are your laser hair removal prices?'],
      ['ai', 'Laser hair removal packages start from $299 depending on the area. We have single-session and packages that save quite a bit. Want to come in for a free consultation to get exact pricing?'],
      ['user', "I'll have to think about it. Can I call back?"],
      ['ai', "Of course! We're here Mon–Fri 9–6, Saturdays 9–4. Have a wonderful day!"],
    ]),
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    business_id: BUSINESS_ID,
    caller_phone: '+19106782345',
    caller_name: null,
    vapi_call_id: 'conv_demo_005',
    requested_treatment: null,
    outcome: 'dropped',
    duration_seconds: 12,
    summary: 'Caller disconnected after greeting. Likely wrong number.',
    transcript: demoTranscript([
      ['ai', 'Thank you for calling Glo MedSpa, this is Aria! How can I help you glow today?'],
    ]),
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export async function POST() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 400 });
  }

  // Skip calls already seeded
  const existing = await fetch(`${SUPABASE_URL}/rest/v1/call_logs?vapi_call_id=like.conv_demo_%&select=vapi_call_id`, {
    headers: sbHeaders(),
  });
  const existingRows = existing.ok ? await existing.json() : [];
  const existingIds = new Set((existingRows as { vapi_call_id: string }[]).map(r => r.vapi_call_id));

  const toInsert = DEMO_CALLS.filter(c => !existingIds.has(c.vapi_call_id));

  if (toInsert.length === 0) {
    return NextResponse.json({ success: true, message: 'Demo data already loaded', call_log_ids: [] });
  }

  const results: { success: number; failed: number; ids: string[] } = { success: 0, failed: 0, ids: [] };

  for (const call of toInsert) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/call_logs`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify(call),
    });

    if (res.ok) {
      const rows = await res.json();
      results.success++;
      if (rows[0]?.id) results.ids.push(rows[0].id);
    } else {
      results.failed++;
    }
  }

  return NextResponse.json({
    success: true,
    message: `Seeded ${results.success} demo calls${results.failed ? ` (${results.failed} failed)` : ''}`,
    call_log_ids: results.ids,
  });
}

export async function DELETE() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/call_logs?vapi_call_id=like.conv_demo_%`,
    { method: 'DELETE', headers: sbHeaders() }
  );
  return NextResponse.json({ success: res.ok, message: res.ok ? 'Demo calls cleared' : 'Failed to clear' });
}
