import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const LOG_FILE = '/Users/johnkraeger/Downloads/growth engine/ai_agency/webhook_debug.log';

function logToFile(msg: string) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${msg}\n`);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

import { getNicheConfig } from '@/lib/niches';
import { BusinessConfig } from '@/lib/niches/universal-business-config';

// VAPI Event Types - supports both direct type and message.type formats
type VAPIEventType =
  | 'call-start'
  | 'call-end'
  | 'end-of-call-report'
  | 'transcript'
  | 'function-call'
  | 'assistant-request'
  | 'status-update'
  | 'speech-update'
  | 'hang';

interface VAPIWebhookPayload {
  // Direct type (for testing/legacy)
  type?: VAPIEventType;
  // VAPI actual format - type is in message object
  message?: {
    type: VAPIEventType;
    [key: string]: any;
  };
  call?: {
    id: string;
    phoneNumberId?: string;
    customer?: {
      number?: string;
      name?: string;
    };
    createdAt?: string;
    startedAt?: string;
    endedAt?: string;
    status?: string;
  };
  transcript?: string;
  // VAPI format: messages array with role/message pairs
  messages?: Array<{
    role: 'assistant' | 'user' | 'system' | 'tool' | 'bot';
    content?: string;
    message?: string; // VAPI uses 'message' not 'content'
    time?: number;
  }>;
  summary?: string;
  recordingUrl?: string;
  stereoRecordingUrl?: string;
  endedReason?: string;
  analysis?: {
    summary?: string;
    structuredData?: any;
  };
  functionCall?: {
    name: string;
    parameters: any;
  };
  // VAPI phone number info
  phoneNumber?: {
    id: string;
    number: string;
  };
  // VAPI customer info at root level
  customer?: {
    number: string;
    name?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload: VAPIWebhookPayload = await request.json();

    // VAPI sends type in message.type, but we also support direct type for testing
    const eventType = payload.message?.type || payload.type;

    // Log event type for monitoring (kept minimal for production)
    console.log('[VAPI Webhook] Event:', eventType, '| Call ID:', payload.call?.id || 'N/A');

    // Find business by VAPI assistant ID or phone number
    let business = null;

    // 1. Try to find by direct Assistant ID (most accurate for multi-tenant)
    if (payload.message?.assistantId || (payload as any).assistantId) {
      const assistantId = payload.message?.assistantId || (payload as any).assistantId;
      logToFile(`Looking up business by Assistant ID: ${assistantId}`);
      const { data: byAssistant, error: assistantError } = await supabase
        .from('businesses')
        .select('id, name, vapi_assistant_id')
        .eq('vapi_assistant_id', assistantId)
        .limit(1);
      
      if (assistantError) {
        logToFile(`Assistant lookup error: ${JSON.stringify(assistantError)}`);
      }
      if (byAssistant && byAssistant.length > 0) {
        business = byAssistant[0];
        logToFile(`Found business by Assistant ID: ${business.name} (${business.id})`);
      }
    }

    // 2. Fallback: Try to find by phone number ID
    if (!business && payload.call?.phoneNumberId) {
      logToFile(`Fallback: Looking up by phone number ID: ${payload.call.phoneNumberId}`);
      const { data: byPhoneId, error: phoneError } = await supabase
        .from('businesses')
        .select('id, name, vapi_phone_number, vapi_assistant_id')
        .eq('vapi_phone_number', '+1' + payload.call.phoneNumberId.replace(/\D/g, '').slice(-10))
        .limit(1);
      
      if (phoneError) {
        logToFile(`Phone lookup error: ${JSON.stringify(phoneError)}`);
      }
      if (byPhoneId && byPhoneId.length > 0) {
        business = byPhoneId[0];
        logToFile(`Found business by phone: ${business.name} (${business.id})`);
      }
    }

    // 3. Last Resort: Use first available business (Dev mode fallback)
    if (!business) {
      logToFile('Last Resort: Fallback to first business in DB');
      const { data: defaultBusiness, error: defaultError } = await supabase
        .from('businesses')
        .select('id, name, vapi_phone_number, vapi_assistant_id')
        .limit(1);
      
      if (defaultError) {
        logToFile(`Default business error: ${JSON.stringify(defaultError)}`);
      }
      if (defaultBusiness && defaultBusiness.length > 0) {
        business = defaultBusiness[0];
        logToFile(`Found default business: ${business.name} (${business.id})`);
      }
    }

    const businessId = business?.id;
    logToFile(`Final Business ID: ${businessId}`);

    switch (eventType) {
      case 'call-start':
      case 'assistant-request': // VAPI sends this at call start
        await handleCallStart(payload, businessId);
        break;

      case 'call-end':
      case 'end-of-call-report': // VAPI sends this with full call data
        console.log('[VAPI] Processing end-of-call-report for business:', businessId);
        try {
          await handleCallEnd(payload, businessId, business?.name, business?.niche_type);
        } catch (err) {
          console.error('[VAPI] handleCallEnd error:', err);
        }
        break;

      case 'transcript':
        await handleTranscript(payload);
        break;

      case 'function-call':
        return await handleFunctionCall(payload, businessId);

      default:
        console.log(`[VAPI] Unhandled event type: ${eventType}`);
    }

    return NextResponse.json({ success: true, received: eventType });
  } catch (error) {
    console.error('[VAPI Webhook Error]', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: String(error) },
      { status: 500 }
    );
  }
}

async function getDefaultBusinessId(): Promise<string> {
  const { data } = await supabase
    .from('businesses')
    .select('id')
    .limit(1)
    .single();
  return data?.id || '';
}

async function handleCallStart(payload: VAPIWebhookPayload, businessId: string) {
  const call = payload.call;
  if (!call?.id) return;

  // VAPI sends customer at root level or in call object
  const callerPhone = payload.customer?.number || call.customer?.number || 'unknown';
  const callerName = payload.customer?.name || call.customer?.name;

  // Try to find existing client
  let clientId: string | null = null;
  if (callerPhone !== 'unknown') {
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('phone', callerPhone)
      .single();
    clientId = client?.id || null;
  }

  // Create call log entry
  const { error } = await supabase.from('call_logs').insert({
    business_id: businessId,
    client_id: clientId,
    vapi_call_id: call.id,
    caller_phone: callerPhone,
    caller_name: callerName,
    outcome: 'info_only', // Will be updated when call ends
    created_at: call.startedAt || new Date().toISOString(),
  });

  if (error) {
    console.error('[VAPI] Failed to create call log:', error);
  } else {
    console.log(`[VAPI] Call started: ${call.id} from ${callerPhone}`);
  }
}

async function handleCallEnd(payload: VAPIWebhookPayload, businessId: string, businessName?: string, nicheType?: string) {
  // VAPI might send call data at root level or nested in message
  let call = payload.call;

  // Check if call data is in message object (VAPI end-of-call-report format)
  if (!call?.id && payload.message) {
    const msg = payload.message as any;
    if (msg.call) {
      call = msg.call;
      console.log('[VAPI] Found call in message.call');
    }
  }

  console.log('[VAPI] handleCallEnd called, call id:', call?.id);

  if (!call?.id) {
    console.log('[VAPI] No call.id found, payload keys:', Object.keys(payload));
    // Try to extract from message if available
    if (payload.message) {
      console.log('[VAPI] message keys:', Object.keys(payload.message));
    }
    return;
  }

  // Get msg reference for accessing nested data
  const msg = payload.message as any || {};

  // VAPI sends customer at root level, in call object, or in message object
  const callerPhone = payload.customer?.number || call.customer?.number || msg.customer?.number || 'unknown';

  // Calculate duration - check multiple possible locations for timestamps
  let durationSeconds = 0;
  const startedAt = call.startedAt || (msg.call as any)?.startedAt || msg.startedAt;
  const endedAt = call.endedAt || (msg.call as any)?.endedAt || msg.endedAt;

  if (startedAt && endedAt) {
    durationSeconds = Math.round(
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
    );
  }
  console.log(`[VAPI] Duration calc: startedAt=${startedAt}, endedAt=${endedAt}, duration=${durationSeconds}s`);

  // Check if call log exists, create if not (end-of-call-report might be the only event)
  const { data: existingLog } = await supabase
    .from('call_logs')
    .select('id')
    .eq('vapi_call_id', call.id)
    .single();

  if (!existingLog) {
    console.log(`[VAPI] No existing call log for ${call.id}, creating one`);
    const { error: insertError } = await supabase.from('call_logs').insert({
      business_id: businessId,
      vapi_call_id: call.id,
      caller_phone: callerPhone,
      outcome: 'info_only', // Default until we determine actual outcome
      created_at: call.startedAt || call.createdAt || new Date().toISOString(),
    });
    if (insertError) {
      console.error('[VAPI] Insert call log error:', insertError);
    }
  }

  // Get data from either root level or message object (msg already defined above)
  const summary = payload.analysis?.summary || payload.summary || msg.summary || '';
  const messages = payload.messages || msg.messages || [];
  const recordingUrl = payload.recordingUrl || payload.stereoRecordingUrl || msg.recordingUrl || msg.stereoRecordingUrl;
  const endedReason = payload.endedReason || msg.endedReason;

  const outcome = determineOutcome(summary, durationSeconds, endedReason);

  // Format transcript for display - VAPI uses 'message' not 'content'
  const formattedTranscript = messages.length > 0 ? messages.map((m: any) => ({
    role: m.role === 'assistant' || m.role === 'bot' ? 'ai' : 'caller',
    message: m.message || m.content || '',
    timestamp: m.time ? new Date(m.time).toISOString() : null,
  })) : (payload.transcript ? [{ role: 'transcript', message: payload.transcript }] : null);

  logToFile(`[VAPI] handleCallEnd for ${call.id} | Outcome: ${outcome}`);

  // Update call log
  const { error } = await supabase
    .from('call_logs')
    .update({
      duration_seconds: durationSeconds,
      outcome,
      summary,
      transcript: formattedTranscript,
      recording_url: recordingUrl,
      caller_phone: callerPhone,
      updated_at: new Date().toISOString(),
    })
    .eq('vapi_call_id', call.id);

  if (error) {
    logToFile(`[VAPI] Failed to update call log: ${JSON.stringify(error)}`);
  } else {
    logToFile(`[VAPI] Call log updated successfully: ${call.id}`);
  }

  // If appointment was booked but no appointment exists yet, create one
  if (outcome === 'booked') {
    // Check if appointment already created via function call
    const { data: callLog, error: logFetchError } = await supabase
      .from('call_logs')
      .select('appointment_id, client_id')
      .eq('vapi_call_id', call.id)
      .single();

    if (logFetchError) logToFile(`[VAPI] Call log fetch error: ${JSON.stringify(logFetchError)}`);

    if (!callLog?.appointment_id) {
      logToFile('[VAPI] Creating appointment for booked call (no function-call received)');
      await createAppointmentFromCall(call.id, callerPhone, businessId, summary);
    }

    // Create follow-up
    await createBookingFollowUp(call.id, businessId, businessName, nicheType);
  }
}

async function handleTranscript(payload: VAPIWebhookPayload) {
  // Real-time transcript updates - update the call log with latest transcript
  if (!payload.call?.id || !payload.transcript) return;

  await supabase
    .from('call_logs')
    .update({
      transcript: [{ role: 'live', message: payload.transcript, timestamp: new Date().toISOString() }],
    })
    .eq('vapi_call_id', payload.call.id);
}

async function handleFunctionCall(payload: VAPIWebhookPayload, businessId: string): Promise<NextResponse> {
  const fn = payload.functionCall;
  if (!fn) {
    return NextResponse.json({ error: 'No function call data' }, { status: 400 });
  }

  console.log(`[VAPI] Function call: ${fn.name}`, fn.parameters);

  switch (fn.name) {
    case 'checkAvailability':
    case 'check_availability':
      return await handleCheckAvailability(fn.parameters, businessId);

    case 'bookAppointment':
    case 'book_appointment':
      return await handleBookAppointment(fn.parameters, businessId, payload.call?.id);

    case 'getServices':
    case 'get_services':
      return await handleGetServices(businessId);

    default:
      return NextResponse.json({ error: `Unknown function: ${fn.name}` }, { status: 400 });
  }
}

// Function Handlers
async function handleCheckAvailability(params: any, businessId: string): Promise<NextResponse> {
  const { date, treatment_type } = params;

  // Get business hours
  const { data: business } = await supabase
    .from('businesses')
    .select('business_hours')
    .eq('id', businessId)
    .single();

  // Get existing appointments for the date
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

  const { data: appointments } = await supabase
    .from('appointments')
    .select('start_time, end_time')
    .eq('business_id', businessId)
    .gte('start_time', startOfDay.toISOString())
    .lte('start_time', endOfDay.toISOString())
    .neq('status', 'cancelled');

  // Generate available slots (simplified - 60 min slots from 9am-5pm)
  const slots = [];
  const bookedTimes = appointments?.map(a => new Date(a.start_time).getHours()) || [];

  for (let hour = 9; hour < 17; hour++) {
    if (!bookedTimes.includes(hour)) {
      const slotTime = new Date(startOfDay);
      slotTime.setHours(hour, 0, 0, 0);
      slots.push({
        time: `${hour}:00 ${hour < 12 ? 'AM' : 'PM'}`,
        datetime: slotTime.toISOString(),
      });
    }
  }

  return NextResponse.json({
    results: [{
      toolCallId: 'checkAvailability',
      result: {
        available: slots.length > 0,
        date: targetDate.toDateString(),
        slots: slots.slice(0, 5), // Return top 5 slots
        message: slots.length > 0
          ? `I have ${slots.length} slots available. The next available times are ${slots.slice(0, 3).map(s => s.time).join(', ')}.`
          : 'Sorry, no availability on that date. Would you like to try another day?'
      }
    }]
  });
}

async function handleBookAppointment(params: any, businessId: string, callId?: string): Promise<NextResponse> {
  const {
    customer_name,
    customer_phone,
    treatment_type,
    datetime,
    date,
    time
  } = params;

  // Parse datetime
  let appointmentTime: Date;
  if (datetime) {
    appointmentTime = new Date(datetime);
  } else if (date && time) {
    appointmentTime = new Date(`${date} ${time}`);
  } else {
    return NextResponse.json({
      results: [{
        toolCallId: 'bookAppointment',
        result: { success: false, message: 'Please provide a date and time for the appointment.' }
      }]
    });
  }

  // Find or create client
  let clientId: string;
  const { data: existingClient } = await supabase
    .from('clients')
    .select('id')
    .eq('phone', customer_phone)
    .single();

  if (existingClient) {
    clientId = existingClient.id;
  } else {
    const nameParts = (customer_name || 'New Client').split(' ');
    const { data: newClient, error } = await supabase
      .from('clients')
      .insert({
        business_id: businessId,
        first_name: nameParts[0] || 'New',
        last_name: nameParts.slice(1).join(' ') || 'Client',
        phone: customer_phone,
        status: 'active',
      })
      .select('id')
      .single();

    if (error || !newClient) {
      return NextResponse.json({
        results: [{
          toolCallId: 'bookAppointment',
          result: { success: false, message: 'Unable to create client record. Please try again.' }
        }]
      });
    }
    clientId = newClient.id;
  }

  // Create appointment
  const { data: appointment, error: aptError } = await supabase
    .from('appointments')
    .insert({
      business_id: businessId,
      client_id: clientId,
      treatment_type: treatment_type || 'Consultation',
      start_time: appointmentTime.toISOString(),
      end_time: new Date(appointmentTime.getTime() + 60 * 60 * 1000).toISOString(),
      status: 'confirmed',
      source: 'ai_phone',
    })
    .select('id')
    .single();

  if (aptError) {
    console.error('[VAPI] Booking error:', aptError);
    return NextResponse.json({
      results: [{
        toolCallId: 'bookAppointment',
        result: { success: false, message: 'Unable to book appointment. The slot may no longer be available.' }
      }]
    });
  }

  // Link appointment to call log
  if (callId) {
    await supabase
      .from('call_logs')
      .update({ appointment_id: appointment.id, outcome: 'booked' })
      .eq('vapi_call_id', callId);
  }

  const formattedTime = appointmentTime.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return NextResponse.json({
    results: [{
      toolCallId: 'bookAppointment',
      result: {
        success: true,
        appointment_id: appointment.id,
        message: `Your ${treatment_type || 'appointment'} has been booked for ${formattedTime}. You'll receive a confirmation text shortly.`
      }
    }]
  });
}

