import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUSINESS_ID = 'ab445992-80fd-46d0-bec0-138a86e1d607';

// Lightweight AI parser using pattern matching (no external AI call needed for MVP)
function parseVoiceNote(text: string): {
  client: string;
  pet: string;
  service: string;
  provider: string;
  notes: string;
  upsell: string;
  hasUpsell: boolean;
  followUp: boolean;
  estimatedRevenue: number;
} {
  const lower = text.toLowerCase();

  // Extract service type
  const servicePatterns: Record<string, number> = {
    'wellness exam': 185,
    'dental cleaning': 420,
    'vaccination': 95,
    'surgery': 550,
    'follow-up': 65,
    'botox': 350,
    'filler': 450,
    'laser': 300,
    'facial': 150,
    'consultation': 85,
  };

  let detectedService = 'Service';
  let estimatedRevenue = 100;
  for (const [service, price] of Object.entries(servicePatterns)) {
    if (lower.includes(service)) {
      detectedService = service.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      estimatedRevenue = price;
      break;
    }
  }

  // Detect upsells
  const upsellPatterns = [
    { pattern: 'tartar', upsell: 'Dental cleaning recommended within 6 months' },
    { pattern: 'dental', upsell: 'Home dental care kit + follow-up cleaning' },
    { pattern: 'overweight|weight', upsell: 'Weight management consultation + dietary plan' },
    { pattern: 'joint|arthritis', upsell: 'Joint supplement recommendation' },
    { pattern: 'heartworm', upsell: 'ProHeart heartworm prevention subscription' },
    { pattern: 'filler|volume', upsell: 'Touch-up session in 3 months + skincare kit' },
    { pattern: 'botox|wrinkle', upsell: 'Maintenance plan — next session in 3-4 months' },
    { pattern: 'skin|complexion', upsell: 'Medical-grade skincare regimen bundle' },
  ];

  let upsell = '';
  let hasUpsell = false;
  for (const { pattern, upsell: u } of upsellPatterns) {
    if (new RegExp(pattern).test(lower)) {
      upsell = u;
      hasUpsell = true;
      break;
    }
  }

  // Detect follow-up needed
  const followUp =
    lower.includes('follow-up') ||
    lower.includes('follow up') ||
    lower.includes('recheck') ||
    lower.includes('return') ||
    lower.includes('next appointment') ||
    lower.includes('recovery') ||
    lower.includes('extraction') ||
    lower.includes('post-op');

  // Extract client name (first proper noun after "client" or "owner")
  const clientMatch = text.match(/(?:client|owner|patient)\s+([A-Z][a-z]+(?:\s[A-Z]\.?)?)/);
  const client = clientMatch ? clientMatch[1] : '';

  // Extract provider
  const providerMatch = text.match(/(?:Dr\.|Doctor|Provider)\s+([A-Z][a-z]+)/);
  const provider = providerMatch ? `Dr. ${providerMatch[1]}` : '';

  // Extract pet name
  const petMatch = text.match(/([A-Z][a-z]+)\s*\(([^)]+)\)/);
  const pet = petMatch ? `${petMatch[1]} (${petMatch[2]})` : '';

  return {
    client,
    pet,
    service: detectedService,
    provider,
    notes: text.slice(0, 500),
    upsell,
    hasUpsell,
    followUp,
    estimatedRevenue,
  };
}

// Generate Stripe payment link (only if key is configured)
async function createStripePaymentLink(amount: number, description: string): Promise<string | null> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey || stripeKey.startsWith('your-')) return null;

  try {
    // Create price first
    const priceRes = await fetch('https://api.stripe.com/v1/prices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        currency: 'usd',
        unit_amount: String(Math.round(amount * 100)),
        'product_data[name]': description,
      }),
    });

    if (!priceRes.ok) return null;
    const price = await priceRes.json();

    // Create payment link
    const linkRes = await fetch('https://api.stripe.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'line_items[0][price]': price.id,
        'line_items[0][quantity]': '1',
      }),
    });

    if (!linkRes.ok) return null;
    const link = await linkRes.json();
    return link.url;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { voiceNote, appointmentId, clientId } = await req.json();

    if (!voiceNote?.trim()) {
      return NextResponse.json({ error: 'voiceNote is required' }, { status: 400 });
    }

    // Parse the voice note
    const parsed = parseVoiceNote(voiceNote);

    // Generate report ID
    const now = new Date();
    const reportId = `RPT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

    // Generate Stripe payment link
    const stripeUrl = await createStripePaymentLink(
      parsed.estimatedRevenue,
      `${parsed.service} — ${parsed.client || 'Client'}`
    );

    // Schedule follow-up if needed (48hrs after service)
    const followUpDate = parsed.followUp
      ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      : null;

    // Save to Supabase
    const { data: report, error } = await supabase
      .from('field_reports')
      .insert({
        business_id: BUSINESS_ID,
        client_id: clientId || null,
        appointment_id: appointmentId || null,
        provider_name: parsed.provider || null,
        service_name: parsed.service,
        voice_transcript: voiceNote,
        ai_notes: parsed.notes,
        upsell: parsed.upsell || null,
        has_upsell: parsed.hasUpsell,
        follow_up_required: parsed.followUp,
        follow_up_scheduled_for: followUpDate,
        invoice_amount: parsed.estimatedRevenue,
        invoice_status: 'pending',
        stripe_invoice_url: stripeUrl,
        report_id: reportId,
      })
      .select()
      .single();

    if (error) throw error;

    // If follow-up needed + client has phone, schedule a follow_up record
    if (parsed.followUp && clientId) {
      await supabase.from('follow_ups').insert({
        business_id: BUSINESS_ID,
        client_id: clientId,
        appointment_id: appointmentId || null,
        type: 'post_treatment',
        status: 'scheduled',
        channel: 'sms',
        message_template: `Hi, following up after your ${parsed.service} — how are you feeling? Reply with any questions!`,
        scheduled_for: followUpDate,
      });
    }

    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        reportId,
        service: parsed.service,
        notes: parsed.notes,
        upsell: parsed.upsell,
        hasUpsell: parsed.hasUpsell,
        followUp: parsed.followUp,
        invoice: `$${parsed.estimatedRevenue.toFixed(2)}`,
        invoiceUrl: stripeUrl || '#',
      },
    });
  } catch (err) {
    console.error('[field-reports/submit] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
