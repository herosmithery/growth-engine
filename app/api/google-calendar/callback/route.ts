import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/google-calendar/callback`
  );
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // business_id
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=integrations&error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=integrations&error=missing_params`
    );
  }

  try {
    const oauth2Client = getOAuth2Client();
    const supabase = getSupabase();

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    // Set credentials to get calendar info
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Get primary calendar ID
    const calendarList = await calendar.calendarList.get({
      calendarId: 'primary',
    });

    const calendarId = calendarList.data.id || 'primary';

    // Store tokens in database (encrypted in production)
    const { error: updateError } = await supabase
      .from('businesses')
      .update({
        google_calendar_tokens: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: tokens.expiry_date,
          token_type: tokens.token_type,
          scope: tokens.scope,
        },
        google_calendar_connected: true,
        google_calendar_id: calendarId,
        google_calendar_sync_enabled: true,
      })
      .eq('id', state);

    if (updateError) {
      console.error('Database update error:', updateError);
      throw new Error('Failed to save calendar connection');
    }

    // Redirect back to settings with success
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=integrations&google_connected=true`
    );

  } catch (err) {
    console.error('Google Calendar callback error:', err);
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=integrations&error=${encodeURIComponent(
        err instanceof Error ? err.message : 'Failed to connect Google Calendar'
      )}`
    );
  }
}
