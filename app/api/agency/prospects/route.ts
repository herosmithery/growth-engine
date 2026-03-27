import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function sbHeaders() {
  return {
    apikey: svcKey,
    Authorization: `Bearer ${svcKey}`,
    'Content-Type': 'application/json',
  };
}

export async function GET() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/agency_prospects?select=*&order=created_at.desc`,
    { headers: sbHeaders() }
  );
  const data = await res.json();
  return NextResponse.json(data);
}
