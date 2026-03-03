// Supabase Edge Function: Send SMS via Twilio
// Deploy: supabase functions deploy send-sms
//
// Required secrets:
//   supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxx
//   supabase secrets set TWILIO_AUTH_TOKEN=xxxxxx
//   supabase secrets set TWILIO_PHONE_NUMBER=+1234567890

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Message {
  id: string
  business_id: string
  client_id: string
  to_number: string
  content: string
  status: string
}

// Retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const isRetryable = error instanceof Error && (
        error.message.includes('429') ||
        error.message.includes('500') ||
        error.message.includes('502') ||
        error.message.includes('503')
      )

      if (!isRetryable || attempt === maxRetries - 1) {
        throw error
      }

      const delay = baseDelay * Math.pow(2, attempt)
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

    // Twilio credentials
    const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const twilioPhone = Deno.env.get('TWILIO_PHONE_NUMBER')

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get pending messages
    const { data: messages, error: fetchError } = await supabase
      .from('messages')
      .select('id, business_id, client_id, to_number, content, status')
      .eq('status', 'pending')
      .eq('channel', 'sms')
      .limit(50)

    if (fetchError) {
      throw new Error(`Failed to fetch messages: ${fetchError.message}`)
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No pending messages' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if Twilio is configured
    if (!twilioSid || !twilioToken || !twilioPhone) {
      // Demo mode: mark messages as sent without actually sending
      console.log('Twilio not configured - running in demo mode')

      for (const msg of messages) {
        await supabase
          .from('messages')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', msg.id)
      }

      return new Response(
        JSON.stringify({
          success: true,
          demo_mode: true,
          processed: messages.length,
          sent: messages.length,
          message: 'Demo mode - messages marked as sent. Set TWILIO_* secrets for real SMS.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Production mode: Send via Twilio
    const results = []
    const twilioAuth = btoa(`${twilioSid}:${twilioToken}`)

    for (const msg of messages) {
      try {
        const twilioResponse = await retryWithBackoff(async () => {
          const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${twilioAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                To: msg.to_number,
                From: twilioPhone,
                Body: msg.content,
              }),
            }
          )

          if (!response.ok) {
            const errorData = await response.text()
            throw new Error(`Twilio error: ${response.status} - ${errorData}`)
          }

          return response.json()
        })

        await supabase
          .from('messages')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            external_id: twilioResponse.sid,
          })
          .eq('id', msg.id)

        results.push({ id: msg.id, status: 'sent', sid: twilioResponse.sid })

      } catch (sendError) {
        await supabase
          .from('messages')
          .update({
            status: 'failed',
            error_message: sendError instanceof Error ? sendError.message : 'Unknown error',
          })
          .eq('id', msg.id)

        results.push({ id: msg.id, status: 'failed', error: sendError instanceof Error ? sendError.message : 'unknown' })
      }
    }

    const sent = results.filter(r => r.status === 'sent').length
    const failed = results.filter(r => r.status === 'failed').length

    return new Response(
      JSON.stringify({
        success: true,
        processed: messages.length,
        sent,
        failed,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-sms function:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
