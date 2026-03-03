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

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const supabase = getSupabase();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  // Log the event
  const businessId = (event.data.object as any).metadata?.business_id;
  await supabase.from('stripe_events').insert({
    stripe_event_id: event.id,
    event_type: event.type,
    business_id: businessId || null,
    payload: event.data.object,
  });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;
        const plan = session.metadata?.plan;
        const bizId = session.metadata?.business_id;

        if (bizId && subscriptionId) {
          // Get subscription details
          const subscriptionData = await stripe.subscriptions.retrieve(subscriptionId) as any;
          const periodEnd = subscriptionData.current_period_end
            || Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // Default to 30 days from now

          await supabase
            .from('businesses')
            .update({
              subscription_status: 'active',
              subscription_plan: plan,
              stripe_subscription_id: subscriptionId,
              stripe_customer_id: customerId,
              subscription_started_at: new Date().toISOString(),
              subscription_current_period_end: new Date(periodEnd * 1000).toISOString(),
            })
            .eq('id', bizId);

          // Log subscription history
          await supabase.from('subscription_history').insert({
            business_id: bizId,
            event_type: 'created',
            to_plan: plan,
            stripe_subscription_id: subscriptionId,
            amount_cents: session.amount_total,
            metadata: { checkout_session_id: session.id },
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        const bizId = subscription.metadata?.business_id;

        if (bizId) {
          const status = subscription.status === 'active' ? 'active' :
                         subscription.status === 'past_due' ? 'past_due' :
                         subscription.status === 'canceled' ? 'cancelled' : 'trial';

          const periodEnd = subscription.current_period_end
            || Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

          await supabase
            .from('businesses')
            .update({
              subscription_status: status,
              subscription_current_period_end: new Date(periodEnd * 1000).toISOString(),
            })
            .eq('id', bizId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const bizId = subscription.metadata?.business_id;

        if (bizId) {
          // Get current plan before cancellation
          const { data: business } = await supabase
            .from('businesses')
            .select('subscription_plan')
            .eq('id', bizId)
            .single();

          await supabase
            .from('businesses')
            .update({
              subscription_status: 'cancelled',
              stripe_subscription_id: null,
            })
            .eq('id', bizId);

          // Log cancellation
          await supabase.from('subscription_history').insert({
            business_id: bizId,
            event_type: 'cancelled',
            from_plan: business?.subscription_plan,
            stripe_subscription_id: subscription.id,
          });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
          const bizId = subscription.metadata?.business_id;
          const periodEnd = subscription.current_period_end
            || Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

          if (bizId) {
            await supabase
              .from('businesses')
              .update({
                subscription_status: 'active',
                subscription_current_period_end: new Date(periodEnd * 1000).toISOString(),
              })
              .eq('id', bizId);

            // Log renewal
            await supabase.from('subscription_history').insert({
              business_id: bizId,
              event_type: 'renewed',
              stripe_subscription_id: subscriptionId,
              amount_cents: invoice.amount_paid,
            });
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
          const bizId = subscription.metadata?.business_id;

          if (bizId) {
            await supabase
              .from('businesses')
              .update({
                subscription_status: 'past_due',
              })
              .eq('id', bizId);

            // Log payment failure
            await supabase.from('subscription_history').insert({
              business_id: bizId,
              event_type: 'payment_failed',
              stripe_subscription_id: subscriptionId,
              metadata: {
                attempt_count: invoice.attempt_count,
                next_attempt: invoice.next_payment_attempt,
              },
            });

            // TODO: Send notification email to business owner
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

