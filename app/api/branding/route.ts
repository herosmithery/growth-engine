import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('b');

  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('businesses')
    .select('name, logo_url, primary_color, secondary_color, slug')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    name: data.name,
    logoUrl: data.logo_url,
    primaryColor: data.primary_color || '#7c3aed',
    secondaryColor: data.secondary_color || '#a78bfa',
    slug: data.slug,
  });
}
