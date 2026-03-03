import { NextResponse } from 'next/server';
import { GloMedSpaVoicePrompt, GloMedSpaConversationFlows } from '@/lib/niches/glo-medspa';

// POST - push Glo MedSpa prompt to Vapi assistant
export async function POST() {
  const vapiKey = process.env.VAPI_API_KEY;
  const assistantId = process.env.VAPI_ASSISTANT_ID;

  if (!vapiKey || vapiKey === 'your-vapi-api-key-here') {
    return NextResponse.json({ error: 'VAPI_API_KEY not configured' }, { status: 400 });
  }
  if (!assistantId || assistantId === 'your-vapi-assistant-id-here') {
    return NextResponse.json({ error: 'VAPI_ASSISTANT_ID not configured' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${vapiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Aria — Glo MedSpa',
        firstMessage: 'Thank you for calling Glo MedSpa, this is Aria! How can I help you glow today?',
        model: {
          provider: 'openai',
          model: 'gpt-4o',
          temperature: 0.7,
          messages: [
            {
              role: 'system',
              content: GloMedSpaVoicePrompt,
            },
          ],
        },
        voice: {
          provider: '11labs',
          voiceId: process.env.ELEVENLABS_VOICE_ID || 'rachel',
          stability: 0.45,
          similarityBoost: 0.80,
          optimizeStreamingLatency: 3,
        },
        transcriber: {
          provider: 'deepgram',
          model: 'nova-2',
          language: 'en-US',
        },
        silenceTimeoutSeconds: 30,
        maxDurationSeconds: 600,
        backgroundDenoisingEnabled: true,
        endCallFunctionEnabled: true,
        endCallPhrases: ['goodbye', 'bye bye', 'thank you bye', 'have a good day', 'talk soon'],
        functions: [
          {
            name: 'checkAvailability',
            description: 'Check available appointment slots for a given date and treatment type',
            parameters: {
              type: 'object',
              properties: {
                date: { type: 'string', description: 'The date to check availability for (YYYY-MM-DD)' },
                treatment_type: { type: 'string', description: 'Type of treatment requested' },
              },
              required: ['date'],
            },
          },
          {
            name: 'bookAppointment',
            description: 'Book an appointment for a client',
            parameters: {
              type: 'object',
              properties: {
                customer_name: { type: 'string', description: 'Full name of the client' },
                customer_phone: { type: 'string', description: 'Phone number of the client' },
                treatment_type: { type: 'string', description: 'Type of treatment to book' },
                datetime: { type: 'string', description: 'Appointment datetime (ISO 8601)' },
              },
              required: ['customer_name', 'customer_phone', 'treatment_type', 'datetime'],
            },
          },
          {
            name: 'getServices',
            description: 'Get list of services and pricing offered at Glo MedSpa',
            parameters: { type: 'object', properties: {} },
          },
        ],
        serverUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/api/vapi/webhook`,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Vapi error: ${error}`);
    }

    const updated = await res.json();

    return NextResponse.json({
      success: true,
      message: 'Glo MedSpa prompt pushed to Vapi — Aria is live',
      assistant_id: assistantId,
      assistant_name: updated.name,
      flows: GloMedSpaConversationFlows,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// GET - preview the prompt without pushing
export async function GET() {
  return NextResponse.json({
    prompt: GloMedSpaVoicePrompt,
    flows: GloMedSpaConversationFlows,
    agent_name: 'Aria',
    business: 'Glo MedSpa',
  });
}
