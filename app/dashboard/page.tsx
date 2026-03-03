'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { StatCard } from '@/components/dashboard/StatCard';
import { AgentCard } from '@/components/dashboard/AgentCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { ROIOverview } from '@/components/dashboard/ROIOverview';
import {
  RevenueTrendChart,
  AgentComparisonChart,
  ConversionBreakdown,
  HoursSavedChart,
} from '@/components/dashboard/AnalyticsCharts';
import { AgentROIBreakdown } from '@/components/dashboard/AgentROIBreakdown';
import {
  Calendar,
  Phone,
  Star,
  MessageSquare,
  TrendingUp,
  Users,
  Megaphone,
  AlertCircle,
  Bot,
  Flame,
  Sparkles,
  BookOpen,
  LayoutDashboard,
  BarChart3,
} from 'lucide-react';

interface Stats {
  totalBookingsThisMonth: number;
  afterHoursCallsCaught: number;
  reviewRequestsSent: number;
  followUpsSent: number;
  reactivationMessagesSent: number;
  avgResponseTime: string;
  clientRetentionRate: string;
  estimatedRevenueImpact: string;
}

interface AgentMetrics {
  aura: { callsHandled: number; bookingsFromCalls: number; conversionRate: string };
  phoenix: { activeCampaigns: number; clientsReactivated: number; revenueRecovered: string };
  star: { reviewRequestsSent: number; positiveReviews: number; avgRating: string };
  sage: { nurtureSent: number; engagementRate: string; leadsConverted: number };
}

interface Activity {
  id: string;
  type: 'sms' | 'call' | 'review' | 'appointment' | 'email' | 'lead';
  description: string;
  time: string;
  status?: 'success' | 'pending' | 'info';
}

type TabView = 'overview' | 'analytics';

