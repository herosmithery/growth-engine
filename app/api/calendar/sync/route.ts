import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

interface SyncResult {
  toGoogle: { synced: number; errors: string[] };
  fromGoogle: { synced: number; errors: string[] };
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get('business_id');

  if (!businessId) {
    return NextResponse.json({ error: 'business_id required' }, { status: 400 });
  }

  try {
    // Get business with Google Calendar tokens
    const { data: business } = await supabase
      .from('businesses')
      .select('id, name, google_calendar_tokens, google_calendar_id, google_calendar_sync_enabled')
      .eq('id', businessId)
      .single();

    if (!business?.google_calendar_tokens || !business.google_calendar_sync_enabled) {
      return NextResponse.json({ error: 'Google Calendar not connected or sync disabled' }, { status: 400 });
    }

    const result: SyncResult = {
      toGoogle: { synced: 0, errors: [] },
      fromGoogle: { synced: 0, errors: [] },
    };

    // Set up OAuth client with stored tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/calendar/callback`
    );
    oauth2Client.setCredentials(business.google_calendar_tokens);

    // Check if token needs refresh
    if (business.google_calendar_tokens.expiry_date < Date.now()) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);

      // Save refreshed tokens
      await supabase
        .from('businesses')
        .update({ google_calendar_tokens: credentials })
        .eq('id', businessId);
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarId = business.google_calendar_id || 'primary';

    // 1. Sync pending items TO Google Calendar
    const { data: pendingSyncs } = await supabase
      .from('calendar_sync_log')
      .select('*, appointments(*, clients(first_name, last_name, phone, email))')
      .eq('business_id', businessId)
      .eq('status', 'pending')
      .eq('sync_direction', 'to_google')
      .limit(20);

    for (const syncItem of pendingSyncs || []) {
      try {
        const apt = syncItem.appointments as any;
        const client = apt?.clients as any;

        if (syncItem.sync_action === 'create' && apt) {
          // Create event in Google Calendar
          const event = {
            summary: `${apt.treatment_type} - ${client?.first_name || 'Client'} ${client?.last_name || ''}`,
            description: `Treatment: ${apt.treatment_type}\nClient: ${client?.first_name} ${client?.last_name}\nPhone: ${client?.phone || 'N/A'}\nStatus: ${apt.status}`,
            start: {
              dateTime: apt.start_time,
              timeZone: 'America/New_York',
            },
            end: {
              dateTime: apt.end_time || new Date(new Date(apt.start_time).getTime() + 60 * 60 * 1000).toISOString(),
              timeZone: 'America/New_York',
            },
            colorId: getColorForStatus(apt.status),
          };

          const response = await calendar.events.insert({
            calendarId,
            requestBody: event,
          });

          // Update appointment with Google event ID
          await supabase
            .from('appointments')
            .update({
              google_event_id: response.data.id,
              google_calendar_synced: true,
            })
            .eq('id', apt.id);

          result.toGoogle.synced++;

        } else if (syncItem.sync_action === 'update' && apt?.google_event_id) {
          // Update event in Google Calendar
          const event = {
            summary: `${apt.treatment_type} - ${client?.first_name || 'Client'} ${client?.last_name || ''}`,
            description: `Treatment: ${apt.treatment_type}\nClient: ${client?.first_name} ${client?.last_name}\nPhone: ${client?.phone || 'N/A'}\nStatus: ${apt.status}`,
            start: {
              dateTime: apt.start_time,
              timeZone: 'America/New_York',
            },
            end: {
              dateTime: apt.end_time || new Date(new Date(apt.start_time).getTime() + 60 * 60 * 1000).toISOString(),
              timeZone: 'America/New_York',
            },
            colorId: getColorForStatus(apt.status),
          };

          await calendar.events.update({
            calendarId,
            eventId: apt.google_event_id,
            requestBody: event,
          });

          result.toGoogle.synced++;

        } else if (syncItem.sync_action === 'delete' && syncItem.google_event_id) {
          // Delete event from Google Calendar
          await calendar.events.delete({
            calendarId,
            eventId: syncItem.google_event_id,
          });

          result.toGoogle.synced++;
        }

        // Mark sync as complete
        await supabase
          .from('calendar_sync_log')
          .update({ status: 'success' })
          .eq('id', syncItem.id);

      } catch (err) {
        result.toGoogle.errors.push(`Sync ${syncItem.id} failed: ${String(err)}`);
        await supabase
          .from('calendar_sync_log')
          .update({ status: 'failed', error_message: String(err) })
          .eq('id', syncItem.id);
      }
    }

    // 2. Sync events FROM Google Calendar (new events in last 24h)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const { data: events } = await calendar.events.list({
      calendarId,
      timeMin: yesterday.toISOString(),
      timeMax: nextMonth.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    for (const event of events.items || []) {
      try {
        // Check if we already have this event
        const { data: existingApt } = await supabase
          .from('appointments')
          .select('id')
          .eq('google_event_id', event.id)
          .single();

        if (existingApt) continue; // Already synced

        // Check if this event looks like an appointment (has a client name in title)
        if (!event.start?.dateTime) continue; // Skip all-day events

        // Create appointment from Google event
        const { error: aptError } = await supabase.from('appointments').insert({
          business_id: businessId,
          treatment_type: event.summary || 'Appointment',
          start_time: event.start.dateTime,
          end_time: event.end?.dateTime,
          status: 'confirmed',
          source: 'google_calendar',
          google_event_id: event.id,
          google_calendar_synced: true,
        });

        if (!aptError) {
          result.fromGoogle.synced++;
        }
      } catch (err) {
        result.fromGoogle.errors.push(`Event ${event.id} import failed: ${String(err)}`);
      }
    }

    // Update last synced timestamp
    await supabase
      .from('businesses')
      .update({ google_calendar_last_synced_at: new Date().toISOString() })
      .eq('id', businessId);

    return NextResponse.json({
      success: true,
      synced_at: new Date().toISOString(),
      result,
    });

  } catch (error) {
    console.error('Calendar sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint to check sync status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get('business_id');

  if (!businessId) {
    return NextResponse.json({ error: 'business_id required' }, { status: 400 });
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('google_calendar_connected, google_calendar_sync_enabled, google_calendar_last_synced_at')
    .eq('id', businessId)
    .single();

  const { count: pendingSync } = await supabase
    .from('calendar_sync_log')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('status', 'pending');

  return NextResponse.json({
    connected: business?.google_calendar_connected || false,
    sync_enabled: business?.google_calendar_sync_enabled || false,
    last_synced: business?.google_calendar_last_synced_at,
    pending_syncs: pendingSync || 0,
  });
}

// Helper to map appointment status to Google Calendar colors
function getColorForStatus(status: string): string {
  switch (status) {
    case 'confirmed': return '2'; // Green
    case 'completed': return '10'; // Dark green
    case 'cancelled': return '4'; // Red
    case 'no_show': return '11'; // Orange
    default: return '7'; // Blue
  }
}
