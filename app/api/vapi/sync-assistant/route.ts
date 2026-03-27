import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST — build prompt from DB (business info + knowledge base) and push to Vapi assistant
export async function POST(request: NextRequest) {
  const { business_id } = await request.json();

  if (!business_id) {
    return NextResponse.json({ error: 'business_id required' }, { status: 400 });
  }

  const vapiKey = process.env.VAPI_API_KEY;
  if (!vapiKey) return NextResponse.json({ error: 'VAPI_API_KEY not set' }, { status: 400 });

  // Load business info
  const { data: business } = await supabase
    .from('businesses')
    .select('name, phone, vapi_assistant_id, niche_type, timezone')
    .eq('id', business_id)
    .single();

  if (!business?.vapi_assistant_id) {
    return NextResponse.json({ error: 'No vapi_assistant_id on this business' }, { status: 400 });
  }

  // Load all active knowledge base entries
  const { data: knowledge } = await supabase
    .from('knowledge_base')
    .select('category, title, content')
    .eq('business_id', business_id)
    .eq('is_active', true)
    .order('category');

  // Group knowledge by category
  const kb: Record<string, string[]> = {};
  (knowledge || []).forEach((e: any) => {
    if (!kb[e.category]) kb[e.category] = [];
    kb[e.category].push(`${e.title}: ${e.content}`);
  });

  const kbSections = Object.entries(kb)
    .map(([cat, items]) => `## ${cat.toUpperCase()}\n${items.join('\n')}`)
    .join('\n\n');

  const businessName = business.name || 'the business';
  const tz = business.timezone || 'America/Los_Angeles';

  const systemPrompt = `You are a friendly, professional AI receptionist for ${businessName}. Your job is to answer questions, check availability, and book appointments.

## YOUR CAPABILITIES
- Answer questions about services, pricing, hours, and policies
- Check available appointment slots
- Book appointments for callers
- End the call naturally after booking

## BUSINESS KNOWLEDGE BASE
${kbSections || 'No specific knowledge loaded yet. Use the getServices function to get current service information.'}

## BOOKING FLOW
1. Greet the caller warmly
2. Ask how you can help
3. If they want to book: collect their name, phone, preferred service, and desired date/time
4. Use checkAvailability to confirm the slot is open
5. Use bookAppointment to confirm the booking
6. Confirm details back to the caller, say goodbye, and end the call

## RULES
- Be warm, professional, and concise — this is a phone call
- Never make up prices or services not in your knowledge base — use getServices instead
- If you cannot answer something, offer to have someone call them back
- After booking, always confirm the details and say a warm goodbye
- Keep responses brief (1-3 sentences) — callers are on the phone

Timezone: ${tz}`;

  const functions = [
    {
      name: 'checkAvailability',
      description: `Check available appointment slots at ${businessName}`,
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date to check (YYYY-MM-DD)' },
          service_type: { type: 'string', description: 'Type of service requested' },
        },
        required: ['date'],
      },
    },
    {
      name: 'bookAppointment',
      description: `Book an appointment at ${businessName}`,
      parameters: {
        type: 'object',
        properties: {
          customer_name: { type: 'string', description: 'Full name of the caller' },
          customer_phone: { type: 'string', description: 'Phone number of the caller' },
          treatment_type: { type: 'string', description: 'Service to book' },
          appointment_date: { type: 'string', description: 'Date (YYYY-MM-DD)' },
          appointment_time: { type: 'string', description: 'Time (HH:MM, 24hr)' },
          notes: { type: 'string', description: 'Any special requests' },
        },
        required: ['customer_name', 'customer_phone', 'treatment_type', 'appointment_date', 'appointment_time'],
      },
    },
    {
      name: 'getServices',
      description: `Get the list of services and pricing at ${businessName}`,
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'getFaq',
      description: `Answer a specific question about ${businessName} using the knowledge base`,
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The caller\'s question' },
        },
        required: ['question'],
      },
    },
  ];

  // Push to Vapi
  const res = await fetch(`https://api.vapi.ai/assistant/${business.vapi_assistant_id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${vapiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.6,
        messages: [{ role: 'system', content: systemPrompt }],
      },
      serverUrl: `${(process.env.NEXT_PUBLIC_APP_URL || '').trim()}/api/vapi/webhook`,
      functions,
      endCallFunctionEnabled: true,
      endCallPhrases: ['goodbye', 'bye bye', 'thank you goodbye', 'have a great day goodbye', 'talk soon bye'],
      silenceTimeoutSeconds: 30,
      maxDurationSeconds: 600,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `Vapi error: ${err}` }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    assistant_id: business.vapi_assistant_id,
    knowledge_entries: knowledge?.length || 0,
    knowledge_categories: Object.keys(kb),
    message: `Assistant synced with ${knowledge?.length || 0} knowledge entries`,
  });
}
