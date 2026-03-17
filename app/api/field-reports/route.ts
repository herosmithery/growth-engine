import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUSINESS_ID = 'ab445992-80fd-46d0-bec0-138a86e1d607';

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = `${today}T00:00:00.000Z`;
    const endOfDay = `${today}T23:59:59.999Z`;

    const { data, error } = await supabase
      .from('field_reports')
      .select(`
        *,
        clients (first_name, last_name, phone, email)
      `)
      .eq('business_id', BUSINESS_ID)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const shaped = (data || []).map((r) => ({
      id: r.id,
      reportId: r.report_id || `RPT-${r.id.slice(0, 8).toUpperCase()}`,
      client: r.clients
        ? `${(r.clients as Record<string,string>).first_name} ${(r.clients as Record<string,string>).last_name || ''}`.trim()
        : 'Unknown',
      provider: r.provider_name || '',
      service: r.service_name || '',
      notes: r.ai_notes || r.voice_transcript || '',
      upsell: r.upsell || '',
      hasUpsell: r.has_upsell || false,
      followUp: r.follow_up_required || false,
      invoice: r.invoice_amount ? `$${r.invoice_amount.toFixed(2)}` : '$0.00',
      invoicePaid: r.invoice_status === 'paid',
      invoiceUrl: r.stripe_invoice_url || '',
      time: new Date(r.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    }));

    return NextResponse.json({ reports: shaped });
  } catch (err) {
    console.error('[field-reports GET] error:', err);
    return NextResponse.json({ reports: [], error: String(err) });
  }
}
