import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || 'dummy_client_id',
    process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret',
    process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/callback` : 'http://localhost:3000/api/calendar/callback'
);

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');
    const userId = searchParams.get('userId');

    if (!businessId || !userId) {
        return NextResponse.json({ error: 'Business ID and User ID are required' }, { status: 400 });
    }

    // Generate a secure state token (we should encrypt this in production, but base64 encoding businessId + userId for now)
    const stateObj = {
        userId,
        businessId,
    };
    const state = Buffer.from(JSON.stringify(stateObj)).toString('base64');

    // Generate the OAuth URL
    const scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
    ];

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Required to get a refresh token
        prompt: 'consent', // Force prompt to ensure we always get a refresh token
        scope: scopes,
        state: state,
    });

    return NextResponse.redirect(authUrl);
}
