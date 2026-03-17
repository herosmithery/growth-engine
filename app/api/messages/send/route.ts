import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER!;
const RESEND_KEY = process.env.RESEND_API_KEY!;
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const BUSINESS_ID = 'ab445992-80fd-46d0-bec0-138a86e1d607';

async function sendTwilioSMS(to: string, body: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString('base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }),
  });
  if (!res.ok) throw new Error(`Twilio: ${await res.text()}`);
  return res.json();
}

async function sendResendEmail(to: string, subject: string, body: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [to],
      subject,
      text: body,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px"><p style="font-size:16px;line-height:1.6;color:#333">${body.replace(/\n/g, '<br>')}</p></div>`,
    }),
  });
  if (!res.ok) throw new Error(`Resend: ${await res.text()}`);
  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const {
      channel,      // 'sms' | 'email'
      to,           // phone number or email address
      content,      // message body
      subject,      // email subject (optional)
      clientId,     // UUID (optional)
      messageType,  // 'confirmation' | 'followup' | 'review_request' | 'reactivation' | 'nurture'
      businessId: bId,
    } = await req.json();

    const bizId = bId || BUSINESS_ID;

    if (!channel || !to || !content) {
      return NextResponse.json({ error: 'channel, to, and content are required' }, { status: 400 });
    }

    let externalId: string | null = null;

    if (channel === 'sms') {
      const result = await sendTwilioSMS(to, content);
      externalId = result.sid;
    } else if (channel === 'email') {
      const result = await sendResendEmail(to, subject || 'Message from your care team', content);
      externalId = result.id;
    } else {
      return NextResponse.json({ error: 'channel must be sms or email' }, { status: 400 });
    }

    // Log to messages table
    const { data: message, error } = await supabase.from('messages').insert({
      business_id: bizId,
      client_id: clientId || null,
      channel,
      direction: 'outbound',
      message_type: messageType || 'nurture',
      ...(channel === 'sms' ? { from_number: TWILIO_FROM, to_number: to } : { from_email: RESEND_FROM, to_email: to }),
      subject: subject || null,
      content,
      status: 'sent',
      external_id: externalId,
      sent_at: new Date().toISOString(),
    }).select().single();

    if (error) console.error('[messages/send] DB log error:', error);

    return NextResponse.json({ success: true, messageId: message?.id, externalId });
  } catch (err) {
    console.error('[messages/send] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET: fetch conversation thread for a client
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId');
  const businessId = searchParams.get('businessId') || BUSINESS_ID;
  const limit = parseInt(searchParams.get('limit') || '100');

  try {
    let query = supabase
      .from('messages')
      .select(`*, clients(first_name, last_name, phone, email)`)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (clientId) query = query.eq('client_id', clientId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ messages: data || [] });
  } catch (err) {
    return NextResponse.json({ messages: [], error: String(err) });
  }
}
