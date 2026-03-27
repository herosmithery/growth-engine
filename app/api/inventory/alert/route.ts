import { NextRequest, NextResponse } from 'next/server';

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER!;

// Owner/clinic phone — defaults to Twilio number if not set separately
const OWNER_PHONE = process.env.OWNER_PHONE || process.env.TWILIO_PHONE_NUMBER!;

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

export async function POST(req: NextRequest) {
  try {
    const { items, ownerPhone } = await req.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    const targetPhone = ownerPhone || OWNER_PHONE;
    if (!targetPhone) {
      return NextResponse.json({ error: 'No owner phone configured' }, { status: 400 });
    }

    // Build alert message
    const criticalItems = items.filter((i: { severity: string }) => i.severity === 'critical');
    const warningItems = items.filter((i: { severity: string }) => i.severity === 'warning');

    let msg = `⚠️ INVENTORY ALERT\n`;

    if (criticalItems.length > 0) {
      msg += `\n🔴 CRITICAL (order now):\n`;
      criticalItems.forEach((item: { name: string; qty: number; unit: string }) => {
        msg += `• ${item.name}: ${item.qty} ${item.unit} left\n`;
      });
    }

    if (warningItems.length > 0) {
      msg += `\n🟡 LOW STOCK:\n`;
      warningItems.forEach((item: { name: string; qty: number; unit: string }) => {
        msg += `• ${item.name}: ${item.qty} ${item.unit} left\n`;
      });
    }

    msg += `\nReview inventory in your dashboard to reorder.`;

    const result = await sendSMS(targetPhone, msg);
    return NextResponse.json({ success: true, sid: result.sid, message: msg });
  } catch (err) {
    console.error('[inventory/alert] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
