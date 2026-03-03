// Supabase Edge Function: Run Campaign - Phoenix Agent Automation
// Deploy: supabase functions deploy run-campaign
// Trigger: Cron job or manual invoke

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Campaign {
  id: string
  business_id: string
  name: string
  type: string
  status: string
  message_template: string | null
  target_criteria: {
    min_days_since_visit?: number
    treatment_type?: string
  } | null
  target_count: number
  messages_sent: number
}

interface Client {
  id: string
  first_name: string
  last_name: string | null
  phone: string | null
  email: string | null
  last_visit_date: string | null
}

// Retry with exponential backoff (from api-integration skill)
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxRetries - 1) throw error
      const delay = baseDelay * Math.pow(2, attempt)
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error('Max retries exceeded')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const vapiApiKey = Deno.env.get('VAPI_API_KEY')

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get request body for optional campaign_id filter
    let campaignFilter: string | null = null
    try {
      const body = await req.json()
      campaignFilter = body.campaign_id || null
    } catch {
      // No body provided, process all active campaigns
    }

    // Fetch active campaigns
    let query = supabase
      .from('campaigns')
      .select('*')
      .eq('status', 'active')

    if (campaignFilter) {
      query = query.eq('id', campaignFilter)
    }

    const { data: campaigns, error: campaignError } = await query

    if (campaignError) {
      throw new Error(`Failed to fetch campaigns: ${campaignError.message}`)
    }

    if (!campaigns || campaigns.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active campaigns to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = []

    for (const campaign of campaigns as Campaign[]) {
      console.log(`Processing campaign: ${campaign.name}`)

      // Find target clients based on campaign criteria
      let clientQuery = supabase
        .from('clients')
        .select('id, first_name, last_name, phone, email, last_visit_date')
        .eq('business_id', campaign.business_id)
        .not('phone', 'is', null)

      // Apply reactivation criteria
      if (campaign.type === 'reactivation' && campaign.target_criteria?.min_days_since_visit) {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - campaign.target_criteria.min_days_since_visit)
        clientQuery = clientQuery.lt('last_visit_date', cutoffDate.toISOString())
      }

      const { data: clients, error: clientError } = await clientQuery.limit(50)

      if (clientError) {
        console.error(`Error fetching clients for campaign ${campaign.id}:`, clientError)
        results.push({ campaign_id: campaign.id, error: clientError.message })
        continue
      }

      if (!clients || clients.length === 0) {
        console.log(`No target clients for campaign ${campaign.name}`)
        results.push({ campaign_id: campaign.id, clients_found: 0, messages_queued: 0 })
        continue
      }

      // Check which clients already received this campaign message
      const { data: existingMessages } = await supabase
        .from('messages')
        .select('client_id')
        .eq('campaign_id', campaign.id)

      const sentClientIds = new Set((existingMessages || []).map(m => m.client_id))

      // Filter out clients who already received the message
      const targetClients = (clients as Client[]).filter(c => !sentClientIds.has(c.id))

      if (targetClients.length === 0) {
        console.log(`All target clients already contacted for campaign ${campaign.name}`)
        results.push({ campaign_id: campaign.id, clients_found: clients.length, messages_queued: 0 })
        continue
      }

      // Queue messages for each target client
      const messagesToQueue = targetClients.map(client => {
        // Default templates by campaign type
        const defaultTemplates: Record<string, string> = {
          reactivation: "Hi {firstName}! We miss you at our med spa. It's been a while since your last visit. Book now and enjoy 15% off your next treatment! Reply YES to schedule.",
          nurture: "Hi {firstName}! Thanks for your interest in our services. We'd love to help you achieve your beauty goals. Reply to learn more about our treatments!",
          review: "Hi {firstName}! Thank you for visiting us! We'd love to hear about your experience. Would you take a moment to leave us a review? {reviewLink}",
          default: "Hi {firstName}! We have a special offer just for you at our med spa. Reply to learn more!"
        }

        // Use campaign template or default
        const template = campaign.message_template || defaultTemplates[campaign.type] || defaultTemplates.default

        // Personalize message template
        const personalizedMessage = template
          .replace(/{firstName}/g, client.first_name || 'there')
          .replace(/{lastName}/g, client.last_name || '')
          .replace(/{name}/g, `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'there')

        return {
          business_id: campaign.business_id,
          client_id: client.id,
          campaign_id: campaign.id,
          to_number: client.phone,
          channel: 'sms',
          content: personalizedMessage,
          status: 'pending',
          direction: 'outbound',
        }
      })

      // Insert messages in batch
      const { data: insertedMessages, error: insertError } = await supabase
        .from('messages')
        .insert(messagesToQueue)
        .select('id')

      if (insertError) {
        console.error(`Error queueing messages for campaign ${campaign.id}:`, insertError)
        results.push({ campaign_id: campaign.id, error: insertError.message })
        continue
      }

      // Update campaign sent count
      const newSentCount = campaign.messages_sent + (insertedMessages?.length || 0)
      await supabase
        .from('campaigns')
        .update({
          messages_sent: newSentCount,
          started_at: campaign.messages_sent === 0 ? new Date().toISOString() : undefined,
        })
        .eq('id', campaign.id)

      results.push({
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        clients_found: clients.length,
        messages_queued: insertedMessages?.length || 0,
      })

      console.log(`Queued ${insertedMessages?.length || 0} messages for campaign ${campaign.name}`)
    }

    // Optionally trigger the send-sms function to process queued messages
    if (vapiApiKey) {
      try {
        await retryWithBackoff(async () => {
          const response = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
          })
          if (!response.ok) throw new Error(`send-sms returned ${response.status}`)
          return response.json()
        })
        console.log('Triggered send-sms function to process queued messages')
      } catch (error) {
        console.error('Failed to trigger send-sms:', error)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        campaigns_processed: campaigns.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in run-campaign function:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
