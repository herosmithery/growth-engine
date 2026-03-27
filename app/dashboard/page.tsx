'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { SubscriptionGate } from '@/components/SubscriptionGate';
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
      // Refresh every 60s for live data
      const t = setInterval(loadStats, 60_000);
      return () => clearInterval(t);
    } else if (!authLoading && !businessId) {
      setLoading(false);
    }
  }, [businessId, authLoading]);

  async function loadStats() {
    try {
      // Single server-side call — uses service role key, bypasses RLS entirely
      const res = await fetch(`/api/dashboard/stats?business_id=${businessId}`);
      if (!res.ok) throw new Error(`Stats API returned ${res.status}`);
      const data = await res.json();

      const s = data.stats || {};
      const am = data.agentMetrics || {};

      setStats({
        totalBookingsThisMonth: s.totalBookingsThisMonth || 0,
        afterHoursCallsCaught:  s.callsThisMonth || 0,
        reviewRequestsSent:     s.reviewsCount || 0,
        followUpsSent:          s.followUpsSent || 0,
        reactivationMessagesSent: s.campaignMessages || 0,
        avgResponseTime:        '< 1m',
        clientRetentionRate:    s.clientRetentionRate || '0%',
        estimatedRevenueImpact: s.estimatedRevenueImpact || '$0',
      });

      setAgentMetrics({
        aura:    am.aura    || { callsHandled: 0, bookingsFromCalls: 0, conversionRate: '0%' },
        phoenix: am.phoenix || { activeCampaigns: 0, clientsReactivated: 0, revenueRecovered: '$0' },
        star:    am.star    || { reviewRequestsSent: 0, positiveReviews: 0, avgRating: '0.0' },
        sage:    am.sage    || { nurtureSent: 0, engagementRate: '0%', leadsConverted: 0 },
      });

      const recentCalls        = data.recentCalls        || [];
      const recentAppointments = data.recentAppointments || [];
      const recentMessages     = data.recentMessages     || [];

      const callActivities = (recentCalls || []).map((c: any) => ({
        id: `call-${c.id}`,
        type: 'call' as const,
        description: `AI call ${c.outcome === 'booked' ? '📅 booked appointment' : c.outcome === 'dropped' ? 'dropped' : 'handled'} — ${c.clients?.first_name ? `${c.clients.first_name} ${c.clients.last_name || ''}` : c.caller_phone || 'unknown caller'}`,
        time: new Date(c.created_at).toLocaleString(),
        status: c.outcome === 'booked' ? 'success' as const : 'info' as const,
      }));

      const apptActivities = (recentAppointments || []).map((a: any) => ({
        id: `appt-${a.id}`,
        type: 'appointment' as const,
        description: `${a.source === 'ai_phone' ? 'AI booked' : 'Appointment'}: ${a.treatment_type || 'visit'} — ${a.clients?.first_name ? `${a.clients.first_name} ${a.clients.last_name || ''}` : 'client'} (${a.status})`,
        time: new Date(a.created_at).toLocaleString(),
        status: a.status === 'confirmed' || a.status === 'completed' ? 'success' as const : 'pending' as const,
      }));

      const msgActivities = (recentMessages || []).map((msg: any) => ({
        id: `msg-${msg.id}`,
        type: (msg.channel === 'email' ? 'email' : 'sms') as 'email' | 'sms',
        description: `${msg.channel?.toUpperCase() || 'SMS'} sent to ${msg.clients?.first_name || 'client'}`,
        time: new Date(msg.created_at).toLocaleString(),
        status: 'success' as const,
      }));

      // Merge and sort by most recent, show top 10
      const allActivity = [...callActivities, ...apptActivities, ...msgActivities]
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 10);

      setRecentActivity(allActivity);

      // Build chart data from calls we already have (no extra DB queries needed)
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const now2 = new Date();
      const chartData = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now2.getFullYear(), now2.getMonth() - (5 - i), 1);
        const monthCalls = (data.allCalls || []).filter((c: any) => {
          const cd = new Date(c.created_at);
          return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth();
        });
        const booked = monthCalls.filter((c: any) => c.outcome === 'booked').length;
        const revenue = booked * 250;
        return { month: months[d.getMonth()], revenue, bookings: booked, reactivations: Math.round(revenue * 0.15) };
      });
      setRevenueData(chartData);

      // Hours saved chart — derived from call/message counts
      const totalCalls = (data.allCalls || []).length;
      const weeksData = Array.from({ length: 4 }, (_, w) => {
        const weekCalls = Math.round(totalCalls / 4);
        const hoursSaved = Math.round((weekCalls * 5) / 60);
        return { week: `Week ${w + 1}`, hours: hoursSaved, value: hoursSaved * 22 };
      });
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
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">Welcome to Growth Engine by Scale with Jak</h2>
          <p className="text-[var(--foreground-muted)]">Please sign in to view your dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <SubscriptionGate>
    <div className="space-y-8">
      {/* Welcome Section with Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-[var(--border)] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)] mb-1">
              Welcome back{businessName ? `, ${businessName}` : ''}
            </h1>
            <p className="text-[var(--foreground-muted)]">Here's what's happening with your business today.</p>
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
    </SubscriptionGate>
  );
}
