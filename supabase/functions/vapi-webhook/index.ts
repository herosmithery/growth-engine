// Supabase Edge Function: VAPI Webhook Handler
// Deploy: supabase functions deploy vapi-webhook
// Configure in VAPI dashboard: https://your-project.supabase.co/functions/v1/vapi-webhook

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VapiCallEvent {
  type: 'call-started' | 'call-ended' | 'transcript' | 'function-call' | 'speech-update' | 'status-update'
  call?: {
    id: string
    orgId: string
    type: 'inboundPhoneCall' | 'outboundPhoneCall' | 'webCall'
    status: 'queued' | 'ringing' | 'in-progress' | 'forwarding' | 'ended'
    phoneNumberId?: string
    customer?: {
      number: string
    }
    createdAt: string
    endedAt?: string
    endedReason?: string
    transcript?: string
    summary?: string
    recordingUrl?: string
    duration?: number
  }
  message?: {
    role: string
    content: string
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseKey)

    const event: VapiCallEvent = await req.json()
    console.log('VAPI webhook received:', event.type)

    // Handle different event types
    switch (event.type) {
      case 'call-started': {
        if (!event.call) break

        // Find business by VAPI phone number
        const { data: business } = await supabase
          .from('businesses')
          .select('id')
          .eq('vapi_phone_number', event.call.phoneNumberId)
          .single()

        if (!business) {
          console.log('No business found for phone number:', event.call.phoneNumberId)
          break
        }

        // Check if caller is an existing client
        const { data: clients } = await supabase
          .from('clients')
          .select('id')
          .eq('business_id', business.id)
          .eq('phone', event.call.customer?.number)
          .limit(1)

        const client = clients?.[0] || null

        // Create call log entry
        const { error: insertError } = await supabase.from('call_logs').insert({
          business_id: business.id,
          client_id: client?.id || null,
          caller_phone: event.call.customer?.number,
          vapi_call_id: event.call.id,
          duration_seconds: 0,
          outcome: null,
        })

        if (insertError) {
          console.error('Failed to insert call log:', insertError)
        } else {
          console.log('Call log created for:', event.call.id)
        }

        break
      }

      case 'call-ended': {
        if (!event.call) break

        // Determine outcome based on call data
        let outcome = 'info_only'
        const summary = event.call.summary?.toLowerCase() || ''

        if (summary.includes('book') || summary.includes('appointment') || summary.includes('schedule')) {
          outcome = 'booked'
        } else if (summary.includes('callback') || summary.includes('call back')) {
          outcome = 'callback_requested'
        } else if (event.call.endedReason === 'voicemail') {
          outcome = 'voicemail'
        } else if (event.call.duration && event.call.duration < 10) {
          outcome = 'dropped'
        }

        // Update call log with final data
        await supabase
          .from('call_logs')
          .update({
            duration_seconds: event.call.duration || 0,
            outcome,
            summary: event.call.summary,
            transcript: event.call.transcript ? { text: event.call.transcript } : null,
            recording_url: event.call.recordingUrl,
          })
          .eq('vapi_call_id', event.call.id)

        // If call resulted in booking, we could trigger appointment creation here
        if (outcome === 'booked') {
          console.log('Call resulted in booking - appointment may need to be created')
        }

        break
      }

      case 'transcript': {
        // Real-time transcript update - could be used for live monitoring
        console.log('Transcript update:', event.message?.content)
        break
      }

      case 'status-update': {
        // SMS delivery status updates
        console.log('Status update received')
        break
      }

      default:
        console.log('Unhandled event type:', event.type)
    }

    return new Response(
      JSON.stringify({ success: true, event_type: event.type }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in vapi-webhook function:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
