import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'jak@scalewithjak.com';
const CALENDAR_LINK = 'https://calendly.com/scalewithjak';
const WEBSITE_URL = 'https://scalewithjak.com';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

function sbHeaders() {
  return {
    apikey: svcKey,
    Authorization: `Bearer ${svcKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

async function classifyIntent(replyText: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      system: 'You classify email replies. Return JSON only with one key: intent.',
      messages: [{
        role: 'user',
        content: `Classify this reply from a business owner who got a cold email about a website redesign.
Reply: "${replyText}"
Return JSON: { "intent": "interested" | "objection" | "not_interested" | "question" }
"interested" = wants to see design or chat. "objection" = concern but not no. "question" = needs info. "not_interested" = clear no.`,
      }],
    }),
  });
  const data = await res.json();
  try {
    const text = data.content[0].text.replace(/```json?/g, '').replace(/```/g, '').trim();
    return JSON.parse(text).intent || 'question';
  } catch {
    return 'question';
  }
}

async function getProspectByEmail(email: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/agency_prospects?email=eq.${encodeURIComponent(email)}&limit=1`,
    { headers: sbHeaders() }
  );
  const rows = await res.json();
  return rows[0] || null;
}

async function sendFullDemo(prospect: Record<string, string>) {
  const name = prospect.name;
  const firstName = prospect.owner_first_name || 'there';
  const fullUrl = prospect.preview_full_url || '';

  const pricingTable = `
<table style="width:100%;border-collapse:collapse;font-family:-apple-system,sans-serif;margin:24px 0">
  <thead><tr style="background:#0f172a;color:white">
    <th style="padding:12px 16px;text-align:left">Package</th>
    <th style="padding:12px 16px;text-align:left">What's Included</th>
    <th style="padding:12px 16px;text-align:right">Investment</th>
  </tr></thead>
  <tbody>
    <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
      <td style="padding:12px 16px;font-weight:700;color:#7c3aed">🚀 Tier 1<br/><small style="font-weight:400;color:#475569">Growth Engine</small></td>
      <td style="padding:12px 16px;font-size:14px">✅ AI-powered Silicon Valley-style website<br/>✅ 24/7 AI receptionist<br/>✅ Automated SMS/email follow-ups<br/>✅ Re-activation campaigns<br/>✅ Review request automation<br/>✅ Analytics dashboard</td>
      <td style="padding:12px 16px;text-align:right;font-weight:700;font-size:18px;color:#059669">$1,500</td>
    </tr>
    <tr style="background:#faf5ff;border-bottom:1px solid #e2e8f0">
      <td style="padding:12px 16px;font-weight:700;color:#7c3aed">⚡ Tier 2<br/><small style="font-weight:400;color:#475569">Fulltime AI Employees</small></td>
      <td style="padding:12px 16px;font-size:14px">✅ Everything in Tier 1<br/>✅ Free AI Audit Call<br/>✅ AEO/SEO Optimization<br/>✅ Custom Automation System<br/>✅ AI Content Team (researchers, writers, creators, editors, clippers)</td>
      <td style="padding:12px 16px;text-align:right;font-weight:700;font-size:18px;color:#059669">$3,500</td>
    </tr>
    <tr style="background:#eff6ff">
      <td style="padding:12px 16px;font-weight:700;color:#7c3aed">👑 Tier 3<br/><small style="font-weight:400;color:#475569">Complete AI Transformation</small></td>
      <td style="padding:12px 16px;font-size:14px">✅ Everything in Tier 1 & 2<br/>✅ All-in-1 Jarvis AI Specialist<br/>✅ AI Tool Staff Training<br/>✅ Deep Dive Custom Automations</td>
      <td style="padding:12px 16px;text-align:right;font-weight:700;font-size:18px;color:#059669">$7,500</td>
    </tr>
  </tbody>
</table>`;

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;margin:0 auto;color:#1a1a2e;padding:20px">
  <p style="font-size:16px;line-height:1.6">Hey ${firstName}! 🎉</p>
  <p style="font-size:16px;line-height:1.6">Here's the full redesign for <strong>${name}</strong>:</p>
  ${fullUrl ? `<div style="margin:20px 0;text-align:center"><a href="${fullUrl}" target="_blank"><img src="${fullUrl}" alt="Redesigned website" style="width:100%;border-radius:12px;border:2px solid #e5e7eb;box-shadow:0 8px 24px rgba(0,0,0,.12)"/></a><p style="font-size:13px;color:#6b7280;margin-top:8px">Click to view full size</p></div>` : ''}
  <p style="font-size:16px;line-height:1.6">Here's how we move forward:</p>
  <p style="font-size:15px;line-height:1.8;padding:16px;background:#f8fafc;border-radius:8px;border-left:4px solid #7c3aed">
    1️⃣ Choose a package below<br/>
    2️⃣ 30-min onboarding call to personalize everything<br/>
    3️⃣ Your site goes live within 7 days<br/>
    4️⃣ AI systems start capturing leads 24/7
  </p>
  <h2 style="font-size:20px;color:#0f172a;margin-top:32px">📦 Packages</h2>
  ${pricingTable}
  <p style="font-size:15px;line-height:1.6;color:#374151">
    Want to talk it through first? Book a free 15-min call:<br/>
    👉 <a href="${CALENDAR_LINK}" style="color:#7c3aed;font-weight:600">${CALENDAR_LINK}</a>
  </p>
  <p style="font-size:15px;color:#374151;margin-top:32px">— Jak<br/><span style="color:#6b7280;font-size:13px">Scale With JAK | <a href="${WEBSITE_URL}" style="color:#7c3aed">${WEBSITE_URL}</a></span></p>
</div>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `Jak | Scale With JAK <${FROM_EMAIL}>`,
      to: [prospect.email],
      subject: `Here's the full ${name} redesign + packages`,
      html,
      text: `Hey ${firstName}! Here's the full ${name} redesign. Packages start at $1,500. Book a call: ${CALENDAR_LINK}`,
    }),
  });

  await fetch(`${SUPABASE_URL}/rest/v1/agency_prospects?id=eq.${prospect.id}`, {
    method: 'PATCH',
    headers: sbHeaders(),
    body: JSON.stringify({ status: 'demo_sent' }),
  });
}

