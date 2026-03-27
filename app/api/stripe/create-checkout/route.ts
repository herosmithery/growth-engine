import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2026-01-28.clover',
  });
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

// Price IDs for each plan (set these in your Stripe dashboard)
const PRICE_IDS = {
  starter: process.env.STRIPE_STARTER_PRICE_ID || 'price_starter',
  growth: process.env.STRIPE_GROWTH_PRICE_ID || 'price_growth',
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise',
};

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { plan, businessId, userEmail } = body;

    if (!plan || !businessId) {
      return NextResponse.json(
        { error: 'Missing required fields: plan, businessId' },
        { status: 400 }
      );
    }

    const priceId = PRICE_IDS[plan as keyof typeof PRICE_IDS];
    if (!priceId) {
      return NextResponse.json(
        { error: 'Invalid plan selected' },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    const { data: business } = await supabase
      .from('businesses')
      .select('stripe_customer_id, name, billing_email')
      .eq('id', businessId)
      .single();

    let customerId = business?.stripe_customer_id;

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: userEmail || business?.billing_email,
        name: business?.name,
        metadata: {
          business_id: businessId,
        },
      });
      customerId = customer.id;

      // Save customer ID to database
      await supabase
        .from('businesses')
        .update({ stripe_customer_id: customerId })
        .eq('id', businessId);
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings?tab=billing&success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/pricing?cancelled=true`,
      subscription_data: {
        metadata: {
          business_id: businessId,
          plan: plan,
        },
        trial_period_days: 0, // No additional trial since they already had one
      },
      metadata: {
        business_id: businessId,
        plan: plan,
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
