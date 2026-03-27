import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER!;

async function sendSMS(to: string, body: string) {
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString('base64');
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }),
    }
  );
  if (!res.ok) throw new Error(`Twilio: ${await res.text()}`);
  return res.json();
}

// POST — process all due follow-ups (called by Vercel cron every hour)
export async function POST(request: NextRequest) {
  // Simple auth check for cron
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();

  // Fetch all pending follow-ups that are due
  const { data: dueFollowUps, error } = await supabase
    .from('follow_ups')
    .select('*, clients(phone, first_name)')
    .eq('status', 'pending')
    .eq('channel', 'sms')
    .lte('scheduled_for', now)
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!dueFollowUps || dueFollowUps.length === 0) {
    return NextResponse.json({ processed: 0, message: 'No due follow-ups' });
  }

  let sent = 0;
  let failed = 0;

  for (const fu of dueFollowUps) {
    const phone = fu.clients?.phone;
    if (!phone || !fu.message_template) {
      await supabase.from('follow_ups').update({ status: 'failed' }).eq('id', fu.id);
      failed++;
      continue;
    }

    try {
      const result = await sendSMS(phone, fu.message_template);

      // Mark sent + log to messages table
      await Promise.all([
        supabase.from('follow_ups').update({
          status: 'sent',
          sent_at: now,
        }).eq('id', fu.id),
        supabase.from('messages').insert({
          business_id: fu.business_id,
          client_id: fu.client_id,
          channel: 'sms',
          direction: 'outbound',
          message_type: fu.type || 'reminder',
          to_number: phone,
          from_number: TWILIO_FROM,
          content: fu.message_template,
          status: 'sent',
          external_id: result.sid,
          sent_at: now,
        }),
      ]);
      sent++;
    } catch (err) {
      console.error(`[followups/process] Failed for ${fu.id}:`, err);
      await supabase.from('follow_ups').update({ status: 'failed' }).eq('id', fu.id);
      failed++;
    }
  }

  return NextResponse.json({ processed: dueFollowUps.length, sent, failed });
}

// GET — preview due follow-ups without sending
export async function GET() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('follow_ups')
    .select('id, type, channel, scheduled_for, message_template, clients(phone, first_name)')
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ due: data || [], count: data?.length || 0 });
}
