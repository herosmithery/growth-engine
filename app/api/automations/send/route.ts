import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function sendSMS(to: string, message: string, from: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    console.log(`[SMS stub] To: ${to} | Message: ${message}`);
    return true;
  }
  try {
    const params = new URLSearchParams({ To: to, From: from, Body: message });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    return res.ok;
  } catch (err) {
    console.error('[SMS error]', err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  const results = {
    sms_sent: 0,
    email_sent: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // Get all scheduled follow-ups that are due
    const { data: pendingFollowUps } = await supabase
      .from('follow_ups')
      .select('*, clients(first_name, last_name, phone, email), businesses(name, phone, vapi_phone_number)')
      .eq('status', 'scheduled')
      .lte('scheduled_for', new Date().toISOString())
      .limit(50); // Process in batches

    if (!pendingFollowUps?.length) {
      return NextResponse.json({ message: 'No pending messages', results });
    }

    for (const followUp of pendingFollowUps) {
      try {
        const client = followUp.clients as any;
        const business = followUp.businesses as any;

        if (followUp.channel === 'sms' && client?.phone) {
          // Send SMS
          const fromNumber = business?.vapi_phone_number || process.env.TWILIO_PHONE_NUMBER || 'system';
          await sendSMS(client.phone, followUp.message_content, fromNumber);
          results.sms_sent++;

          // Create message log
          await supabase.from('messages').insert({
            business_id: followUp.business_id,
            client_id: followUp.client_id,
            channel: 'sms',
            direction: 'outbound',
            message_type: followUp.type,
            content: followUp.message_content,
            to_number: client.phone,
            from_number: fromNumber,
            status: 'sent',
            sent_at: new Date().toISOString(),
          });

        } else if (followUp.channel === 'email' && client?.email) {
          // Send Email (placeholder - integrate with SendGrid, Resend, etc.)
          console.log(`[EMAIL] To: ${client.email} | Message: ${followUp.message_content}`);
          results.email_sent++;

          // Create message log
          await supabase.from('messages').insert({
            business_id: followUp.business_id,
            client_id: followUp.client_id,
            channel: 'email',
            direction: 'outbound',
            message_type: followUp.type,
            content: followUp.message_content,
            to_email: client.email,
            status: 'sent',
            sent_at: new Date().toISOString(),
          });
        }

        // Update follow-up status
        await supabase
          .from('follow_ups')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', followUp.id);

      } catch (err) {
        results.failed++;
        results.errors.push(`Failed to send follow-up ${followUp.id}: ${String(err)}`);

        // Mark as failed
        await supabase
          .from('follow_ups')
          .update({ status: 'failed' })
          .eq('id', followUp.id);
      }
    }

    return NextResponse.json({
      success: true,
      processed_at: new Date().toISOString(),
      results,
    });

  } catch (error) {
    console.error('Message sending error:', error);
    return NextResponse.json(
      { error: 'Failed to send messages', details: String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint to check send queue status
export async function GET() {
  const { count: pendingCount } = await supabase
    .from('follow_ups')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'scheduled')
    .lte('scheduled_for', new Date().toISOString());

  const { count: sentToday } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

  return NextResponse.json({
    pending_to_send: pendingCount || 0,
    sent_today: sentToday || 0,
    twilio_configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    timestamp: new Date().toISOString(),
  });
}
