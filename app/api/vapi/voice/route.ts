import { NextRequest, NextResponse } from 'next/server';

// GET - fetch available ElevenLabs voices
export async function GET() {
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

  if (!elevenLabsKey || elevenLabsKey === 'your-elevenlabs-api-key-here') {
    return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 400 });
  }

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': elevenLabsKey },
    });

    if (!res.ok) throw new Error(`ElevenLabs API error: ${res.status}`);

    const data = await res.json();

    const voices = data.voices.map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category,
      preview_url: v.preview_url,
    }));

    return NextResponse.json({ voices, current_voice_id: process.env.ELEVENLABS_VOICE_ID });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST - apply an ElevenLabs voice to the Vapi assistant
export async function POST(request: NextRequest) {
  const vapiKey = process.env.VAPI_API_KEY;
  const assistantId = process.env.VAPI_ASSISTANT_ID;
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

  if (!vapiKey || vapiKey === 'your-vapi-api-key-here') {
    return NextResponse.json({ error: 'Vapi API key not configured' }, { status: 400 });
  }
  if (!assistantId || assistantId === 'your-vapi-assistant-id-here') {
    return NextResponse.json({ error: 'Vapi assistant ID not configured' }, { status: 400 });
  }
  if (!elevenLabsKey || elevenLabsKey === 'your-elevenlabs-api-key-here') {
    return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 400 });
  }

  try {
    const { voice_id, stability = 0.5, similarity_boost = 0.75 } = await request.json();

    if (!voice_id) {
      return NextResponse.json({ error: 'voice_id required' }, { status: 400 });
    }

    // Update Vapi assistant voice to ElevenLabs
    const res = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${vapiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voice: {
          provider: '11labs',
          voiceId: voice_id,
          stability,
          similarityBoost: similarity_boost,
          optimizeStreamingLatency: 3,
        },
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Vapi error: ${error}`);
    }

    const updated = await res.json();

    return NextResponse.json({
      success: true,
      message: 'Voice updated on Vapi assistant',
      voice_id,
      assistant_id: assistantId,
      assistant_name: updated.name,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
