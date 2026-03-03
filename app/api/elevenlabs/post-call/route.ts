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

async function sbPost(table: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify(body),
  });
  return res.ok ? await res.json() : null;
}

function mapOutcome(analysis: Record<string, unknown>): string {
  const criteria = (analysis?.evaluation_criteria_results as Record<string, { result: string }>) || {};
  if (criteria.booking_success?.result === 'success') return 'booked';
  if (criteria.lead_captured?.result === 'success') return 'callback_requested';
  return 'info_only';
}

function extractCallerPhone(metadata: Record<string, unknown>): string | null {
  // ElevenLabs phone call metadata
  const call = metadata?.call as Record<string, string> | undefined;
  if (call?.from) return call.from;
  if (metadata?.caller_id) return metadata.caller_id as string;
  return null;
}

function buildSummary(transcript: Array<{ role: string; message: string }>): string {
  if (!transcript?.length) return '';
  const lines = transcript.slice(0, 6).map(t => `${t.role === 'agent' ? 'Aria' : 'Caller'}: ${t.message}`);
  return lines.join('\n');
}

function parseLeadFromTranscript(transcript: Array<{ role: string; message: string }>) {
  const fullText = transcript.map(t => t.message).join(' ');

  // Simple extraction — look for name/phone patterns Aria would have collected
  const nameMatch = fullText.match(/(?:name is|I'm|I am|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  const phoneMatch = fullText.match(/\b(\+?1?\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})\b/);

  const treatmentKeywords = ['botox', 'filler', 'laser', 'hydrafacial', 'microneedling', 'kybella', 'sculptra', 'peel', 'iv drip', 'coolsculpting', 'emsculpt'];
  const mentionedTreatment = treatmentKeywords.find(t => fullText.toLowerCase().includes(t));

  return {
    name: nameMatch?.[1] || null,
    phone: phoneMatch?.[1] || null,
    interest: mentionedTreatment || null,
  };
}

// POST — receives post-call events from ElevenLabs ConvAI
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType: string = body.type || body.event_type || '';

    // ElevenLabs sends different event shapes — handle both
    if (!eventType.includes('end') && !eventType.includes('ended') && !eventType.includes('conversation')) {
      // Not a call-end event — acknowledge and skip
      return NextResponse.json({ received: true, event: eventType });
    }

    const conversationId: string = body.conversation_id || body.call_id || '';
    const agentId: string = body.agent_id || '';
    const metadata: Record<string, unknown> = body.metadata || {};
    const transcript: Array<{ role: string; message: string }> = body.transcript || [];
    const analysis: Record<string, unknown> = body.analysis || {};
    const durationSecs: number = metadata.call_duration_secs as number || body.duration || 0;

    const callerPhone = extractCallerPhone(metadata);
    const outcome = mapOutcome(analysis);
    const summary = buildSummary(transcript);
    const leadData = parseLeadFromTranscript(transcript);

    const businessId = 'ab445992-80fd-46d0-bec0-138a86e1d607';

    // 1. Write to call_logs with actual table schema
    const mappedTranscript = transcript.map((t, i) => ({
      role: t.role === 'agent' ? 'ai' : 'user',
      message: t.message,
      timestamp: `0:${String(i * 8).padStart(2, '0')}`,
    }));

    const callLogRows = await sbPost('call_logs', {
      business_id: businessId,
      caller_phone: callerPhone,
      caller_name: leadData.name || null,
      vapi_call_id: conversationId,
      requested_treatment: leadData.interest || null,
      duration_seconds: Math.round(durationSecs),
      outcome,
      summary,
      transcript: JSON.stringify(mappedTranscript),
      created_at: new Date().toISOString(),
    });

    const callLogId = Array.isArray(callLogRows) ? callLogRows[0]?.id : null;

    // 2. Write to leads (if we have contact info or it's a meaningful call)
    let leadId: string | null = null;
    if (callerPhone || leadData.name) {
      const [firstName, ...rest] = (leadData.name || '').split(' ');
      const leadRows = await sbPost('leads', {
        business_id: businessId,
        first_name: firstName || 'Unknown',
        last_name: rest.join(' ') || null,
        phone: callerPhone || leadData.phone,
        source: 'elevenlabs_voice',
        source_details: `Call ${conversationId}`,
        status: outcome === 'booked' ? 'qualified' : 'new',
        notes: leadData.interest ? `Interested in: ${leadData.interest}. ${summary}` : summary,
        last_contacted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
      leadId = Array.isArray(leadRows) ? leadRows[0]?.id : null;

      // Link lead back to call log
      if (callLogId && leadId) {
        await fetch(`${SUPABASE_URL}/rest/v1/call_logs?id=eq.${callLogId}`, {
          method: 'PATCH',
          headers: sbHeaders(),
          body: JSON.stringify({ lead_id: leadId }),
        });
      }
    }

    // 3. Trigger SMS follow-up for booked calls
    if (outcome === 'booked' && callerPhone) {
      const smsBody = `Hey! Thanks for calling Glo MedSpa 🌟 Your appointment is confirmed. We'll send a reminder before your visit. Questions? Reply anytime!`;

      await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
        method: 'POST',
        headers: { ...sbHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({
          channel: 'sms',
          direction: 'outbound',
          message_type: 'booking_confirmation',
          to_number: callerPhone,
          content: smsBody,
          status: 'pending',
          lead_id: leadId,
          created_at: new Date().toISOString(),
        }),
      });
    }

    return NextResponse.json({
      received: true,
      call_log_id: callLogId,
      lead_id: leadId,
      outcome,
    });
  } catch (error) {
    console.error('ElevenLabs post-call webhook error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
