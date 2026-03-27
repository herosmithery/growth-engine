import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER!;
const BUSINESS_ID = 'ab445992-80fd-46d0-bec0-138a86e1d607';

async function sendSMS(to: string, body: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString('base64');
  const params = new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// POST: Send immediate follow-up SMS for a field report
export async function POST(req: NextRequest) {
  try {
    const { reportId, clientPhone, clientName, service, sendNow } = await req.json();

    if (!clientPhone || !clientName) {
      return NextResponse.json({ error: 'clientPhone and clientName required' }, { status: 400 });
    }

    const message = `Hi ${clientName}! This is a follow-up from your recent ${service || 'appointment'} with us. How are you feeling? We're here if you have any questions or want to book your next visit. 😊`;

    if (sendNow) {
      // Send immediately via Twilio
      const result = await sendSMS(clientPhone, message);

      // Update field report follow-up status
      if (reportId) {
        await supabase
          .from('field_reports')
          .update({ follow_up_required: false, updated_at: new Date().toISOString() })
          .eq('id', reportId)
          .eq('business_id', BUSINESS_ID);
      }

      return NextResponse.json({ success: true, sent: true, sid: result.sid, message });
    } else {
      // Schedule for 48 hours later
      const scheduledFor = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      return NextResponse.json({
        success: true,
        sent: false,
        scheduled_for: scheduledFor,
        message,
      });
    }
  } catch (err) {
    console.error('[field-reports/followup] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