async function handleGetServices(businessId: string): Promise<NextResponse> {
  const { data: treatments } = await supabase
    .from('treatment_templates')
    .select('name, default_duration_minutes, default_price')
    .eq('business_id', businessId)
    .eq('is_active', true);

  const services = treatments?.map(t => ({
    name: t.name,
    duration: `${t.default_duration_minutes || 60} minutes`,
    price: t.default_price ? `$${t.default_price}` : 'Call for pricing',
  })) || [
      { name: 'Botox', duration: '30 minutes', price: '$350+' },
      { name: 'Filler', duration: '45 minutes', price: '$600+' },
      { name: 'Facial', duration: '60 minutes', price: '$150' },
      { name: 'Consultation', duration: '30 minutes', price: 'Free' },
    ];

  return NextResponse.json({
    results: [{
      toolCallId: 'getServices',
      result: {
        services,
        message: `We offer ${services.map(s => s.name).join(', ')}. Which service are you interested in?`
      }
    }]
  });
}

// Helper Functions
function determineOutcome(summary: string, duration: number, endReason?: string): string {
  const lowerSummary = summary.toLowerCase();

  if (duration < 10) return 'dropped';
  if (endReason === 'voicemail') return 'voicemail';

  if (lowerSummary.includes('book') || lowerSummary.includes('appointment') ||
    lowerSummary.includes('schedule') || lowerSummary.includes('confirmed')) {
    return 'booked';
  }

  if (lowerSummary.includes('callback') || lowerSummary.includes('call back') ||
    lowerSummary.includes('call me back') || lowerSummary.includes('later')) {
    return 'callback_requested';
  }

  return 'info_only';
}

