import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role — bypasses RLS entirely
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get('business_id');

  if (!businessId || businessId === 'null' || businessId === 'undefined') {
    return NextResponse.json({ error: 'valid business_id required' }, { status: 400 });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  try {
    const [
      { data: allCalls, count: callsCount },
      { count: bookedCount },
      { count: appointmentsThisMonth },
      { data: recentAppointments },
      { count: reviewsCount },
      { count: followUpsSentCount },
      { count: campaignMsgsCount },
      { count: totalClients },
      { count: activeClients },
      { count: phoenixActiveCampaigns },
      { data: phoenixConversions },
      { data: starReviews },
      { count: sageNurtureSent },
      { count: sageCompleted },
      { count: sageLeadsConverted },
      { data: recentMessages },
    ] = await Promise.all([
      // All calls (last 50 for the calls page)
      supabase.from('call_logs')
        .select('id, vapi_call_id, caller_phone, caller_name, outcome, duration_seconds, summary, transcript, recording_url, created_at', { count: 'exact' })
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(50),

      // Booked calls this month
      supabase.from('call_logs')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('outcome', 'booked')
        .gte('created_at', startOfMonth.toISOString()),

      // Appointments this month
      supabase.from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .gte('created_at', startOfMonth.toISOString()),

      // Recent appointments
      supabase.from('appointments')
        .select('id, treatment_type, start_time, status, source, created_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(10),

      // Reviews this month
      supabase.from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .gte('created_at', startOfMonth.toISOString()),

      // Follow-ups sent this month
      supabase.from('follow_ups')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('status', 'sent')
        .gte('created_at', startOfMonth.toISOString()),

      // Campaign messages this month
      supabase.from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .not('campaign_id', 'is', null)
        .gte('created_at', startOfMonth.toISOString()),

      // Total clients
      supabase.from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId),

      // Active clients (visited in last 90 days)
      supabase.from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .gte('created_at', ninetyDaysAgo.toISOString()),

      // Phoenix: active reactivation campaigns
      supabase.from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('type', 'reactivation')
        .eq('status', 'active'),

      // Phoenix: reactivation conversions
      supabase.from('campaigns')
        .select('converted_count')
        .eq('business_id', businessId)
        .eq('type', 'reactivation'),

      // Star: positive reviews this month
      supabase.from('reviews')
        .select('rating')
        .eq('business_id', businessId)
        .gte('rating', 4)
        .gte('created_at', startOfMonth.toISOString()),

      // Sage: nurture follow-ups sent
      supabase.from('follow_ups')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .in('type', ['post_treatment', 'nurture', 'birthday'])
        .eq('status', 'sent')
        .gte('created_at', startOfMonth.toISOString()),

      // Sage: completed follow-ups
      supabase.from('follow_ups')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('status', 'completed')
        .gte('created_at', startOfMonth.toISOString()),

      // Sage: converted leads
      supabase.from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('status', 'converted')
        .gte('updated_at', startOfMonth.toISOString()),

      // Recent messages for activity feed
      supabase.from('messages')
        .select('id, channel, created_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const totalCallsThisMonth = callsCount || 0;
    const bookedThisMonth = bookedCount || 0;
    const avgBookingValue = 250;

    const phoenixReactivated = (phoenixConversions || []).reduce((s, c) => s + (c.converted_count || 0), 0);
    const starPositive = (starReviews || []).length;
    const starAvgRating = starPositive > 0
      ? ((starReviews || []).reduce((s, r) => s + (r.rating || 0), 0) / starPositive).toFixed(1)
      : '0.0';
    const auraConversion = totalCallsThisMonth > 0 ? Math.round(bookedThisMonth / totalCallsThisMonth * 100) : 0;
    const sageEngagement = (sageNurtureSent || 0) > 0 ? Math.round((sageCompleted || 0) / (sageNurtureSent || 1) * 100) : 0;
    const retentionRate = (totalClients || 0) > 0 ? Math.round((activeClients || 0) / (totalClients || 1) * 100) : 0;

    return NextResponse.json({
      stats: {
        totalBookingsThisMonth: appointmentsThisMonth || 0,
        callsThisMonth: totalCallsThisMonth,
        bookedThisMonth,
        reviewsCount: reviewsCount || 0,
        followUpsSent: followUpsSentCount || 0,
        campaignMessages: campaignMsgsCount || 0,
        clientRetentionRate: `${retentionRate}%`,
        estimatedRevenueImpact: `$${((appointmentsThisMonth || 0) * avgBookingValue).toLocaleString()}`,
      },
      agentMetrics: {
        aura: {
          callsHandled: totalCallsThisMonth,
          bookingsFromCalls: bookedThisMonth,
          conversionRate: `${auraConversion}%`,
        },
        phoenix: {
          activeCampaigns: phoenixActiveCampaigns || 0,
          clientsReactivated: phoenixReactivated,
          revenueRecovered: `$${(phoenixReactivated * avgBookingValue).toLocaleString()}`,
        },
        star: {
          reviewRequestsSent: reviewsCount || 0,
          positiveReviews: starPositive,
          avgRating: starAvgRating,
        },
        sage: {
          nurtureSent: sageNurtureSent || 0,
          engagementRate: `${sageEngagement}%`,
          leadsConverted: sageLeadsConverted || 0,
        },
      },
      recentCalls: (allCalls || []).slice(0, 10),
      allCalls: allCalls || [],
      recentAppointments: recentAppointments || [],
      recentMessages: recentMessages || [],
    });
  } catch (error: any) {
    console.error('[dashboard/stats]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
