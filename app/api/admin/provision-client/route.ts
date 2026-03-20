import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role client — bypasses RLS for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40);
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      businessName,
      ownerEmail,
      ownerPhone,
      crmType,
      timezone,
      nicheType,
      primaryColor,
      secondaryColor,
      mrr,
      subscriptionTier,
    } = body;

    if (!businessName || !ownerEmail) {
      return NextResponse.json({ error: 'businessName and ownerEmail are required' }, { status: 400 });
    }

    // Generate slug, ensure uniqueness
    let slug = generateSlug(businessName);
    const { data: existing } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('slug', slug)
      .single();
    if (existing) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    const tempPassword = generatePassword();

    // 1. Create the Supabase auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: ownerEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        role: 'client',
        business_name: businessName,
      },
    });

    if (authError) {
      return NextResponse.json({ error: `Auth error: ${authError.message}` }, { status: 400 });
    }

    const userId = authData.user.id;

    // 2. Create the business record
    const { data: business, error: bizError } = await supabaseAdmin
      .from('businesses')
      .insert({
        name: businessName,
        email: ownerEmail,
        phone: ownerPhone || null,
        crm_type: crmType || 'manual',
        timezone: timezone || 'America/New_York',
        niche_type: nicheType || 'general',
        owner_id: userId,
        slug,
        primary_color: primaryColor || '#7c3aed',
        secondary_color: secondaryColor || '#a78bfa',
        mrr: parseFloat(mrr) || 0,
        subscription_tier: subscriptionTier || 'starter',
        subscription_status: 'active',
        status: 'active',
      })
      .select()
      .single();

    if (bizError) {
      // Rollback: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: `Business error: ${bizError.message}` }, { status: 400 });
    }

    // 3. Link user to business via junction table
    await supabaseAdmin.from('user_businesses').insert({
      user_id: userId,
      business_id: business.id,
      role: 'owner',
    });

    // 4. Update user metadata with business_id
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        role: 'client',
        business_id: business.id,
        business_name: businessName,
        niche_type: nicheType || 'general',
      },
    });

    // 5. Create subscription record
    await supabaseAdmin.from('subscriptions').insert({
      business_id: business.id,
      plan_tier: subscriptionTier || 'starter',
      status: 'active',
      mrr: parseFloat(mrr) || 0,
    });

    return NextResponse.json({
      success: true,
      businessId: business.id,
      slug,
      email: ownerEmail,
      tempPassword,
      portalUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      loginUrl: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
    });

  } catch (err) {
    console.error('Provision client error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
