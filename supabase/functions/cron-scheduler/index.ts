// Supabase Edge Function: Cron Scheduler
// Deploy: supabase functions deploy cron-scheduler
// This function orchestrates all scheduled automation tasks
// Configure as a cron job: every 15 minutes

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  const results: Record<string, any> = {}

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // ============================================
    // Task 1: Run Active Campaigns (Phoenix Agent)
    // ============================================
    try {
      const campaignResponse = await fetch(`${supabaseUrl}/functions/v1/run-campaign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      })
      results.run_campaign = await campaignResponse.json()
      console.log('run-campaign completed:', results.run_campaign)
    } catch (error) {
      console.error('run-campaign failed:', error)
      results.run_campaign = { error: error instanceof Error ? error.message : 'Unknown error' }
    }

    // ============================================
    // Task 2: Process Auto Follow-ups (Sage Agent)
    // ============================================
    try {
      const followupResponse = await fetch(`${supabaseUrl}/functions/v1/auto-followup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      })
      results.auto_followup = await followupResponse.json()
      console.log('auto-followup completed:', results.auto_followup)
    } catch (error) {
      console.error('auto-followup failed:', error)
      results.auto_followup = { error: error instanceof Error ? error.message : 'Unknown error' }
    }

    // ============================================
    // Task 3: Send Pending SMS Messages
    // ============================================
    try {
      const smsResponse = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      })
      results.send_sms = await smsResponse.json()
      console.log('send-sms completed:', results.send_sms)
    } catch (error) {
      console.error('send-sms failed:', error)
      results.send_sms = { error: error instanceof Error ? error.message : 'Unknown error' }
    }

    // ============================================
    // Task 4: Activate Scheduled Campaigns
    // ============================================
    try {
      const supabase = createClient(supabaseUrl, supabaseKey)

      // Find campaigns that should be activated
      const now = new Date()
      const { data: campaignsToActivate, error } = await supabase
        .from('campaigns')
        .select('id, name')
        .eq('status', 'scheduled')
        .lte('start_date', now.toISOString())

      if (!error && campaignsToActivate && campaignsToActivate.length > 0) {
        for (const campaign of campaignsToActivate) {
          await supabase
            .from('campaigns')
            .update({ status: 'active', started_at: now.toISOString() })
            .eq('id', campaign.id)
        }
        results.campaigns_activated = campaignsToActivate.length
        console.log(`Activated ${campaignsToActivate.length} scheduled campaigns`)
      } else {
        results.campaigns_activated = 0
      }
    } catch (error) {
      console.error('Campaign activation failed:', error)
      results.campaigns_activated = { error: error instanceof Error ? error.message : 'Unknown error' }
    }

    // ============================================
    // Task 5: Complete Finished Campaigns
    // ============================================
    try {
      const supabase = createClient(supabaseUrl, supabaseKey)

      // Find active campaigns where all targets have been contacted
      const { data: campaignsToComplete } = await supabase
        .from('campaigns')
        .select('id, name, target_count, sent_count')
        .eq('status', 'active')
        .not('target_count', 'is', null)

      const completed = []
      for (const campaign of campaignsToComplete || []) {
        if (campaign.target_count > 0 && campaign.sent_count >= campaign.target_count) {
          await supabase
            .from('campaigns')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', campaign.id)
          completed.push(campaign.name)
        }
      }

      results.campaigns_completed = completed.length
      if (completed.length > 0) {
        console.log(`Completed campaigns: ${completed.join(', ')}`)
      }
    } catch (error) {
      console.error('Campaign completion check failed:', error)
    }

    const duration = Date.now() - startTime

    return new Response(
      JSON.stringify({
        success: true,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in cron-scheduler:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
