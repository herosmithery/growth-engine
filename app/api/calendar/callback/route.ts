import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || 'dummy_client_id',
    process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret',
    process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/callback` : 'http://localhost:3000/api/calendar/callback'
);

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    // If user denied access
    if (errorParam) {
        return NextResponse.redirect(new URL('/settings?error=calendar_access_denied', req.url));
    }

    if (!code || !state) {
        return NextResponse.redirect(new URL('/settings?error=invalid_request', req.url));
    }

    try {
        // 1. Decode state
        const stateObjStr = Buffer.from(state, 'base64').toString('utf-8');
        const stateObj = JSON.parse(stateObjStr);
        const { userId, businessId } = stateObj;

        // Create Supabase Admin client
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 2. Verify user has access to this business
        let hasAccess = false;

        // Check direct owner
        const { data: ownedBiz } = await supabase
            .from('businesses')
            .select('id')
            .eq('id', businessId)
            .eq('owner_id', userId)
            .single();

        if (ownedBiz) {
            hasAccess = true;
        } else {
            // Check junction
            const { data: linkedBiz } = await supabase
                .from('user_businesses')
                .select('business_id')
                .eq('user_id', userId)
                .eq('business_id', businessId)
                .single();

            if (linkedBiz) hasAccess = true;
        }

        if (!hasAccess) {
            return NextResponse.redirect(new URL('/settings?error=unauthorized_business', req.url));
        }

        // 3. Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);

        // Set credentials so we can make an API call to get the calendar email
        oauth2Client.setCredentials(tokens);
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        // Get the primary calendar ID (usually the user's email)
        const primaryCal = await calendar.calendars.get({ calendarId: 'primary' });
        const googleCalendarId = primaryCal.data?.id;

        // 4. Save to Supabase
        const updatePayload = {
            google_calendar_tokens: tokens, // JSONB
            google_calendar_connected: true,
            google_calendar_id: googleCalendarId,
            google_calendar_sync_enabled: true,
            updated_at: new Date().toISOString()
        };

        const { error: updateError } = await supabase
            .from('businesses')
            .update(updatePayload)
            .eq('id', businessId);

        if (updateError) {
            console.error('Failed to update business with calendar tokens:', updateError);
            return NextResponse.redirect(new URL('/settings?error=database_error', req.url));
        }

        // Success! Redirect back.
        return NextResponse.redirect(new URL('/settings?success=calendar_connected', req.url));

    } catch (err) {
        console.error('Calendar OAuth Error:', err);
        return NextResponse.redirect(new URL('/settings?error=internal_error', req.url));
    }
}
