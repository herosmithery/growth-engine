import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// API Route: Import Leads from Lead Gen Pipeline
// POST /api/leads/import
// Accepts leads from comprehensive_lead_gen.py and other scraping tools

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

interface LeadImport {
  business_id?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  company_name?: string;
  website?: string;
  source?: string;
  source_url?: string;
  notes?: string;
  // Research strategy fields
  lead_tier?: string;
  lead_score?: number;
  decision_maker_title?: string;
  ai_pitch_summary?: string;
  ai_icebreaker?: string;
}

export async function POST(request: Request) {
  try {
    // Check for API key in header
    const apiKey = request.headers.get('x-api-key');
    const authHeader = request.headers.get('authorization');

    // Allow either x-api-key header or Bearer token
    const token = apiKey || authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Missing authentication' },
        { status: 401 }
      );
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await request.json();
    const { leads, business_id, source = 'api_import' } = body;

    if (!leads || !Array.isArray(leads)) {
      return NextResponse.json(
        { error: 'Invalid request: leads array required' },
        { status: 400 }
      );
    }

    // Determine business_id from token if not provided
    let targetBusinessId = business_id;

    if (!targetBusinessId) {
      // Try to get business from authenticated user
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user?.user_metadata?.business_id) {
        targetBusinessId = user.user_metadata.business_id;
      }
    }

    if (!targetBusinessId) {
      return NextResponse.json(
        { error: 'business_id required' },
        { status: 400 }
      );
    }

    // Process and validate leads
    const processedLeads = leads.map((lead: LeadImport) => {
      // Parse full_name into first/last if provided
      let firstName = lead.first_name || '';
      let lastName = lead.last_name || '';

      if (lead.full_name && !firstName) {
        const nameParts = lead.full_name.trim().split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }

      // Determine lead score/tier
      let tier = lead.lead_tier || 'C';
      if (lead.lead_score && !lead.lead_tier) {
        if (lead.lead_score >= 80) tier = 'A';
        else if (lead.lead_score >= 50) tier = 'B';
      }

      return {
        business_id: targetBusinessId,
        first_name: firstName || null,
        last_name: lastName || null,
        email: lead.email || null,
        phone: lead.phone || null,
        company_name: lead.company_name || null,
        website: lead.website || null,
        source: lead.source || source,
        source_url: lead.source_url || null,
        status: 'new',
        notes: formatNotes(lead),
        metadata: {
          lead_tier: tier,
          lead_score: lead.lead_score,
          decision_maker_title: lead.decision_maker_title,
          ai_pitch_summary: lead.ai_pitch_summary,
          ai_icebreaker: lead.ai_icebreaker,
          imported_at: new Date().toISOString(),
        },
      };
    });

    // Check for duplicates by email/phone
    const uniqueLeads: typeof processedLeads = [];
    const duplicates: typeof processedLeads = [];

    for (const lead of processedLeads) {
      let isDuplicate = false;

      if (lead.email) {
        const { data: existing } = await supabase
          .from('leads')
          .select('id')
          .eq('business_id', targetBusinessId)
          .eq('email', lead.email)
          .single();

        if (existing) isDuplicate = true;
      }

      if (!isDuplicate && lead.phone) {
        const { data: existing } = await supabase
          .from('leads')
          .select('id')
          .eq('business_id', targetBusinessId)
          .eq('phone', lead.phone)
          .single();

        if (existing) isDuplicate = true;
      }

      if (isDuplicate) {
        duplicates.push(lead);
      } else {
        uniqueLeads.push(lead);
      }
    }

    // Insert unique leads
    const { data: inserted, error } = await supabase
      .from('leads')
      .insert(uniqueLeads)
      .select('id, first_name, last_name, email, status');

    if (error) {
      console.error('Error inserting leads:', error);
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    // Create follow-up tasks for high-tier leads
    const highTierLeads = inserted?.filter((lead: any, idx: number) => {
      const metadata = uniqueLeads[idx]?.metadata;
      return metadata?.lead_tier === 'A';
    }) || [];

    if (highTierLeads.length > 0) {
      const followUps = highTierLeads.map((lead: any, idx: number) => {
        const metadata = uniqueLeads.find(l => l.email === lead.email)?.metadata;
        return {
          business_id: targetBusinessId,
          lead_id: lead.id,
          type: 'nurture',
          channel: 'email',
          status: 'scheduled',
          scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
          message_template: metadata?.ai_icebreaker || `Hi ${lead.first_name || 'there'}, I came across your business and wanted to reach out...`,
        };
      });

      await supabase.from('follow_ups').insert(followUps);
    }

    return NextResponse.json({
      success: true,
      imported: inserted?.length || 0,
      duplicates_skipped: duplicates.length,
      tier_a_leads: highTierLeads.length,
      leads: inserted,
    });

  } catch (error) {
    console.error('Error in lead import:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Format notes from lead data
function formatNotes(lead: LeadImport): string {
  const notes: string[] = [];

  if (lead.decision_maker_title) {
    notes.push(`Decision Maker: ${lead.decision_maker_title}`);
  }
  if (lead.ai_pitch_summary) {
    notes.push(`AI Pitch: ${lead.ai_pitch_summary}`);
  }
  if (lead.notes) {
    notes.push(lead.notes);
  }

  return notes.join('\n') || '';
}

// GET endpoint to check API status
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/leads/import',
    methods: ['POST'],
    description: 'Import leads from external sources (lead gen pipeline)',
    required_fields: ['leads (array)', 'business_id'],
    optional_fields: [
      'source',
      'lead.first_name',
      'lead.last_name',
      'lead.full_name',
      'lead.email',
      'lead.phone',
      'lead.company_name',
      'lead.website',
      'lead.lead_tier',
      'lead.lead_score',
      'lead.ai_icebreaker',
    ],
  });
}