async function createAppointmentFromCall(callId: string, callerPhone: string, businessId: string, summary: string) {
  logToFile(`[VAPI] createAppointmentFromCall for ${callId} | Phone: ${callerPhone}`);
  // Find or create client
  let clientId: string;
  const { data: existingClient, error: clientFetchError } = await supabase
    .from('clients')
    .select('id, first_name')
    .eq('phone', callerPhone)
    .single();

  if (clientFetchError && clientFetchError.code !== 'PGRST116') {
     logToFile(`[VAPI] Client lookup error: ${JSON.stringify(clientFetchError)}`);
  }

  if (existingClient) {
    clientId = existingClient.id;
    logToFile(`[VAPI] Found existing client: ${existingClient.first_name}`);
  } else {
    // Create new client from caller phone
    logToFile(`[VAPI] Creating new client for phone: ${callerPhone}`);
    const { data: newClient, error } = await supabase
      .from('clients')
      .insert({
        business_id: businessId,
        first_name: 'AI',
        last_name: 'Caller',
        phone: callerPhone,
        status: 'active',
      })
      .select('id')
      .single();

    if (error || !newClient) {
      logToFile(`[VAPI] Failed to create client: ${JSON.stringify(error)}`);
      return;
    }
    clientId = newClient.id;
    logToFile(`[VAPI] Created new client: ${clientId}`);
  }

  // Parse treatment type from summary if possible
  let treatmentType = 'Consultation';
  const treatmentKeywords = ['botox', 'filler', 'facial', 'laser', 'consultation', 'injection'];
  const summaryLower = summary.toLowerCase();
  for (const treatment of treatmentKeywords) {
    if (summaryLower.includes(treatment)) {
      treatmentType = treatment.charAt(0).toUpperCase() + treatment.slice(1);
      break;
    }
  }

  // Schedule for tomorrow at 10am as default
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  // Create appointment
  const { data: appointment, error: aptError } = await supabase
    .from('appointments')
    .insert({
      business_id: businessId,
      client_id: clientId,
      treatment_type: treatmentType,
      start_time: tomorrow.toISOString(),
      end_time: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
      status: 'confirmed',
      source: 'ai_phone',
    })
    .select('id')
    .single();

  if (aptError) {
    console.error('[VAPI] Failed to create appointment:', aptError);
    return;
  }

  console.log(`[VAPI] Created appointment ${appointment.id} for client ${clientId}`);

  // Link appointment to call log
  await supabase
    .from('call_logs')
    .update({ appointment_id: appointment.id, client_id: clientId })
    .eq('vapi_call_id', callId);
}

