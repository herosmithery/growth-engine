import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role for full access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

import { getNicheConfig } from '@/lib/niches';

interface AutomationResult {
  type: string;
  processed: number;
  created: number;
  errors: string[];
}

export async function POST(request: NextRequest) {
  // Verify API key for security (optional - add to .env)
  const authHeader = request.headers.get('authorization');
  const apiKey = process.env.AUTOMATION_API_KEY;
  if (apiKey && authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: AutomationResult[] = [];

  try {
    // Get all active businesses
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id, name, niche_type')
      .in('subscription_status', ['trial', 'active']);

    if (!businesses?.length) {
      return NextResponse.json({ message: 'No active businesses', results: [] });
    }

    for (const business of businesses) {
      // 1. Process post-treatment follow-ups (24 hours after appointment)
      const followUpResult = await processPostTreatmentFollowUps(business);
      results.push({ type: 'post_treatment_followup', ...followUpResult });

      // 2. Process review requests (48 hours after completed appointment)
      const reviewResult = await processReviewRequests(business);
      results.push({ type: 'review_request', ...reviewResult });

      // 3. Process reactivation campaigns (clients inactive 60+ days)
      const reactivationResult = await processReactivations(business);
      results.push({ type: 'reactivation', ...reactivationResult });

      // 4. Process lead nurture sequences
      const nurtureResult = await processLeadNurture(business);
      results.push({ type: 'lead_nurture', ...nurtureResult });
    }

    return NextResponse.json({
      success: true,
      processed_at: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error('Automation processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process automations', details: String(error) },
      { status: 500 }
    );
  }
}

// Process post-treatment follow-ups (check-in 24 hours after appointment)
async function processPostTreatmentFollowUps(business: any): Promise<{ processed: number; created: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;
  let created = 0;

  // Find completed appointments from 24 hours ago that haven't had follow-up
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, clients(id, first_name, last_name, phone, email)')
    .eq('business_id', business.id)
    .eq('status', 'completed')
    .eq('follow_up_status', 'pending')
    .gte('start_time', fortyEightHoursAgo.toISOString())
    .lte('start_time', twentyFourHoursAgo.toISOString());

  if (!appointments?.length) return { processed: 0, created: 0, errors: [] };

  for (const apt of appointments) {
    processed++;
    try {
      const client = apt.clients as any;
      if (!client?.phone && !client?.email) {
        errors.push(`No contact info for client ${client?.first_name || apt.client_id}`);
        continue;
      }

      const nicheConfig = getNicheConfig(business.niche_type);
      const messageContent = nicheConfig.smsFollowUp.postTreatment
        .replace('[Name]', client.first_name)
        .replace('[Business Name]', business.name || 'our office');

      // Create follow-up record
      const { error: followUpError } = await supabase.from('follow_ups').insert({
        business_id: business.id,
        client_id: client.id,
        appointment_id: apt.id,
        type: 'post_treatment',
        status: 'scheduled',
        scheduled_for: new Date().toISOString(),
        message_content: messageContent,
        channel: client.phone ? 'sms' : 'email',
      });

      if (followUpError) {
        errors.push(`Follow-up creation failed: ${followUpError.message}`);
        continue;
      }

      // Update appointment follow_up_status
      await supabase
        .from('appointments')
        .update({ follow_up_status: 'in_progress' })
        .eq('id', apt.id);

      created++;
    } catch (err) {
      errors.push(`Error processing apt ${apt.id}: ${String(err)}`);
    }
  }

  return { processed, created, errors };
}

// Process review requests (48 hours after completed appointment)
async function processReviewRequests(business: any): Promise<{ processed: number; created: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;
  let created = 0;

  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

  // Find completed appointments ready for review request
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, clients(id, first_name, last_name, phone, email)')
    .eq('business_id', business.id)
    .eq('status', 'completed')
    .gte('start_time', seventyTwoHoursAgo.toISOString())
    .lte('start_time', fortyEightHoursAgo.toISOString());

  if (!appointments?.length) return { processed: 0, created: 0, errors: [] };

  // Get business review link
  const { data: businessDb } = await supabase
    .from('businesses')
    .select('google_review_link, name, niche_type')
    .eq('id', business.id)
    .single();

  for (const apt of appointments) {
    processed++;
    try {
      const client = apt.clients as any;

      // Check if review request already sent
      const { data: existingReview } = await supabase
        .from('reviews')
        .select('id')
        .eq('appointment_id', apt.id)
        .single();

      if (existingReview) continue;

      // Create review request
      const { error: reviewError } = await supabase.from('reviews').insert({
        business_id: business.id,
        client_id: client.id,
        appointment_id: apt.id,
        status: 'requested',
        requested_at: new Date().toISOString(),
      });

      if (reviewError) {
        errors.push(`Review creation failed: ${reviewError.message}`);
        continue;
      }

      // Create follow-up for review request
      const reviewLink = businessDb?.google_review_link || `https://g.page/${businessDb?.name?.replace(/\s+/g, '')}/review`;

      const nicheConfig = getNicheConfig(businessDb?.niche_type || business.niche_type);
      const messageContent = nicheConfig.smsFollowUp.reviewRequest
        .replace('[Name]', client.first_name)
        .replace('[Business Name]', businessDb?.name || business.name || 'our office')
        .replace('[Link]', reviewLink);

      await supabase.from('follow_ups').insert({
        business_id: business.id,
        client_id: client.id,
        appointment_id: apt.id,
        type: 'review_request',
        status: 'scheduled',
        scheduled_for: new Date().toISOString(),
        message_content: messageContent,
        channel: client.phone ? 'sms' : 'email',
      });

      created++;
    } catch (err) {
      errors.push(`Error processing review for apt ${apt.id}: ${String(err)}`);
    }
  }

  return { processed, created, errors };
}

// Process reactivation campaigns (clients inactive 60+ days)
async function processReactivations(business: any): Promise<{ processed: number; created: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;
  let created = 0;

  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // Find lapsed clients (last visit 60-90 days ago, not already in reactivation)
  const { data: lapsedClients } = await supabase
    .from('clients')
    .select('*')
    .eq('business_id', business.id)
    .eq('status', 'active')
    .gte('last_visit_date', ninetyDaysAgo.toISOString())
    .lte('last_visit_date', sixtyDaysAgo.toISOString());

  if (!lapsedClients?.length) return { processed: 0, created: 0, errors: [] };

  for (const client of lapsedClients) {
    processed++;
    try {
      // Check if already contacted for reactivation recently
      const { data: recentReactivation } = await supabase
        .from('follow_ups')
        .select('id')
        .eq('client_id', client.id)
        .eq('type', 'reactivation')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .single();

      if (recentReactivation) continue;

      // Create reactivation follow-up
      const nicheConfig = getNicheConfig(business.niche_type);
      const messageContent = nicheConfig.smsFollowUp.reactivation
        .replace('[Name]', client.first_name)
        .replace('[Business Name]', business.name || 'our office');

      const { error: followUpError } = await supabase.from('follow_ups').insert({
        business_id: business.id,
        client_id: client.id,
        type: 'reactivation',
        status: 'scheduled',
        scheduled_for: new Date().toISOString(),
        message_content: messageContent,
        channel: client.phone ? 'sms' : 'email',
      });

      if (followUpError) {
        errors.push(`Reactivation creation failed: ${followUpError.message}`);
        continue;
      }

      // Update client status
      await supabase
        .from('clients')
        .update({ status: 'reactivation_target' })
        .eq('id', client.id);

      created++;
    } catch (err) {
      errors.push(`Error processing reactivation for client ${client.id}: ${String(err)}`);
    }
  }

  return { processed, created, errors };
}

// Process lead nurture sequences
async function processLeadNurture(business: any): Promise<{ processed: number; created: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;
  let created = 0;

  // Find new leads that haven't been nurtured
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const { data: newLeads } = await supabase
    .from('leads')
    .select('*')
    .eq('business_id', business.id)
    .eq('status', 'new')
    .gte('created_at', sevenDaysAgo.toISOString());

  if (!newLeads?.length) return { processed: 0, created: 0, errors: [] };

  for (const lead of newLeads) {
    processed++;
    try {
      // Check if already nurtured
      const { data: existingNurture } = await supabase
        .from('messages')
        .select('id')
        .eq('lead_id', lead.id)
        .single();

      if (existingNurture) continue;

      // Create nurture message
      const nicheConfig = getNicheConfig(business.niche_type);
      const messageContent = nicheConfig.smsFollowUp.leadNurture
        .replace('[Name]', lead.first_name);

      const { error: msgError } = await supabase.from('messages').insert({
        business_id: business.id,
        lead_id: lead.id,
        channel: lead.phone ? 'sms' : 'email',
        direction: 'outbound',
        message_type: 'nurture',
        content: messageContent,
        status: 'pending',
        to_number: lead.phone,
        to_email: lead.email,
      });

      if (msgError) {
        errors.push(`Nurture message failed: ${msgError.message}`);
        continue;
      }

      // Update lead status
      await supabase
        .from('leads')
        .update({ status: 'contacted' })
        .eq('id', lead.id);

      created++;
    } catch (err) {
      errors.push(`Error processing nurture for lead ${lead.id}: ${String(err)}`);
    }
  }

  return { processed, created, errors };
}

// GET endpoint to check automation status
export async function GET() {
  // Get counts of pending automations
  const [
    { count: pendingFollowUps },
    { count: pendingReviews },
    { count: lapsedClients },
    { count: newLeads },
  ] = await Promise.all([
    supabase.from('follow_ups').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'reactivation_target'),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'new'),
  ]);

  return NextResponse.json({
    status: 'ready',
    pending: {
      follow_ups: pendingFollowUps || 0,
      review_requests: pendingReviews || 0,
      reactivations: lapsedClients || 0,
      new_leads: newLeads || 0,
    },
    last_check: new Date().toISOString(),
  });
}