// POST — called by Resend email reply webhook
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Resend webhook payload has: type, data.from, data.to, data.subject, data.text
  const eventType = body.type;
  const replyFrom = body.data?.from || body.from;
  const replyText = body.data?.text || body.text || body.data?.subject || '';

  if (!replyFrom) {
    return NextResponse.json({ error: 'No sender in webhook' }, { status: 400 });
  }

  // Extract email from "Name <email>" format
  const emailMatch = replyFrom.match(/<(.+)>/) || [null, replyFrom];
  const senderEmail = emailMatch[1];

  const prospect = await getProspectByEmail(senderEmail);
  if (!prospect) {
    // Not one of our prospects — ignore
    return NextResponse.json({ ok: true, note: 'unknown sender' });
  }

  const intent = await classifyIntent(replyText);

  // Record the reply
  const outreach = await fetch(
    `${SUPABASE_URL}/rest/v1/agency_outreach?prospect_id=eq.${prospect.id}&order=sequence_step.desc&limit=1`,
    { headers: sbHeaders() }
  );
  const outreachRows = await outreach.json();
  if (outreachRows[0]) {
    await fetch(`${SUPABASE_URL}/rest/v1/agency_outreach?id=eq.${outreachRows[0].id}`, {
      method: 'PATCH',
      headers: sbHeaders(),
      body: JSON.stringify({
        replied_at: new Date().toISOString(),
        reply_text: replyText.slice(0, 2000),
        reply_intent: intent,
      }),
    });
  }

  await fetch(`${SUPABASE_URL}/rest/v1/agency_prospects?id=eq.${prospect.id}`, {
    method: 'PATCH',
    headers: sbHeaders(),
    body: JSON.stringify({ status: 'replied' }),
  });

  if (intent === 'interested' || intent === 'question') {
    await sendFullDemo(prospect);
  }

  return NextResponse.json({ ok: true, intent, prospect_id: prospect.id });
}
