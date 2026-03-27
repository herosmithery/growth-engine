import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

// Simulate a VAPI call for testing
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scenario = searchParams.get('scenario') || 'booking';

  // Get business
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, vapi_phone_number, vapi_assistant_id')
    .limit(1)
    .single();

  if (!business) {
    return NextResponse.json({ error: 'No business found' }, { status: 404 });
  }

  const callId = `test-call-${Date.now()}`;
  const testPhoneNumber = '+1555' + Math.random().toString().slice(2, 9);

  // Test scenarios
  const scenarios = {
    booking: {
      name: 'Booking Call',
      steps: [
        {
          type: 'call-start',
          payload: createCallStartPayload(callId, business.vapi_phone_number || null, testPhoneNumber, 'Test Customer'),
        },
        {
          type: 'function-call',
          payload: createFunctionCallPayload(callId, 'checkAvailability', { date: new Date().toISOString() }),
        },
        {
          type: 'function-call',
          payload: createFunctionCallPayload(callId, 'bookAppointment', {
            customer_name: 'Test Customer',
            customer_phone: testPhoneNumber,
            treatment_type: 'Botox Consultation',
            datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }),
        },
        {
          type: 'call-end',
          payload: createCallEndPayload(callId, business.vapi_phone_number || null, testPhoneNumber, 'booked'),
        },
      ],
    },
    inquiry: {
      name: 'Service Inquiry',
      steps: [
        {
          type: 'call-start',
          payload: createCallStartPayload(callId, business.vapi_phone_number || null, testPhoneNumber, 'Curious Caller'),
        },
        {
          type: 'function-call',
          payload: createFunctionCallPayload(callId, 'getServices', {}),
        },
        {
          type: 'call-end',
          payload: createCallEndPayload(callId, business.vapi_phone_number || null, testPhoneNumber, 'info_only'),
        },
      ],
    },
    dropped: {
      name: 'Dropped Call',
      steps: [
        {
          type: 'call-start',
          payload: createCallStartPayload(callId, business.vapi_phone_number || null, testPhoneNumber, null),
        },
        {
          type: 'call-end',
          payload: createCallEndPayload(callId, business.vapi_phone_number || null, testPhoneNumber, 'dropped', 5),
        },
      ],
    },
  };

  const selectedScenario = scenarios[scenario as keyof typeof scenarios] || scenarios.booking;
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/vapi/webhook`;
  const results: any[] = [];

  // Execute each step
  for (const step of selectedScenario.steps) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(step.payload),
      });

      const result = await response.json();
      results.push({
        step: step.type,
        status: response.status,
        result,
      });

      // Small delay between steps
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      results.push({
        step: step.type,
        error: String(error),
      });
    }
  }

  // Get the created call log
  const { data: callLog } = await supabase
    .from('call_logs')
    .select('*')
    .eq('vapi_call_id', callId)
    .single();

  return NextResponse.json({
    success: true,
    scenario: selectedScenario.name,
    call_id: callId,
    phone_number: testPhoneNumber,
    steps_executed: results,
    call_log: callLog,
  });
}

// List available test scenarios
export async function GET() {
  return NextResponse.json({
    available_scenarios: [
      {
        name: 'booking',
        description: 'Full booking flow - checks availability, books appointment',
      },
      {
        name: 'inquiry',
        description: 'Service inquiry - asks about services, ends without booking',
      },
      {
        name: 'dropped',
        description: 'Dropped call - short call that ends quickly',
      },
    ],
    usage: 'POST /api/vapi/test?scenario=booking',
  });
}

// Helper functions to create payloads
function createCallStartPayload(callId: string, phoneNumberId: string | null, customerPhone: string, customerName: string | null) {
  return {
    type: 'call-start',
    call: {
      id: callId,
      phoneNumberId: phoneNumberId,
      customer: {
        number: customerPhone,
        name: customerName,
      },
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      status: 'in_progress',
    },
  };
}

function createFunctionCallPayload(callId: string, functionName: string, parameters: any) {
  return {
    type: 'function-call',
    call: {
      id: callId,
    },
    functionCall: {
      name: functionName,
      parameters,
    },
  };
}

function createCallEndPayload(callId: string, phoneNumberId: string | null, customerPhone: string, outcome: string, durationSeconds: number = 180) {
  const startTime = new Date(Date.now() - durationSeconds * 1000);
  const endTime = new Date();

  const summaries: Record<string, string> = {
    booked: 'Customer called to book a Botox consultation. Appointment was successfully scheduled for tomorrow.',
    info_only: 'Customer inquired about available services and pricing. Expressed interest in Botox and fillers.',
    dropped: 'Call was disconnected shortly after connecting.',
    callback_requested: 'Customer requested a callback as they were busy. Left contact information.',
  };

  return {
    type: 'call-end',
    call: {
      id: callId,
      phoneNumberId: phoneNumberId,
      customer: {
        number: customerPhone,
      },
      startedAt: startTime.toISOString(),
      endedAt: endTime.toISOString(),
      status: 'ended',
    },
    summary: summaries[outcome] || 'Call ended.',
    endedReason: outcome === 'dropped' ? 'customer_hangup' : 'call_completed',
    messages: [
      { role: 'assistant', content: 'Hello! Thank you for calling our business. How can I help you today?', time: startTime.getTime() },
      { role: 'user', content: 'Hi, I am interested in booking an appointment.', time: startTime.getTime() + 5000 },
      { role: 'assistant', content: 'I would be happy to help you with that. What treatment are you interested in?', time: startTime.getTime() + 8000 },
      { role: 'user', content: 'I want to get Botox.', time: startTime.getTime() + 15000 },
    ],
    analysis: {
      summary: summaries[outcome],
    },
  };
}
