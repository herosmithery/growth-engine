import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_KEY = (svcKey && !svcKey.startsWith('your')) ? svcKey : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function sbHeaders() {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

// ElevenLabs ConvAI tool-call webhook — called mid-conversation when Aria uses a tool
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool_name, parameters, conversation_id } = body;

    switch (tool_name) {
      case 'checkAvailability': {
        const { date, treatment_type } = parameters || {};
        return NextResponse.json({
          available: true,
          slots: ['10:00 AM', '1:30 PM', '3:00 PM'],
          date: date || 'today',
          treatment_type: treatment_type || 'general',
          message: `We have openings on ${date || 'today'}. Morning at 10am, afternoon at 1:30 or 3pm — which works better for you?`,
        });
      }

      case 'bookAppointment': {
        const { customer_name, customer_phone, treatment_type, datetime } = parameters || {};

        // Parse name into first/last
        const [firstName, ...rest] = (customer_name || '').split(' ');

        // Write lead to Supabase with correct schema
        let leadId: string | null = null;
        if (customer_name || customer_phone) {
          const leadRes = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
            method: 'POST',
            headers: sbHeaders(),
            body: JSON.stringify({
              business_id: 'ab445992-80fd-46d0-bec0-138a86e1d607',
              first_name: firstName || 'Unknown',
              last_name: rest.join(' ') || null,
              phone: customer_phone || null,
              source: 'elevenlabs_voice',
              source_details: `Tool call — conversation ${conversation_id}`,
              status: 'qualified',
              notes: `Booked via Aria voice agent for ${treatment_type} on ${datetime}`,
              last_contacted_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            }),
          });
          const leadRows = leadRes.ok ? await leadRes.json() : null;
          leadId = Array.isArray(leadRows) ? leadRows[0]?.id : null;
        }

        // Queue SMS booking confirmation
        if (customer_phone) {
          await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
            method: 'POST',
            headers: { ...sbHeaders(), Prefer: 'return=minimal' },
            body: JSON.stringify({
              channel: 'sms',
              direction: 'outbound',
              message_type: 'booking_confirmation',
              to_number: customer_phone,
              content: `You're confirmed at Glo MedSpa! 🌟 ${treatment_type} on ${datetime}. Reply CONFIRM or call us to reschedule. See you soon!`,
              status: 'pending',
              lead_id: leadId,
              created_at: new Date().toISOString(),
            }),
          });
        }

        const confirmationNumber = `GLO-${Date.now().toString().slice(-6)}`;

        return NextResponse.json({
          success: true,
          confirmation_number: confirmationNumber,
          lead_id: leadId,
          message: `Perfect! I've got you booked for ${treatment_type} on ${datetime}. Your confirmation number is ${confirmationNumber}. You'll get a text shortly!`,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown tool: ${tool_name}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
