import { NextResponse } from 'next/server';
import { GloMedSpaVoicePrompt, GloMedSpaConversationFlows } from '@/lib/niches/glo-medspa';

const EL_BASE = 'https://api.elevenlabs.io/v1';

function getHeaders() {
  return {
    'xi-api-key': process.env.ELEVENLABS_API_KEY!,
    'Content-Type': 'application/json',
  };
}

function buildAgentPayload() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  const postCallWebhookUrl = appUrl ? `${appUrl}/api/elevenlabs/post-call` : null;

  return {
    name: 'Aria — Glo MedSpa',
    conversation_config: {
      agent: {
        prompt: {
          prompt: GloMedSpaVoicePrompt,
          llm: 'gpt-4o',
          temperature: 0.7,
          tools: [],
        },
        first_message: 'Thank you for calling Glo MedSpa, this is Aria! How can I help you glow today?',
        language: 'en',
      },
      tts: {
        voice_id: process.env.ELEVENLABS_VOICE_ID || 'eXpIbVcVbLo8ZJQDlDnl',
        model_id: 'eleven_v3_conversational',
        stability: 0.45,
        similarity_boost: 0.80,
      },
      turn: {
        turn_timeout: 30,
        mode: 'turn',
      },
    },
    platform_settings: {
      auth: {
        enable_auth: false,
      },
      evaluation: {
        criteria: [
          { id: 'booking_success', name: 'Booking Completed', type: 'prompt', conversation_goal_prompt: 'Did Aria successfully book an appointment for the caller?' },
          { id: 'lead_captured', name: 'Lead Captured', type: 'prompt', conversation_goal_prompt: 'Did Aria capture the caller\'s name and contact information?' },
        ],
      },
      ...(postCallWebhookUrl && {
        post_call_webhook_url: postCallWebhookUrl,
      }),
    },
  };
}

// POST — create or update the Aria agent
export async function POST() {
  const elKey = process.env.ELEVENLABS_API_KEY;
  if (!elKey || elKey === 'your-elevenlabs-api-key-here') {
    return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 400 });
  }

  try {
    const existingAgentId = process.env.ELEVENLABS_AGENT_ID;

    let res: Response;
    let method = 'POST';
    let url = `${EL_BASE}/convai/agents/create`;

    if (existingAgentId) {
      // Update existing agent
      method = 'PATCH';
      url = `${EL_BASE}/convai/agents/${existingAgentId}`;
    }

    res = await fetch(url, {
      method,
      headers: getHeaders(),
      body: JSON.stringify(buildAgentPayload()),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`ElevenLabs error: ${error}`);
    }

    const agent = await res.json();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
    return NextResponse.json({
      success: true,
      message: existingAgentId
        ? 'Aria updated in ElevenLabs ConvAI'
        : 'Aria created in ElevenLabs ConvAI — save ELEVENLABS_AGENT_ID to .env.local',
      agent_id: agent.agent_id,
      agent_name: agent.name,
      post_call_webhook: appUrl ? `${appUrl}/api/elevenlabs/post-call` : 'not set — update NEXT_PUBLIC_APP_URL in .env.local',
      widget_url: `https://elevenlabs.io/convai/${agent.agent_id}`,
      embed_snippet: `<elevenlabs-convai agent-id="${agent.agent_id}"></elevenlabs-convai>\n<script src="https://elevenlabs.io/convai-widget/index.js" async></script>`,
      flows: GloMedSpaConversationFlows,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// GET — preview agent config without pushing
export async function GET() {
  const existingAgentId = process.env.ELEVENLABS_AGENT_ID;

  if (existingAgentId) {
    // Fetch live agent from ElevenLabs
    const res = await fetch(`${EL_BASE}/convai/agents/${existingAgentId}`, {
      headers: getHeaders(),
    });
    if (res.ok) {
      const agent = await res.json();
      return NextResponse.json({
        agent_id: existingAgentId,
        agent_name: agent.name,
        widget_url: `https://elevenlabs.io/convai/${existingAgentId}`,
        embed_snippet: `<elevenlabs-convai agent-id="${existingAgentId}"></elevenlabs-convai>\n<script src="https://elevenlabs.io/convai-widget/index.js" async></script>`,
        prompt_preview: GloMedSpaVoicePrompt.slice(0, 500) + '...',
      });
    }
  }

  return NextResponse.json({
    message: 'No agent deployed yet. POST to create Aria.',
    prompt_preview: GloMedSpaVoicePrompt.slice(0, 500) + '...',
    flows: GloMedSpaConversationFlows,
  });
}