async function createBookingFollowUp(callId: string, businessId: string, businessName?: string, nicheType?: string) {
  logToFile(`[VAPI] createBookingFollowUp for call ${callId} | Niche: ${nicheType}`);
  // Get the call details
  const { data: call, error: callError } = await supabase
    .from('call_logs')
    .select('client_id, appointment_id')
    .eq('vapi_call_id', callId)
    .single();

  if (callError) logToFile(`[VAPI] Follow-up call lookup error: ${JSON.stringify(callError)}`);

  if (!call?.client_id || !call?.appointment_id) {
    logToFile('[VAPI] Follow-up skipped: Missing client_id or appointment_id');
    return;
  }

  const nicheConfig = getNicheConfig(nicheType);
  const messageContent = nicheConfig.smsFollowUp.bookingConfirmation.replace('[Business Name]', businessName || 'our office');

  // Create confirmation follow-up (scheduled to send in 5 minutes)
  const { error: followUpError } = await supabase.from('follow_ups').insert({
    business_id: businessId,
    client_id: call.client_id,
    appointment_id: call.appointment_id,
    type: 'custom', // Use 'custom' for booking confirmations
    status: 'scheduled',
    scheduled_for: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes from now
    message_content: messageContent,
    channel: 'sms',
  });

  if (followUpError) {
    logToFile(`[VAPI] Failed to create follow-up: ${JSON.stringify(followUpError)}`);
  } else {
    logToFile('[VAPI] Created booking confirmation follow-up');
  }
}

// GET endpoint to check webhook status
export async function GET() {
  const { count } = await supabase
    .from('call_logs')
    .select('*', { count: 'exact', head: true });

  return NextResponse.json({
    status: 'ready',
    total_calls: count || 0,
    vapi_configured: !!(process.env.VAPI_API_KEY && process.env.VAPI_ASSISTANT_ID),
    webhook_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/api/vapi/webhook`,
  });
}
