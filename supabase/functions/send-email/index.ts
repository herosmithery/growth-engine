// Supabase Edge Function: Send Email via Resend
// Deploy: supabase functions deploy send-email
// Trigger: Called by auto-followup or manually

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailPayload {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
}

async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev'
  const replyTo = Deno.env.get('RESEND_REPLY_TO')

  if (!resendApiKey) {
    console.error('RESEND_API_KEY not set')
    return false
  }

  const body: Record<string, unknown> = {
    from: payload.from || fromEmail,
    to: [payload.to],
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  }

  if (replyTo) body.reply_to = [replyTo]

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Resend error:', error)
    return false
  }

  return true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const results = { sent: 0, failed: 0 }

    // Fetch pending email messages
    const { data: pendingEmails, error } = await supabase
      .from('messages')
      .select('*, clients(email, first_name)')
      .eq('status', 'pending')
      .eq('channel', 'email')
      .limit(50)

    if (error) throw new Error(`Failed to fetch pending emails: ${error.message}`)

    for (const msg of pendingEmails || []) {
      const client = (msg as any).clients
      const toEmail = client?.email || msg.to_email

      if (!toEmail) {
        await supabase.from('messages').update({ status: 'failed' }).eq('id', msg.id)
        results.failed++
        continue
      }

      const sent = await sendEmail({
        to: toEmail,
        subject: msg.email_subject || 'A message from us',
        html: msg.content.replace(/\n/g, '<br>'),
        text: msg.content,
      })

      await supabase
        .from('messages')
        .update({ status: sent ? 'sent' : 'failed', sent_at: sent ? new Date().toISOString() : null })
        .eq('id', msg.id)

      if (sent) results.sent++
      else results.failed++
    }

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-email function:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