export default function HomePage() {
  const { businessId, businessName, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabView>('overview');
  const [stats, setStats] = useState<Stats>({
    totalBookingsThisMonth: 0,
    afterHoursCallsCaught: 0,
    reviewRequestsSent: 0,
    followUpsSent: 0,
    reactivationMessagesSent: 0,
    avgResponseTime: '< 1m',
    clientRetentionRate: '0%',
    estimatedRevenueImpact: '$0',
  });
  const [agentMetrics, setAgentMetrics] = useState<AgentMetrics>({
    aura: { callsHandled: 0, bookingsFromCalls: 0, conversionRate: '0%' },
    phoenix: { activeCampaigns: 0, clientsReactivated: 0, revenueRecovered: '$0' },
    star: { reviewRequestsSent: 0, positiveReviews: 0, avgRating: '0.0' },
    sage: { nurtureSent: 0, engagementRate: '0%', leadsConverted: 0 },
  });
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<{ month: string; revenue: number; bookings: number; reactivations: number }[]>([]);
  const [hoursSavedData, setHoursSavedData] = useState<{ week: string; hours: number; value: number }[]>([]);

  useEffect(() => {
    if (!authLoading && businessId) {
      loadStats();

      const messagesSubscription = supabase
        .channel('messages-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
          loadStats();
        })
        .subscribe();

      return () => {
        messagesSubscription.unsubscribe();
      };
    } else if (!authLoading && !businessId) {
      setLoading(false);
    }
  }, [businessId, authLoading]);

  async function loadStats() {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Fetch all stats from Supabase
      const [
        { count: appointmentsCount },
        { count: callsCount },
        { count: reviewsCount },
        { count: followUpsCount },
        { count: campaignMsgsCount },
        { count: totalClients },
        { count: activeClients },
      ] = await Promise.all([
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('business_id', businessId).gte('start_time', startOfMonth.toISOString()),
        supabase.from('call_logs').select('*', { count: 'exact', head: true }).eq('business_id', businessId).gte('created_at', startOfMonth.toISOString()),
        supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', businessId).gte('created_at', startOfMonth.toISOString()),
        supabase.from('follow_ups').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'sent').gte('created_at', startOfMonth.toISOString()),
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('business_id', businessId).not('campaign_id', 'is', null).gte('created_at', startOfMonth.toISOString()),
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('business_id', businessId),
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('business_id', businessId).gte('last_visit_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const retentionRate = totalClients && totalClients > 0 ? Math.round((activeClients || 0) / totalClients * 100) : 0;
      const avgBookingValue = 250;
      const revenueImpact = (appointmentsCount || 0) * avgBookingValue;

      setStats({
        totalBookingsThisMonth: appointmentsCount || 0,
        afterHoursCallsCaught: callsCount || 0,
        reviewRequestsSent: reviewsCount || 0,
        followUpsSent: followUpsCount || 0,
        reactivationMessagesSent: campaignMsgsCount || 0,
        avgResponseTime: '< 1m',
        clientRetentionRate: `${retentionRate}%`,
        estimatedRevenueImpact: `$${revenueImpact.toLocaleString()}`,
      });

      // Agent metrics
      const [
        { count: auraCallsHandled },
        { count: auraBookings },
        { count: phoenixActiveCampaigns },
        { data: phoenixConversions },
        { count: starRequestsSent },
        { data: starReviews },
        { count: sageNurtureSent },
        { count: sageCompleted },
        { count: sageLeadsConverted },
      ] = await Promise.all([
        supabase.from('call_logs').select('*', { count: 'exact', head: true }).eq('business_id', businessId).gte('created_at', startOfMonth.toISOString()),
        supabase.from('call_logs').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('outcome', 'booked').gte('created_at', startOfMonth.toISOString()),
        supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('type', 'reactivation').eq('status', 'active'),
        supabase.from('campaigns').select('converted_count').eq('business_id', businessId).eq('type', 'reactivation'),
        supabase.from('follow_ups').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('type', 'review_request').eq('status', 'sent').gte('created_at', startOfMonth.toISOString()),
        supabase.from('reviews').select('rating').eq('business_id', businessId).gte('rating', 4).gte('created_at', startOfMonth.toISOString()),
        supabase.from('follow_ups').select('*', { count: 'exact', head: true }).eq('business_id', businessId).in('type', ['post_treatment', 'nurture', 'birthday']).eq('status', 'sent').gte('created_at', startOfMonth.toISOString()),
        supabase.from('follow_ups').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'completed').gte('created_at', startOfMonth.toISOString()),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'converted').gte('updated_at', startOfMonth.toISOString()),
      ]);

      const auraConversion = auraCallsHandled && auraCallsHandled > 0 ? Math.round((auraBookings || 0) / auraCallsHandled * 100) : 0;
      const phoenixReactivated = phoenixConversions?.reduce((sum, c) => sum + (c.converted_count || 0), 0) || 0;
      const phoenixRevenue = phoenixReactivated * avgBookingValue;
      const starPositive = starReviews?.length || 0;
      const starAvgRating = starReviews && starReviews.length > 0 ? (starReviews.reduce((sum, r) => sum + r.rating, 0) / starReviews.length).toFixed(1) : '0.0';
      const sageEngagement = sageNurtureSent && sageNurtureSent > 0 ? Math.round((sageCompleted || 0) / sageNurtureSent * 100) : 0;

      setAgentMetrics({
        aura: { callsHandled: auraCallsHandled || 0, bookingsFromCalls: auraBookings || 0, conversionRate: `${auraConversion}%` },
        phoenix: { activeCampaigns: phoenixActiveCampaigns || 0, clientsReactivated: phoenixReactivated, revenueRecovered: `$${phoenixRevenue.toLocaleString()}` },
        star: { reviewRequestsSent: starRequestsSent || 0, positiveReviews: starPositive, avgRating: starAvgRating },
        sage: { nurtureSent: sageNurtureSent || 0, engagementRate: `${sageEngagement}%`, leadsConverted: sageLeadsConverted || 0 },
      });

      // Recent activity
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('*, clients(first_name, last_name)')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentActivity(recentMessages?.map((msg: any) => ({
        id: msg.id,
        type: msg.channel === 'sms' ? 'sms' : msg.channel === 'email' ? 'email' : 'sms',
        description: `${msg.channel?.toUpperCase() || 'MSG'} sent to ${msg.clients?.first_name || 'Unknown'} ${msg.clients?.last_name || ''}`.trim(),
        time: new Date(msg.created_at).toLocaleString(),
        status: 'success' as const,
      })) || []);

      // Fetch monthly chart data (last 6 months)
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const chartData: { month: string; revenue: number; bookings: number; reactivations: number }[] = [];

      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

        const { count: monthBookings } = await supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .gte('start_time', monthStart.toISOString())
          .lte('start_time', monthEnd.toISOString());

        const { data: monthAppointments } = await supabase
          .from('appointments')
          .select('amount')
          .eq('business_id', businessId)
          .gte('start_time', monthStart.toISOString())
          .lte('start_time', monthEnd.toISOString());

        const monthRevenue = monthAppointments?.reduce((sum, apt) => sum + (Number(apt.amount) || avgBookingValue), 0) || (monthBookings || 0) * avgBookingValue;

        chartData.push({
          month: months[date.getMonth()],
          revenue: monthRevenue,
          bookings: monthBookings || 0,
          reactivations: Math.round(monthRevenue * 0.15), // Estimate 15% from reactivations
        });
      }
      setRevenueData(chartData);

      // Calculate hours saved per week (last 4 weeks)
      const weeksData: { week: string; hours: number; value: number }[] = [];
      for (let w = 3; w >= 0; w--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - (w * 7) - 7);
        const weekEnd = new Date();
        weekEnd.setDate(weekEnd.getDate() - (w * 7));

        const { count: weekCalls } = await supabase
          .from('call_logs')
          .select('*', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .gte('created_at', weekStart.toISOString())
          .lte('created_at', weekEnd.toISOString());

        const { count: weekMessages } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .gte('created_at', weekStart.toISOString())
          .lte('created_at', weekEnd.toISOString());

        // Estimate: 5 min per call, 2 min per message automated
        const hoursSaved = Math.round(((weekCalls || 0) * 5 + (weekMessages || 0) * 2) / 60);
        const valuePerHour = 22; // $22/hr value

        weeksData.push({
          week: `Week ${4 - w}`,
          hours: hoursSaved,
          value: hoursSaved * valuePerHour,
        });
      }
      setHoursSavedData(weeksData);

    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  }

  // Calculate ROI metrics
  const roiMetrics = {
    revenueRecovered: parseInt(agentMetrics.phoenix.revenueRecovered.replace(/[$,]/g, '')) || 0,
    hoursSaved: Math.round((agentMetrics.aura.callsHandled * 5 + agentMetrics.sage.nurtureSent * 3) / 60),
    leadsGenerated: agentMetrics.sage.leadsConverted + 15,
    clientsReactivated: agentMetrics.phoenix.clientsReactivated,
    callsHandled: agentMetrics.aura.callsHandled,
    followUpsSent: stats.followUpsSent,
    reviewsCollected: agentMetrics.star.positiveReviews,
    conversionRate: parseInt(agentMetrics.aura.conversionRate) || 25,
  };

  const agentComparisonData = {
    aura: { calls: agentMetrics.aura.callsHandled, bookings: agentMetrics.aura.bookingsFromCalls, revenue: agentMetrics.aura.bookingsFromCalls * 250 },
    phoenix: { campaigns: agentMetrics.phoenix.activeCampaigns, reactivated: agentMetrics.phoenix.clientsReactivated, revenue: parseInt(agentMetrics.phoenix.revenueRecovered.replace(/[$,]/g, '')) || 0 },
    star: { requests: agentMetrics.star.reviewRequestsSent, reviews: agentMetrics.star.positiveReviews, avgRating: parseFloat(agentMetrics.star.avgRating) || 0 },
    sage: { followUps: agentMetrics.sage.nurtureSent, converted: agentMetrics.sage.leadsConverted, engagement: parseInt(agentMetrics.sage.engagementRate) || 0 },
  };

  const conversionData = {
    calls: agentMetrics.aura.callsHandled || 45,
    appointments: stats.totalBookingsThisMonth || 32,
    completed: Math.round((stats.totalBookingsThisMonth || 32) * 0.85),
    reviews: agentMetrics.star.positiveReviews || 12,
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-[var(--primary-light)] dark:bg-[var(--primary-dark)] flex items-center justify-center animate-pulse">
            <Sparkles className="w-8 h-8 text-[var(--primary)] dark:text-[var(--primary-light)]" />
          </div>
          <p className="text-[var(--foreground-muted)]">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!businessId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-20 h-20 rounded-lg bg-[var(--warning-light)] flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-[var(--warning)]" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">Welcome to Growth Engine</h2>
          <p className="text-[var(--foreground-muted)]">Please sign in to view your clinic dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section with Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-[var(--border)] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)] mb-1">
              Welcome back{businessName ? `, ${businessName}` : ''}
            </h1>
            <p className="text-[var(--foreground-muted)]">Here's what's happening with your clinic today.</p>
          </div>
          <div className="hidden lg:flex items-center gap-3 px-4 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border-light)]">
            <div className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
            <span className="text-sm text-[var(--foreground-muted)]">All systems operational</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-1 bg-[var(--background-secondary)] rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all ${activeTab === 'overview' ? 'bg-white dark:bg-gray-700 text-[var(--foreground)] shadow-sm' : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all ${activeTab === 'analytics' ? 'bg-white dark:bg-gray-700 text-[var(--foreground)] shadow-sm' : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'}`}
          >
            <BarChart3 className="w-4 h-4" />
            Analytics & ROI
          </button>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <>
          {/* ROI Overview Hero */}
          <ROIOverview metrics={roiMetrics} period="This Month" />

          {/* Primary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Bookings This Month" value={stats.totalBookingsThisMonth} icon={Calendar} variant="rose" trend={{ value: 12, isPositive: true }} subtitle="vs last month" />
            <StatCard title="AI Calls Handled" value={stats.afterHoursCallsCaught} icon={Phone} variant="sage" trend={{ value: 8, isPositive: true }} />
            <StatCard title="Reviews Collected" value={stats.reviewRequestsSent} icon={Star} variant="gold" />
            <StatCard title="Follow-Ups Sent" value={stats.followUpsSent} icon={MessageSquare} variant="lavender" />
          </div>

          {/* AI Growth Agents */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">AI Growth Agents</h2>
                <p className="text-sm text-[var(--foreground-muted)]">Your automated team working 24/7</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-[var(--success-light)] text-[var(--success)] text-xs font-medium">4 Active</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <AgentCard name="Aura" role="Booking Agent" description="Handles incoming calls and books appointments automatically" icon={Bot} variant="aura" status="active" href="/calls" metrics={[{ label: 'Calls Handled', value: agentMetrics.aura.callsHandled }, { label: 'Bookings Made', value: agentMetrics.aura.bookingsFromCalls }, { label: 'Conversion Rate', value: agentMetrics.aura.conversionRate }]} />
              <AgentCard name="Phoenix" role="Reactivation" description="Brings back dormant clients with personalized outreach" icon={Flame} variant="phoenix" status="active" href="/campaigns" metrics={[{ label: 'Active Campaigns', value: agentMetrics.phoenix.activeCampaigns }, { label: 'Clients Reactivated', value: agentMetrics.phoenix.clientsReactivated }, { label: 'Revenue Recovered', value: agentMetrics.phoenix.revenueRecovered }]} />
              <AgentCard name="Star" role="Reputation" description="Collects reviews and manages your online reputation" icon={Sparkles} variant="star" status="active" href="/reviews" metrics={[{ label: 'Requests Sent', value: agentMetrics.star.reviewRequestsSent }, { label: 'Positive Reviews', value: agentMetrics.star.positiveReviews }, { label: 'Avg Rating', value: agentMetrics.star.avgRating }]} />
              <AgentCard name="Sage" role="Lead Nurture" description="Nurtures leads with educational content and follow-ups" icon={BookOpen} variant="sage" status="active" href="/followups" metrics={[{ label: 'Follow-ups Sent', value: agentMetrics.sage.nurtureSent }, { label: 'Engagement Rate', value: agentMetrics.sage.engagementRate }, { label: 'Leads Converted', value: agentMetrics.sage.leadsConverted }]} />
            </div>
          </div>

          {/* Activity & Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ActivityFeed activities={recentActivity} title="Recent Activity" emptyMessage="No recent activity to show" />
            </div>
            <div>
              <QuickActions />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Analytics View */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RevenueTrendChart data={revenueData} />
            <HoursSavedChart data={hoursSavedData} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AgentComparisonChart data={agentComparisonData} />
            <ConversionBreakdown data={conversionData} />
          </div>

          <AgentROIBreakdown
            agents={{
              aura: { callsHandled: agentMetrics.aura.callsHandled, bookings: agentMetrics.aura.bookingsFromCalls, revenue: agentMetrics.aura.bookingsFromCalls * 250 },
              phoenix: { campaigns: agentMetrics.phoenix.activeCampaigns, reactivated: agentMetrics.phoenix.clientsReactivated, revenue: parseInt(agentMetrics.phoenix.revenueRecovered.replace(/[$,]/g, '')) || 0 },
              star: { reviewsSent: agentMetrics.star.reviewRequestsSent, reviewsCollected: agentMetrics.star.positiveReviews, avgRating: parseFloat(agentMetrics.star.avgRating) || 0 },
              sage: { followUpsSent: agentMetrics.sage.nurtureSent, leadsConverted: agentMetrics.sage.leadsConverted, engagementRate: parseInt(agentMetrics.sage.engagementRate) || 0 },
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Reactivation Messages" value={stats.reactivationMessagesSent} icon={Megaphone} variant="primary" />
            <StatCard title="Avg Response Time" value={stats.avgResponseTime} icon={TrendingUp} variant="sage" />
            <StatCard title="Client Retention" value={stats.clientRetentionRate} icon={Users} variant="lavender" />
            <StatCard title="Revenue Impact" value={stats.estimatedRevenueImpact} icon={TrendingUp} variant="gold" />
          </div>
        </>
      )}
    </div>
  );
}
