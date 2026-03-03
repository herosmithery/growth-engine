// Supabase Edge Function: Book Appointment - Aura Agent Booking Tool
// Deploy: supabase functions deploy book-appointment
// Used by: VAPI voice agent as a tool during calls

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BookingRequest {
  // From VAPI tool call
  business_id?: string
  phone_number?: string  // Caller's phone to find/create client
  client_name?: string
  treatment_type?: string
  preferred_date?: string  // "tomorrow", "next monday", "2026-02-25"
  preferred_time?: string  // "morning", "afternoon", "2pm", "14:00"
  action?: 'check_availability' | 'book' | 'get_next_available'
}

// VAPI request wrapper format
interface VapiToolCall {
  id: string
  type: string
  function: {
    name: string
    arguments: string | Record<string, unknown>
  }
}

interface VapiRequest {
  message?: {
    type?: string
    toolCallList?: VapiToolCall[]
    call?: {
      customer?: { number?: string }
    }
  }
  // Direct call format
  action?: string
  [key: string]: unknown
}

// Helper to create VAPI-compatible response
function vapiResponse(toolCallId: string | null, message: string, data?: Record<string, unknown>) {
  // If we have a toolCallId, wrap in VAPI format
  if (toolCallId) {
    return new Response(
      JSON.stringify({
        results: [{
          toolCallId,
          result: message.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
        }]
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  // Otherwise return normal format for direct calls
  return new Response(
    JSON.stringify({ success: true, message, ...data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

interface TimeSlot {
  date: string
  time: string
  datetime: string
  available: boolean
}

// Parse relative dates like "tomorrow", "next monday"
function parseDate(dateStr: string): Date {
  const today = new Date()
  const lowerDate = dateStr.toLowerCase().trim()

  if (lowerDate === 'today') {
    return today
  }
  if (lowerDate === 'tomorrow') {
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    return tomorrow
  }
  if (lowerDate.startsWith('next ')) {
    const dayName = lowerDate.replace('next ', '')
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const targetDay = days.indexOf(dayName)
    if (targetDay !== -1) {
      const result = new Date(today)
      const currentDay = today.getDay()
      let daysToAdd = targetDay - currentDay
      if (daysToAdd <= 0) daysToAdd += 7
      result.setDate(today.getDate() + daysToAdd)
      return result
    }
  }
  // Try parsing as ISO date
  const parsed = new Date(dateStr)
  return isNaN(parsed.getTime()) ? today : parsed
}

// Parse time strings like "2pm", "14:00", "morning"
function parseTime(timeStr: string): { hour: number; minute: number } {
  const lowerTime = timeStr.toLowerCase().trim()

  if (lowerTime === 'morning') return { hour: 10, minute: 0 }
  if (lowerTime === 'afternoon') return { hour: 14, minute: 0 }
  if (lowerTime === 'evening') return { hour: 17, minute: 0 }

  // Parse "2pm", "2:30pm"
  const pmMatch = lowerTime.match(/(\d{1,2})(?::(\d{2}))?\s*(pm|am)?/)
  if (pmMatch) {
    let hour = parseInt(pmMatch[1])
    const minute = pmMatch[2] ? parseInt(pmMatch[2]) : 0
    const period = pmMatch[3]

    if (period === 'pm' && hour < 12) hour += 12
    if (period === 'am' && hour === 12) hour = 0

    return { hour, minute }
  }

  return { hour: 10, minute: 0 } // Default to 10am
}

// Get available time slots for a date
function getAvailableSlots(
  businessHours: Record<string, { open: string; close: string } | null>,
  date: Date,
  existingAppointments: { start_time: string }[]
): TimeSlot[] {
  // Try both short and full day names to handle different data formats
  const shortNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const fullNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayIndex = date.getDay()

  // Try short name first, then full name
  let hours = businessHours[shortNames[dayIndex]] || businessHours[fullNames[dayIndex]]

  console.log('Checking day:', shortNames[dayIndex], '/', fullNames[dayIndex], 'Hours:', hours)

  if (!hours) return [] // Business closed on this day

  const slots: TimeSlot[] = []
  const [openHour, openMin] = hours.open.split(':').map(Number)
  const [closeHour, closeMin] = hours.close.split(':').map(Number)

  // Create 30-minute slots
  const dateStr = date.toISOString().split('T')[0]
  const bookedTimes = new Set(
    existingAppointments
      .filter(apt => apt.start_time.startsWith(dateStr))
      .map(apt => {
        const d = new Date(apt.start_time)
        return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`
      })
  )

  for (let h = openHour; h < closeHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === openHour && m < openMin) continue
      if (h === closeHour - 1 && m > closeMin) continue

      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
      const slotKey = `${h}:${m.toString().padStart(2, '0')}`
      const datetime = `${dateStr}T${timeStr}:00`

      // Skip past times for today
      const now = new Date()
      if (dateStr === now.toISOString().split('T')[0]) {
        if (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes())) {
          continue
        }
      }

      slots.push({
        date: dateStr,
        time: timeStr,
        datetime,
        available: !bookedTimes.has(slotKey),
      })
    }
  }

  return slots
}

// Format time for speech
function formatTimeForSpeech(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h
  const period = h >= 12 ? 'PM' : 'AM'
  const minutes = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`
  return `${hour12}${minutes} ${period}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const rawBody: VapiRequest = await req.json()

    // Extract tool call info from VAPI format
    let toolCallId: string | null = null
    let body: BookingRequest = {}
    let callerPhone: string | null = null

    // Check if this is a VAPI tool call request
    if (rawBody.message?.type === 'tool-calls' && rawBody.message.toolCallList?.[0]) {
      const toolCall = rawBody.message.toolCallList[0]
      toolCallId = toolCall.id
      callerPhone = rawBody.message.call?.customer?.number || null

      // Parse arguments (can be string or object)
      const args = typeof toolCall.function.arguments === 'string'
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments

      body = args as BookingRequest
      if (callerPhone && !body.phone_number) {
        body.phone_number = callerPhone
      }
      console.log('VAPI tool call:', toolCall.function.name, 'args:', JSON.stringify(body))
    } else {
      // Direct API call (not from VAPI)
      body = rawBody as BookingRequest
    }

    const action = body.action || 'check_availability'

    // Find the business (from VAPI call context or default)
    let businessId = body.business_id
    if (!businessId && body.phone_number) {
      // Try to find business by the caller's associated client
      const { data: client } = await supabase
        .from('clients')
        .select('business_id')
        .eq('phone', body.phone_number)
        .single()

      if (client) businessId = client.business_id
    }

    // Default to first business if not found
    if (!businessId) {
      const { data: defaultBusiness } = await supabase
        .from('businesses')
        .select('id')
        .limit(1)
        .single()

      if (defaultBusiness) businessId = defaultBusiness.id
    }

    if (!businessId) {
      return vapiResponse(toolCallId, "I'm having trouble finding the business information. Let me connect you with our team.")
    }

    // Get business details
    const { data: business } = await supabase
      .from('businesses')
      .select('id, name, business_hours, timezone')
      .eq('id', businessId)
      .single()

    if (!business || !business.business_hours) {
      console.log('Business not found or no hours:', businessId, business)
      return vapiResponse(toolCallId, "Our scheduling system is being updated. Let me have someone call you back to book your appointment.")
    }

    console.log('Using business:', business.name, 'Hours:', JSON.stringify(business.business_hours))

    // ============================================
    // ACTION: Get Next Available Slots
    // ============================================
    if (action === 'get_next_available') {
      const slots: TimeSlot[] = []
      const today = new Date()

      // Check next 7 days
      for (let i = 0; i < 7 && slots.length < 5; i++) {
        const checkDate = new Date(today)
        checkDate.setDate(today.getDate() + i)
        const dateStr = checkDate.toISOString().split('T')[0]

        // Get existing appointments for this date
        const { data: appointments } = await supabase
          .from('appointments')
          .select('start_time')
          .eq('business_id', businessId)
          .gte('start_time', `${dateStr}T00:00:00`)
          .lt('start_time', `${dateStr}T23:59:59`)
          .in('status', ['confirmed', 'pending'])

        const daySlots = getAvailableSlots(business.business_hours, checkDate, appointments || [])
        const availableSlots = daySlots.filter(s => s.available).slice(0, 3)
        slots.push(...availableSlots)
      }

      const formattedSlots = slots.slice(0, 5).map(s => ({
        date: new Date(s.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        time: formatTimeForSpeech(s.time),
        datetime: s.datetime,
      }))

      const message = formattedSlots.length > 0
        ? `I found ${formattedSlots.length} available slots: ${formattedSlots.map(s => `${s.date} at ${s.time}`).join(', ')}. Which works best for you?`
        : "I don't see any available slots in the next few days. Would you like me to have someone from our team call you back to find a time that works?"

      return vapiResponse(toolCallId, message, { slots: formattedSlots })
    }

    // ============================================
    // ACTION: Check Availability for Specific Date/Time
    // ============================================
    if (action === 'check_availability') {
      const targetDate = body.preferred_date ? parseDate(body.preferred_date) : new Date()
      const dateStr = targetDate.toISOString().split('T')[0]

      // Get existing appointments
      const { data: appointments } = await supabase
        .from('appointments')
        .select('start_time')
        .eq('business_id', businessId)
        .gte('start_time', `${dateStr}T00:00:00`)
        .lt('start_time', `${dateStr}T23:59:59`)
        .in('status', ['confirmed', 'pending'])

      const slots = getAvailableSlots(business.business_hours, targetDate, appointments || [])
      const availableSlots = slots.filter(s => s.available)

      // If specific time requested, check that slot
      if (body.preferred_time) {
        const { hour, minute } = parseTime(body.preferred_time)
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        const requestedSlot = slots.find(s => s.time === timeStr)

        if (requestedSlot?.available) {
          const message = `Yes, ${formatTimeForSpeech(timeStr)} on ${targetDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} is available! Would you like me to book that for you?`
          return vapiResponse(toolCallId, message, {
            available: true,
            slot: { date: dateStr, time: timeStr, datetime: requestedSlot.datetime }
          })
        } else {
          // Suggest nearby times
          const nearby = availableSlots.slice(0, 3).map(s => formatTimeForSpeech(s.time))
          const message = `Sorry, ${formatTimeForSpeech(timeStr)} isn't available. ${nearby.length > 0 ? `I have openings at ${nearby.join(', ')}. Would any of those work?` : 'Let me check another day for you.'}`
          return vapiResponse(toolCallId, message, { available: false, alternatives: availableSlots.slice(0, 3) })
        }
      }

      // Return available slots for the day
      const formattedSlots = availableSlots.slice(0, 5).map(s => formatTimeForSpeech(s.time))
      const message = availableSlots.length > 0
        ? `On ${targetDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}, I have openings at ${formattedSlots.join(', ')}. What time works for you?`
        : `Sorry, we're fully booked on ${targetDate.toLocaleDateString('en-US', { weekday: 'long' })}. Would you like to check another day?`
      return vapiResponse(toolCallId, message, { slots: availableSlots.slice(0, 5) })
    }

    // ============================================
    // ACTION: Book Appointment
    // ============================================
    if (action === 'book') {
      if (!body.preferred_date || !body.preferred_time) {
        return vapiResponse(toolCallId, "I need to know when you'd like to come in. What date and time work best for you?")
      }

      const targetDate = parseDate(body.preferred_date)
      const { hour, minute } = parseTime(body.preferred_time)
      const dateStr = targetDate.toISOString().split('T')[0]
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      const startTime = `${dateStr}T${timeStr}:00`

      // Verify slot is still available
      const { data: conflicts } = await supabase
        .from('appointments')
        .select('id')
        .eq('business_id', businessId)
        .eq('start_time', startTime)
        .in('status', ['confirmed', 'pending'])

      if (conflicts && conflicts.length > 0) {
        return vapiResponse(toolCallId, "Oh, it looks like someone just booked that slot. Let me find another time for you.")
      }

      // Find or create client (required for appointment)
      let clientId: string | null = null

      // Try to find existing client by phone
      if (body.phone_number) {
        const { data: existingClient } = await supabase
          .from('clients')
          .select('id')
          .eq('phone', body.phone_number)
          .eq('business_id', businessId)
          .single()

        if (existingClient) {
          clientId = existingClient.id
        }
      }

      // Create new client if not found
      if (!clientId) {
        const nameParts = (body.client_name || 'Guest').split(' ')
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            business_id: businessId,
            first_name: nameParts[0] || 'Guest',
            last_name: nameParts.slice(1).join(' ') || null,
            phone: body.phone_number || null,
          })
          .select('id')
          .single()

        if (clientError) {
          console.error('Client creation error:', clientError)
          return vapiResponse(toolCallId, "I'm having trouble saving your information. Let me connect you with our team.")
        }

        clientId = newClient.id
      }

      // Create the appointment
      const { data: appointment, error: aptError } = await supabase
        .from('appointments')
        .insert({
          business_id: businessId,
          client_id: clientId,
          treatment_type: body.treatment_type || 'Consultation',
          start_time: startTime,
          status: 'confirmed',
          source: 'ai_phone',
        })
        .select('id')
        .single()

      if (aptError) {
        console.error('Booking error:', aptError)
        return vapiResponse(toolCallId, "I'm having trouble completing the booking. Let me transfer you to our team.")
      }

      const formattedDate = targetDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      })
      const formattedTime = formatTimeForSpeech(timeStr)

      const message = `Perfect! I've booked your ${body.treatment_type || 'appointment'} for ${formattedDate} at ${formattedTime}. You'll receive a confirmation text shortly. Is there anything else I can help you with?`
      return vapiResponse(toolCallId, message, {
        booked: true,
        appointment_id: appointment.id,
        confirmation: { date: formattedDate, time: formattedTime, treatment: body.treatment_type || 'Consultation' }
      })
    }

    return vapiResponse(toolCallId, "I'm not sure what you're asking. Would you like me to check available appointment times?")

  } catch (error) {
    console.error('Error in book-appointment function:', error)
    // For errors, we still need to return 200 with a message for VAPI
    return new Response(
      JSON.stringify({
        results: [{
          toolCallId: 'unknown',
          result: "I'm having a little trouble with our system. Let me connect you with someone who can help."
        }]
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
