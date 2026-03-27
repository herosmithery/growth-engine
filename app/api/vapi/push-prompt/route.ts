import { NextResponse } from 'next/server';
import { generateUniversalVoicePrompt, UniversalConversationFlows, BusinessConfig } from '@/lib/niches/universal-business-config';
import { ExampleBusinessConfigs } from '@/lib/niches/example-configs';

/**
 * UNIVERSAL VAPI PROMPT PUSHER
 *
 * This endpoint pushes business-specific AI caller prompts to VAPI.
 * Now supports ANY business type through the universal config system.
 *
 * Usage:
 * POST /api/vapi/push-prompt
 * Body: { businessConfig: BusinessConfig } OR { exampleType: "dental" | "law" | ... }
 *
 * For SaaS clients: They provide their full BusinessConfig
 * For testing: Use exampleType to load pre-built configs
 */

// POST - push universal business prompt to Vapi assistant
export async function POST(request: Request) {
  const vapiKey = process.env.VAPI_API_KEY;
  const assistantId = process.env.VAPI_ASSISTANT_ID;

  if (!vapiKey || vapiKey === 'your-vapi-api-key-here') {
    return NextResponse.json({ error: 'VAPI_API_KEY not configured' }, { status: 400 });
  }
  if (!assistantId || assistantId === 'your-vapi-assistant-id-here') {
    return NextResponse.json({ error: 'VAPI_ASSISTANT_ID not configured' }, { status: 400 });
  }

  try {
    const body = await request.json();

    // Get business config from request or use example
    let businessConfig: BusinessConfig;

    if (body.businessConfig) {
      // SaaS client provided their own config
      businessConfig = body.businessConfig;
    } else if (body.exampleType && ExampleBusinessConfigs[body.exampleType as keyof typeof ExampleBusinessConfigs]) {
      // Load example config for testing
      businessConfig = ExampleBusinessConfigs[body.exampleType as keyof typeof ExampleBusinessConfigs];
    } else {
      return NextResponse.json({
        error: 'Missing businessConfig or exampleType',
        availableExamples: Object.keys(ExampleBusinessConfigs),
        example: {
          businessConfig: {
            name: 'Your Business Name',
            industry: 'your-industry',
            // ... (see /lib/niches/universal-business-config.ts for full schema)
          }
        }
      }, { status: 400 });
    }

    // Generate the AI voice prompt from business config
    const voicePrompt = generateUniversalVoicePrompt(businessConfig);

    // Build VAPI functions based on industry
    const functions = buildVapiFunctions(businessConfig);

    // Push to VAPI
    const res = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${vapiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `${businessConfig.aiAssistant.name} — ${businessConfig.name}`,
        firstMessage: businessConfig.aiAssistant.greeting,
        model: {
          provider: 'openai',
          model: 'gpt-4o',
          temperature: 0.7,
          messages: [
            {
              role: 'system',
              content: voicePrompt,
            },
          ],
        },
        voice: {
          provider: '11labs',
          voiceId: businessConfig.aiAssistant.voiceId || process.env.ELEVENLABS_VOICE_ID || 'rachel',
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
        functions,
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
      message: `${businessConfig.aiAssistant.name} is now live for ${businessConfig.name}`,
      assistant_id: assistantId,
      assistant_name: updated.name,
      business_name: businessConfig.name,
      business_industry: businessConfig.industry,
      flows: UniversalConversationFlows,
      voicePrompt: voicePrompt, // Return for debugging
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// GET - preview the prompt without pushing (for testing)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const exampleType = searchParams.get('example') || 'dental';

  const businessConfig = ExampleBusinessConfigs[exampleType as keyof typeof ExampleBusinessConfigs]
    || ExampleBusinessConfigs.dental;

  const voicePrompt = generateUniversalVoicePrompt(businessConfig);

  return NextResponse.json({
    business_name: businessConfig.name,
    business_industry: businessConfig.industry,
    agent_name: businessConfig.aiAssistant.name,
    prompt: voicePrompt,
    flows: UniversalConversationFlows,
    config: businessConfig,
    availableExamples: Object.keys(ExampleBusinessConfigs),
    usage: {
      preview: 'GET /api/vapi/push-prompt?example=dental',
      push: 'POST /api/vapi/push-prompt with { exampleType: "dental" } or { businessConfig: {...} }'
    }
  });
}

// ============================================================================
// HELPER: Build VAPI Functions Based on Industry
// ============================================================================

function buildVapiFunctions(config: BusinessConfig) {
  const functions: any[] = [
    {
      name: 'checkAvailability',
      description: `Check available appointment slots for ${config.name}`,
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'The date to check availability for (YYYY-MM-DD)' },
          service_type: { type: 'string', description: 'Type of service requested' },
          preferred_time: { type: 'string', enum: ['morning', 'afternoon', 'evening'], description: 'Preferred time of day' },
        },
        required: ['date'],
      },
    },
    {
      name: 'bookAppointment',
      description: `Book an appointment for a client at ${config.name}`,
      parameters: {
        type: 'object',
        properties: {
          customer_name: { type: 'string', description: 'Full name of the client' },
          customer_phone: { type: 'string', description: 'Phone number of the client' },
          customer_email: { type: 'string', description: 'Email address of the client' },
          service_type: { type: 'string', description: 'Type of service to book' },
          datetime: { type: 'string', description: 'Appointment datetime (ISO 8601)' },
          notes: { type: 'string', description: 'Any special requests or notes' },
        },
        required: ['customer_name', 'customer_phone', 'service_type', 'datetime'],
      },
    },
    {
      name: 'getServices',
      description: `Get list of services and pricing offered at ${config.name}`,
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Optional: filter by service category' },
        },
      },
    },
  ];

  // Add industry-specific functions
  if (config.payment?.acceptsInsurance) {
    functions.push({
      name: 'verifyInsurance',
      description: 'Verify if a specific insurance provider is accepted',
      parameters: {
        type: 'object',
        properties: {
          insurance_provider: { type: 'string', description: 'Name of insurance provider' },
          member_id: { type: 'string', description: 'Insurance member ID (optional)' },
        },
        required: ['insurance_provider'],
      },
    });
  }

  // Emergency handling for certain industries
  if (['dental', 'medical', 'home services'].includes(config.industry)) {
    functions.push({
      name: 'handleEmergency',
      description: 'Flag urgent/emergency situations for immediate attention',
      parameters: {
        type: 'object',
        properties: {
          emergency_type: { type: 'string', description: 'Type of emergency' },
          severity: { type: 'string', enum: ['urgent', 'critical'], description: 'Severity level' },
          caller_name: { type: 'string', description: 'Name of caller' },
          caller_phone: { type: 'string', description: 'Phone number for callback' },
        },
        required: ['emergency_type', 'severity', 'caller_name', 'caller_phone'],
      },
    });
  }

  return functions;
}
