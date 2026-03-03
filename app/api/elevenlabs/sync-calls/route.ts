import { NextResponse } from 'next/server';

const EL_BASE = 'https://api.elevenlabs.io/v1';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_KEY = (svcKey && !svcKey.startsWith('your')) ? svcKey : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const AGENT_ID = process.env.ELEVENLABS_AGENT_ID!;
const BUSINESS_ID = 'ab445992-80fd-46d0-bec0-138a86e1d607';

function elHeaders() {
  return { 'xi-api-key': process.env.ELEVENLABS_API_KEY! };
}

function sbHeaders() {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

function mapOutcome(analysis: Record<string, unknown>): string {
  const criteria = (analysis?.evaluation_criteria_results as Record<string, { result: string }>) || {};
  if (criteria.booking_success?.result === 'success') return 'booked';
  if (criteria.lead_captured?.result === 'success') return 'callback_requested';
  if (analysis?.call_successful === 'failure') return 'dropped';
  return 'info_only';
}

// Extract caller name by scanning agent messages for how Aria addresses them
// (more reliable than parsing user messages with unpredictable speech patterns)
function extractCallerName(transcript: Array<{ role: string; message: string }>): string | null {
  for (const t of transcript) {
    if (t.role !== 'agent') continue;
    // "Thank you, Jack!" / "Great, Sarah!" / "Perfect, Marcus!"
    const match = t.message.match(/(?:Thank you|Great|Perfect|Wonderful|Got it|Awesome)[,!]?\s+([A-Z][a-z]+)[!,.]?/);
    if (match) return match[1];
    // "I have you down as Sarah Johnson"
    const downAs = t.message.match(/down as\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (downAs) return downAs[1];
  }
  // Fallback: scan user messages for self-introduction patterns
  for (const t of transcript) {
    if (t.role !== 'user') continue;
    const m = t.message.match(/(?:name is|I'm|I am|this is|it['']s)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (m) return m[1];
  }
  return null;
}

function extractTreatment(transcript: Array<{ role: string; message: string }>): string | null {
  const fullText = transcript.map(t => t.message).join(' ');
  const treatments = ['botox', 'filler', 'laser', 'hydrafacial', 'microneedling', 'kybella', 'sculptra', 'peel', 'iv drip', 'coolsculpting', 'emsculpt', 'consultation', 'lip', 'jawline'];
  return treatments.find(t => fullText.toLowerCase().includes(t)) || null;
}

// Parse appointment time from agent's booking confirmation message
function parseAppointmentTime(transcript: Array<{ role: string; message: string }>, callStartTime: string): string | null {
  const baseDate = new Date(callStartTime);

  for (const t of transcript) {
    if (t.role !== 'agent') continue;
    const msg = t.message.toLowerCase();
    if (!msg.includes("booked") && !msg.includes("scheduled") && !msg.includes("set you up") && !msg.includes("got you")) continue;

    // "tomorrow at ten o'clock" / "tomorrow at 10"
    if (msg.includes('tomorrow')) {
      const timeMatch = msg.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|o'clock|in the morning|in the afternoon)?/);
      const apt = new Date(baseDate);
      apt.setDate(apt.getDate() + 1);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1]);
        const ampm = timeMatch[3] || '';
        if (ampm.includes('pm') || ampm.includes('afternoon')) { if (hour < 12) hour += 12; }
        else if (hour < 8) hour += 12; // "ten" = 10am likely
        apt.setHours(hour, parseInt(timeMatch[2] || '0'), 0, 0);
      } else {
        apt.setHours(10, 0, 0, 0); // default 10am
      }
      return apt.toISOString();
    }

    // "Saturday at 11am" / "Monday at 2pm"
    const dayMatch = msg.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (dayMatch) {
      const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
      const targetDay = days.indexOf(dayMatch[1]);
      const apt = new Date(baseDate);
      const diff = (targetDay - apt.getDay() + 7) % 7 || 7;
      apt.setDate(apt.getDate() + diff);
      let hour = parseInt(dayMatch[2]);
      if (dayMatch[4] === 'pm' && hour < 12) hour += 12;
      apt.setHours(hour, parseInt(dayMatch[3] || '0'), 0, 0);
      return apt.toISOString();
    }
  }
  return null;
}

async function sendSMS(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return;
  try {
    const params = new URLSearchParams({ To: to, From: from, Body: body });
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
  } catch (err) {
    console.error('SMS send error:', err);
  }
}

export async function POST() {
  try {
    // 1. Fetch recent conversations from ElevenLabs
    const listRes = await fetch(
      `${EL_BASE}/convai/conversations?agent_id=${AGENT_ID}&page_size=50`,
      { headers: elHeaders() }
    );
    if (!listRes.ok) throw new Error(`ElevenLabs list error: ${await listRes.text()}`);
    const { conversations } = await listRes.json() as {
      conversations: Array<{
        conversation_id: string;
        start_time_unix_secs: number;
        call_duration_secs: number;
        status: string;
      }>
    };

    if (!conversations?.length) {
      return NextResponse.json({ synced: 0, message: 'No conversations found' });
    }

    // 2. Find which are already in call_logs
    const ids = conversations.map(c => c.conversation_id);
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/call_logs?vapi_call_id=in.(${ids.join(',')})&select=vapi_call_id`,
      { headers: sbHeaders() }
    );
    const existingRows = existingRes.ok ? await existingRes.json() : [];
    const existingIds = new Set((existingRows as { vapi_call_id: string }[]).map(r => r.vapi_call_id));

    const toSync = conversations.filter(c => !existingIds.has(c.conversation_id) && c.status === 'done');
    const results = { synced: 0, failed: 0, ids: [] as string[] };

    for (const conv of toSync) {
      // 3. Fetch full conversation detail
      const detailRes = await fetch(
        `${EL_BASE}/convai/conversations/${conv.conversation_id}`,
        { headers: elHeaders() }
      );
      if (!detailRes.ok) { results.failed++; continue; }

      const detail = await detailRes.json() as {
        user_id?: string;
        transcript?: Array<{ role: string; message: string; time_in_call_secs?: number }>;
        analysis?: Record<string, unknown>;
        metadata?: { call_duration_secs?: number; start_time_unix_secs?: number };
      };

      const rawTranscript = detail.transcript || [];
      const callerPhone = detail.user_id || null;
      const analysis = detail.analysis || {};
      const outcome = mapOutcome(analysis);
      const durationSecs = detail.metadata?.call_duration_secs || conv.call_duration_secs || 0;
      const startTime = detail.metadata?.start_time_unix_secs
        ? new Date(detail.metadata.start_time_unix_secs * 1000).toISOString()
        : new Date().toISOString();

      const callerName = extractCallerName(rawTranscript);
      const treatment = extractTreatment(rawTranscript);

      const mappedTranscript = rawTranscript.map(t => ({
        role: t.role === 'agent' ? 'ai' : 'user',
        message: t.message,
        timestamp: t.time_in_call_secs != null
          ? `${Math.floor(t.time_in_call_secs / 60)}:${String(t.time_in_call_secs % 60).padStart(2, '0')}`
          : '0:00',
      }));

      const summary = rawTranscript.slice(0, 6)
        .map(t => `${t.role === 'agent' ? 'Aria' : 'Caller'}: ${t.message}`)
        .join('\n');

      // 4. Write to call_logs
      const logRes = await fetch(`${SUPABASE_URL}/rest/v1/call_logs`, {
        method: 'POST',
        headers: sbHeaders(),
        body: JSON.stringify({
          business_id: BUSINESS_ID,
          caller_phone: callerPhone,
          caller_name: callerName || null,
          vapi_call_id: conv.conversation_id,
          requested_treatment: treatment || null,
          duration_seconds: Math.round(durationSecs),
          outcome,
          summary,
          transcript: JSON.stringify(mappedTranscript),
          created_at: startTime,
        }),
      });

      if (!logRes.ok) { results.failed++; continue; }
      const logRows = await logRes.json();
      const callLogId = Array.isArray(logRows) ? logRows[0]?.id : null;
      if (callLogId) results.ids.push(callLogId);

      // 5. Write lead
      let leadId: string | null = null;
      if (callerPhone || callerName) {
        const [firstName, ...rest] = (callerName || '').split(' ');
        const leadRes = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
          method: 'POST',
          headers: sbHeaders(),
          body: JSON.stringify({
            business_id: BUSINESS_ID,
            first_name: firstName || 'Unknown',
            last_name: rest.join(' ') || null,
            phone: callerPhone,
            source: 'elevenlabs_voice',
            source_details: `Call ${conv.conversation_id}`,
            status: outcome === 'booked' ? 'qualified' : 'new',
            notes: treatment ? `Interested in: ${treatment}` : null,
            last_contacted_at: startTime,
            created_at: startTime,
          }),
        });
        if (leadRes.ok) {
          const leadRows = await leadRes.json();
          leadId = Array.isArray(leadRows) ? leadRows[0]?.id : null;
        }

        // Link lead to call log
        if (callLogId && leadId) {
          await fetch(`${SUPABASE_URL}/rest/v1/call_logs?id=eq.${callLogId}`, {
            method: 'PATCH',
            headers: sbHeaders(),
            body: JSON.stringify({ lead_id: leadId }),
          });
        }
      }

      // 6. For booked calls — create appointment + send SMS confirmation
      if (outcome === 'booked' && callerPhone) {
        const aptTime = parseAppointmentTime(rawTranscript, startTime);

        // Create appointment record — store caller info in notes for calendar display
        const aptNotes = [
          callerName ? `Caller: ${callerName}` : null,
          callerPhone ? `Phone: ${callerPhone}` : null,
          treatment ? `Treatment: ${treatment}` : null,
          `Booked via Aria AI voice agent`,
        ].filter(Boolean).join('\n');

        await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
          method: 'POST',
          headers: { ...sbHeaders(), Prefer: 'return=minimal' },
          body: JSON.stringify({
            business_id: BUSINESS_ID,
            treatment_type: treatment || 'Consultation',
            start_time: aptTime || new Date(Date.now() + 86400000).toISOString(),
            status: 'confirmed',
            source: 'ai_phone',
            notes: aptNotes,
            created_at: startTime,
          }),
        });

        // Send SMS booking confirmation via Twilio
        const smsBody = `Hi${callerName ? ` ${callerName}` : ''}! Your ${treatment || 'consultation'} at Glo MedSpa is confirmed${aptTime ? ` for ${new Date(aptTime).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at ${new Date(aptTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}. Questions? Reply anytime!`;
        await sendSMS(callerPhone, smsBody);
      }

      results.synced++;
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${results.synced} new call${results.synced !== 1 ? 's' : ''}${results.failed ? ` (${results.failed} failed)` : ''}`,
      synced: results.synced,
      skipped: existingIds.size,
      call_log_ids: results.ids,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
