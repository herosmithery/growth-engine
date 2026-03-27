import { NextRequest, NextResponse } from 'next/server';

const EL_BASE = 'https://api.elevenlabs.io/v1';

function elHeaders() {
  return {
    'xi-api-key': process.env.ELEVENLABS_API_KEY!,
    'Content-Type': 'application/json',
  };
}

// GET — list phone numbers connected to ElevenLabs
export async function GET() {
  const elKey = process.env.ELEVENLABS_API_KEY;
  if (!elKey || elKey === 'your-elevenlabs-api-key-here') {
    return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 400 });
  }

  try {
    const res = await fetch(`${EL_BASE}/convai/phone-numbers`, {
      headers: elHeaders(),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`ElevenLabs error: ${error}`);
    }

    const data = await res.json();
    return NextResponse.json({ phone_numbers: data.phone_numbers || [] });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST — connect a Twilio phone number to ElevenLabs and assign to Aria
export async function POST(request: NextRequest) {
  const elKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;

  if (!elKey || elKey === 'your-elevenlabs-api-key-here') {
    return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 400 });
  }
  if (!agentId) {
    return NextResponse.json({ error: 'ELEVENLABS_AGENT_ID not configured — deploy Aria first' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { phone_number, twilio_account_sid, twilio_auth_token } = body;

    // Validate phone number format
    if (!phone_number || !phone_number.startsWith('+')) {
      return NextResponse.json({ error: 'phone_number must be in E.164 format (e.g. +15551234567)' }, { status: 400 });
    }

    // Use provided Twilio creds or fall back to env vars
    const sid = twilio_account_sid || process.env.TWILIO_ACCOUNT_SID;
    const token = twilio_auth_token || process.env.TWILIO_AUTH_TOKEN;

    if (!sid || !token) {
      return NextResponse.json({
        error: 'Twilio credentials required. Provide twilio_account_sid and twilio_auth_token, or set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in env.',
      }, { status: 400 });
    }

    // Register the Twilio number with ElevenLabs
    const registerRes = await fetch(`${EL_BASE}/convai/phone-numbers/create`, {
      method: 'POST',
      headers: elHeaders(),
      body: JSON.stringify({
        phone_number,
        phone_number_provider: 'twilio',
        credentials: {
          account_sid: sid,
          auth_token: token,
        },
        agent_id: agentId,
      }),
    });

    if (!registerRes.ok) {
      const error = await registerRes.text();
      throw new Error(`ElevenLabs error: ${error}`);
    }

    const registered = await registerRes.json();

    return NextResponse.json({
      success: true,
      message: `${phone_number} is now connected to Aria — she will answer all inbound calls`,
      phone_number_id: registered.phone_number_id,
      phone_number,
      agent_id: agentId,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// PATCH — reassign an existing connected number to a different agent
export async function PATCH(request: NextRequest) {
  const elKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;

  if (!elKey) return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 400 });

  try {
    const { phone_number_id, new_agent_id } = await request.json();
    if (!phone_number_id) return NextResponse.json({ error: 'phone_number_id required' }, { status: 400 });

    const res = await fetch(`${EL_BASE}/convai/phone-numbers/${phone_number_id}`, {
      method: 'PATCH',
      headers: elHeaders(),
      body: JSON.stringify({ agent_id: new_agent_id || agentId }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`ElevenLabs error: ${error}`);
    }

    return NextResponse.json({ success: true, message: 'Phone number reassigned' });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
