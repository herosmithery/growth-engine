// Supabase Edge Function: Auto Follow-up Scheduler - Sage Agent Automation
// Deploy: supabase functions deploy auto-followup
// Trigger: Cron job (e.g., every hour) or on appointment completion

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MessageTemplate {
  type: string
  message: string
}

// Default message templates for Service Businesses
const MESSAGE_TEMPLATES: Record<string, MessageTemplate> = {
  post_treatment: {
    type: 'post_treatment',
    message: 'Hi {firstName}! How are you feeling after your treatment? Let us know if you have any questions. 💆‍♀️',
  },
  review_request: {
    type: 'review_request',
    message: 'Hi {firstName}! We hope you loved your visit. Would you mind leaving us a quick review? It helps others discover us! ⭐ {reviewLink}',
  },
  reactivation: {
    type: 'reactivation',
    message: 'Hi {firstName}! It\'s been a while since your last visit. We miss you! Book your next appointment and enjoy 15% off. 💝',
  },
  birthday: {
    type: 'birthday',
    message: 'Happy Birthday {firstName}! 🎂 Celebrate with a special gift - 20% off your next treatment. Valid all month!',
  },
}

// Email subject lines per sequence type
const EMAIL_SUBJECTS: Record<string, string> = {
  post_treatment: 'How are you feeling after your visit?',
  review_request: 'We\'d love your feedback ⭐',
  reactivation: 'We miss you — come back for 15% off',
  birthday: '🎂 Happy Birthday! A gift from us',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const results = {
      post_treatment_scheduled: 0,
      review_requests_scheduled: 0,
      reactivations_scheduled: 0,
      birthdays_scheduled: 0,
      messages_queued: 0,
      emails_queued: 0,
    }

    // ============================================
    // 1. Post-Treatment Follow-ups (24-48h after completed appointment)
    // ============================================
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)

    const { data: recentAppointments } = await supabase
      .from('appointments')
      .select(`
        id,
        business_id,
        client_id,
        treatment_name,
        appointment_date,
        clients(id, first_name, phone, email)
      `)
      .eq('status', 'completed')
      .lte('appointment_date', oneDayAgo.toISOString())
      .gte('appointment_date', twoDaysAgo.toISOString())

    for (const apt of recentAppointments || []) {
      const client = (apt as any).clients
      if (!client?.phone && !client?.email) continue

      // Check if post-treatment message already sent for this appointment
      const { data: existingMsg } = await supabase
        .from('messages')
        .select('id')
        .eq('client_id', client.id)
        .eq('business_id', apt.business_id)
        .ilike('content', '%How are you feeling after your treatment%')
        .gte('created_at', twoDaysAgo.toISOString())
        .single()

      if (existingMsg) continue

      const message = MESSAGE_TEMPLATES.post_treatment.message
        .replace(/{firstName}/g, client.first_name || 'there')

      if (client.phone) {
        await supabase.from('messages').insert({
          business_id: apt.business_id,
          client_id: client.id,
          to_number: client.phone,
          channel: 'sms',
          content: message,
          status: 'pending',
          direction: 'outbound',
        })
        results.messages_queued++
      }

      if (client.email) {
        await supabase.from('messages').insert({
          business_id: apt.business_id,
          client_id: client.id,
          to_email: client.email,
          channel: 'email',
          email_subject: EMAIL_SUBJECTS.post_treatment,
          content: message,
          status: 'pending',
          direction: 'outbound',
        })
        results.emails_queued++
      }

      results.post_treatment_scheduled++
    }

    // ============================================
    // 2. Review Request Follow-ups (48-72h after completed appointment - 4+ stars only)
    // ============================================
    const twoDaysAgoReview = new Date(Date.now() - 48 * 60 * 60 * 1000)
    const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000)

    const { data: reviewAppointments } = await supabase
      .from('appointments')
      .select(`
        id,
        business_id,
        client_id,
        appointment_date,
        rating,
        clients(id, first_name, phone, email),
        businesses(google_review_link)
      `)
      .eq('status', 'completed')
      .gte('rating', 4)
      .lte('appointment_date', twoDaysAgoReview.toISOString())
      .gte('appointment_date', threeDaysAgo.toISOString())

    for (const apt of reviewAppointments || []) {
      const client = (apt as any).clients
      const business = (apt as any).businesses
      if (!client?.phone && !client?.email) continue

      // Check if review request already sent
      const { data: existingReview } = await supabase
        .from('messages')
        .select('id')
        .eq('client_id', client.id)
        .ilike('content', '%leaving us a quick review%')
        .gte('created_at', threeDaysAgo.toISOString())
        .single()

      if (existingReview) continue

      const reviewLink = business?.google_review_link || 'https://g.page/review/your-business'
      const message = MESSAGE_TEMPLATES.review_request.message
        .replace(/{firstName}/g, client.first_name || 'there')
        .replace(/{reviewLink}/g, reviewLink)

      if (client.phone) {
        await supabase.from('messages').insert({
          business_id: apt.business_id,
          client_id: client.id,
          to_number: client.phone,
          channel: 'sms',
          content: message,
          status: 'pending',
          direction: 'outbound',
        })
        results.messages_queued++
      }

      if (client.email) {
        await supabase.from('messages').insert({
          business_id: apt.business_id,
          client_id: client.id,
          to_email: client.email,
          channel: 'email',
          email_subject: EMAIL_SUBJECTS.review_request,
          content: message,
          status: 'pending',
          direction: 'outbound',
        })
        results.emails_queued++
      }

      results.review_requests_scheduled++
    }

    // ============================================
    // 3. Reactivation Follow-ups (Phoenix Agent - 60-90 days dormant)
    // ============================================
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const { data: dormantClients } = await supabase
      .from('clients')
      .select('id, business_id, first_name, phone, email, last_visit_date')
      .lt('last_visit_date', sixtyDaysAgo.toISOString())
      .gt('last_visit_date', ninetyDaysAgo.toISOString())
      .limit(25)

    for (const client of dormantClients || []) {
      if (!client.phone && !client.email) continue

      // Check if reactivation message sent in last 30 days
      const { data: existingReactivation } = await supabase
        .from('messages')
        .select('id')
        .eq('client_id', client.id)
        .ilike('content', '%been a while since your last visit%')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .single()

      if (existingReactivation) continue

      const message = MESSAGE_TEMPLATES.reactivation.message
        .replace(/{firstName}/g, client.first_name || 'there')

      if (client.phone) {
        await supabase.from('messages').insert({
          business_id: client.business_id,
          client_id: client.id,
          to_number: client.phone,
          channel: 'sms',
          content: message,
          status: 'pending',
          direction: 'outbound',
        })
        results.messages_queued++
      }

      if (client.email) {
        await supabase.from('messages').insert({
          business_id: client.business_id,
          client_id: client.id,
          to_email: client.email,
          channel: 'email',
          email_subject: EMAIL_SUBJECTS.reactivation,
          content: message,
          status: 'pending',
          direction: 'outbound',
        })
        results.emails_queued++
      }

      results.reactivations_scheduled++
    }

    // ============================================
    // 4. Birthday Follow-ups
    // ============================================
    const today = new Date()
    const todayMonth = today.getMonth() + 1
    const todayDay = today.getDate()
    const yearStart = new Date(today.getFullYear(), 0, 1)

    const { data: birthdayClients } = await supabase
      .from('clients')
      .select('id, business_id, first_name, phone, email, date_of_birth')
      .not('date_of_birth', 'is', null)

    for (const client of birthdayClients || []) {
      if (!client.date_of_birth) continue
      if (!client.phone && !client.email) continue

      const dob = new Date(client.date_of_birth)
      if (dob.getMonth() + 1 !== todayMonth || dob.getDate() !== todayDay) continue

      // Check if birthday message already sent this year
      const { data: existingBirthday } = await supabase
        .from('messages')
        .select('id')
        .eq('client_id', client.id)
        .ilike('content', '%Happy Birthday%')
        .gte('created_at', yearStart.toISOString())
        .single()

      if (existingBirthday) continue

      const message = MESSAGE_TEMPLATES.birthday.message
        .replace(/{firstName}/g, client.first_name || 'there')

      if (client.phone) {
        await supabase.from('messages').insert({
          business_id: client.business_id,
          client_id: client.id,
          to_number: client.phone,
          channel: 'sms',
          content: message,
          status: 'pending',
          direction: 'outbound',
        })
        results.messages_queued++
      }

      if (client.email) {
        await supabase.from('messages').insert({
          business_id: client.business_id,
          client_id: client.id,
          to_email: client.email,
          channel: 'email',
          email_subject: EMAIL_SUBJECTS.birthday,
          content: message,
          status: 'pending',
          direction: 'outbound',
        })
        results.emails_queued++
      }

      results.birthdays_scheduled++
    }

    // ============================================
    // 5. Trigger send-sms and send-email if messages were queued
    // ============================================
    if (results.messages_queued > 0) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        })
      } catch (error) {
        console.error('Failed to trigger send-sms:', error)
      }
    }

    if (results.emails_queued > 0) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        })
      } catch (error) {
        console.error('Failed to trigger send-email:', error)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in auto-followup function:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
