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

async function sendTwilioSMS(to: string, body: string) {
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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio error: ${err}`);
  }
  return res.json();
}

const SMS_TEMPLATES = {
  confirmation: (name: string, time: string, service: string) =>
    `Hi ${name}! This is a reminder about your ${service} appointment at ${time} today. Reply CONFIRM to confirm or CANCEL to reschedule. — Your Care Team`,

  noshow_recovery: (name: string, service: string) =>
    `Hi ${name}, we noticed you missed your ${service} appointment. We'd love to reschedule — reply here or call us to find a new time that works!`,

  followup: (name: string, service: string) =>
    `Hi ${name}! Following up after your ${service} — how are you feeling? Reply with any questions or to book your next visit. 😊`,

  reminder_1hr: (name: string, service: string) =>
    `Hi ${name}! Your ${service} is in 1 hour. We're excited to see you! If anything comes up, just reply here.`,
};

export async function POST(req: NextRequest) {
  try {
    const { appointmentId, phone, clientName, service, time, type } = await req.json();

    if (!phone || !clientName) {
      return NextResponse.json({ error: 'phone and clientName required' }, { status: 400 });
    }

    const msgType = type as keyof typeof SMS_TEMPLATES || 'confirmation';
    const template = SMS_TEMPLATES[msgType];

    let message: string;
    if (msgType === 'confirmation') {
      message = template(clientName, time || '', service || 'appointment');
    } else if (msgType === 'noshow_recovery') {
      message = (SMS_TEMPLATES.noshow_recovery as (n: string, s: string) => string)(clientName, service || 'appointment');
    } else if (msgType === 'followup') {
      message = (SMS_TEMPLATES.followup as (n: string, s: string) => string)(clientName, service || 'your recent visit');
    } else if (msgType === 'reminder_1hr') {
      message = (SMS_TEMPLATES.reminder_1hr as (n: string, s: string) => string)(clientName, service || 'appointment');
    } else {
      message = template(clientName, time || '', service || 'appointment');
    }

    const result = await sendTwilioSMS(phone, message);

    // Log to daily_schedules if appointmentId provided
    if (appointmentId) {
      await supabase.from('daily_schedules').upsert({
        business_id: BUSINESS_ID,
        schedule_date: new Date().toISOString().split('T')[0],
        appointment_id: appointmentId,
        sms_sent_at: new Date().toISOString(),
        sms_status: 'sent',
      }, { onConflict: 'business_id,schedule_date,appointment_id' });

      // Also confirm the appointment in appointments table
      if (msgType === 'confirmation') {
        await supabase.from('appointments')
          .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
          .eq('id', appointmentId)
          .eq('business_id', BUSINESS_ID);
      }
    }

    return NextResponse.json({ success: true, sid: result.sid, message });
  } catch (err) {
    console.error('[dispatch/send-sms] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
