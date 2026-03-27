'use client';

import { Bot, Flame, Sparkles, BookOpen, DollarSign, Clock, TrendingUp, Users } from 'lucide-react';

interface AgentROI {
  name: string;
  role: string;
  icon: typeof Bot;
  color: string;
  bgColor: string;
  metrics: {
    revenue: number;
    hoursSaved: number;
    actions: number;
    actionLabel: string;
  };
  highlights: string[];
}

interface AgentROIBreakdownProps {
  agents: {
    aura: {
      callsHandled: number;
      bookings: number;
      revenue: number;
    };
    phoenix: {
      campaigns: number;
      reactivated: number;
      revenue: number;
    };
    star: {
      reviewsSent: number;
      reviewsCollected: number;
      avgRating: number;
    };
    sage: {
      followUpsSent: number;
      leadsConverted: number;
      engagementRate: number;
    };
  };
}

const HOURLY_RATE = 22; // Cost per hour for manual work

export function AgentROIBreakdown({ agents }: AgentROIBreakdownProps) {
  // Calculate ROI for each agent
  const agentData: AgentROI[] = [
    {
      name: 'Aura',
      role: 'Booking Agent',
      icon: Bot,
      color: 'text-[var(--accent-rose)] dark:text-[var(--accent-rose-light)]',
      bgColor: 'bg-[var(--accent-rose-light)] dark:bg-[var(--accent-rose-dark)]',
      metrics: {
        revenue: agents.aura.revenue,
        hoursSaved: Math.round((agents.aura.callsHandled * 5) / 60), // 5 min per call
        actions: agents.aura.callsHandled,
        actionLabel: 'calls handled',
      },
      highlights: [
        `${agents.aura.bookings} appointments booked`,
        `${agents.aura.callsHandled > 0 ? Math.round((agents.aura.bookings / agents.aura.callsHandled) * 100) : 0}% conversion rate`,
        '24/7 availability',
      ],
    },
    {
      name: 'Phoenix',
      role: 'Reactivation',
      icon: Flame,
      color: 'text-[var(--accent-gold)] dark:text-[var(--accent-gold-light)]',
      bgColor: 'bg-[var(--accent-gold-light)] dark:bg-[var(--accent-gold-dark)]',
      metrics: {
        revenue: agents.phoenix.revenue,
        hoursSaved: Math.round((agents.phoenix.reactivated * 15) / 60), // 15 min per reactivation
        actions: agents.phoenix.reactivated,
        actionLabel: 'clients reactivated',
      },
      highlights: [
        `${agents.phoenix.campaigns} active campaigns`,
        `$${Math.round(agents.phoenix.revenue / Math.max(agents.phoenix.reactivated, 1))} avg per client`,
        'Automated follow-up sequences',
      ],
    },
    {
      name: 'Star',
      role: 'Reputation',
      icon: Sparkles,
      color: 'text-[var(--accent-lavender)] dark:text-[var(--accent-lavender-light)]',
      bgColor: 'bg-[var(--accent-lavender-light)] dark:bg-[var(--accent-lavender-dark)]',
      metrics: {
        revenue: agents.star.reviewsCollected * 150, // Estimated value per review
        hoursSaved: Math.round((agents.star.reviewsSent * 3) / 60), // 3 min per request
        actions: agents.star.reviewsCollected,
        actionLabel: 'reviews collected',
      },
      highlights: [
        `${agents.star.avgRating} average rating`,
        `${agents.star.reviewsSent} requests sent`,
        'Improved online presence',
      ],
    },
    {
      name: 'Sage',
      role: 'Lead Nurture',
      icon: BookOpen,
      color: 'text-[var(--accent-sage)] dark:text-[var(--accent-sage-light)]',
      bgColor: 'bg-[var(--accent-sage-light)] dark:bg-[var(--accent-sage-dark)]',
      metrics: {
        revenue: agents.sage.leadsConverted * 250, // Avg value per converted lead
        hoursSaved: Math.round((agents.sage.followUpsSent * 4) / 60), // 4 min per follow-up
        actions: agents.sage.leadsConverted,
        actionLabel: 'leads converted',
      },
      highlights: [
        `${agents.sage.followUpsSent} follow-ups sent`,
        `${agents.sage.engagementRate}% engagement rate`,
        'Educational content delivery',
      ],
    },
  ];

  const totalRevenue = agentData.reduce((sum, a) => sum + a.metrics.revenue, 0);
  const totalHours = agentData.reduce((sum, a) => sum + a.metrics.hoursSaved, 0);
  const totalLaborSavings = totalHours * HOURLY_RATE;

  const system1Agents = agentData.slice(0, 3); // Aura, Phoenix, Star
  const system2Agents = agentData.slice(3, 4); // Sage

  return (
    <div className="space-y-8">
      {/* Summary Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-[var(--border)] p-6">
        <h3 className="font-semibold text-[var(--foreground)] mb-4">Master ROI Summary - Total Revenue System</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-[var(--background-secondary)] rounded-lg">
            <DollarSign className="w-5 h-5 mx-auto mb-2 text-[var(--accent-gold)]" />
            <p className="text-2xl font-bold text-[var(--foreground)]">
              ${totalRevenue.toLocaleString()}
            </p>
            <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-wider mt-1">Revenue Captured</p>
          </div>
          <div className="text-center p-4 bg-[var(--background-secondary)] rounded-lg">
            <Clock className="w-5 h-5 mx-auto mb-2 text-[var(--accent-sage)]" />
            <p className="text-2xl font-bold text-[var(--foreground)]">
              {totalHours}h
            </p>
            <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-wider mt-1">Ops Time Saved</p>
          </div>
          <div className="text-center p-4 bg-[var(--background-secondary)] rounded-lg">
            <TrendingUp className="w-5 h-5 mx-auto mb-2 text-[var(--accent-rose)]" />
            <p className="text-2xl font-bold text-[var(--foreground)]">
              ${totalLaborSavings.toLocaleString()}
            </p>
            <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-wider mt-1">Labor Value</p>
          </div>
        </div>
      </div>

      {/* System 1 Sections */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-[var(--border)]" />
          <div className="flex flex-col items-center">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--foreground-muted)]">System 1: Growth Foundation</h4>
            <span className="text-[10px] text-[var(--success)] font-medium bg-[var(--success-light)] px-2 py-0.5 rounded-full mt-1">Basic AI Audit: Complete ✅</span>
          </div>
          <div className="h-px flex-1 bg-[var(--border)]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {system1Agents.map((agent) => renderAgentCard(agent))}
        </div>
      </div>

      {/* System 2 Sections */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-[var(--border)]" />
          <div className="flex flex-col items-center">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--foreground-muted)]">System 2: Diamond Scaling</h4>
            <span className="text-[10px] text-[var(--primary)] font-medium bg-[var(--primary-light)] px-2 py-0.5 rounded-full mt-1">Transformation Systems Audit: IN PROGRESS 🔍</span>
          </div>
          <div className="h-px flex-1 bg-[var(--border)]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {system2Agents.map((agent) => renderAgentCard(agent))}
          <div className="bg-[var(--background-secondary)] rounded-lg border border-dashed border-[var(--border)] p-6 flex flex-col items-center justify-center text-center opacity-60">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 border border-[var(--border)] flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5 text-[var(--foreground-muted)]" />
            </div>
            <h5 className="font-medium text-sm text-[var(--foreground)]">Viral Video Marketing</h5>
            <p className="text-xs text-[var(--foreground-muted)]">Direct Video-Email Integration</p>
          </div>
        </div>
      </div>

      {/* System 3 Sections */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-[var(--border)]" />
          <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--foreground-muted)]">System 3: AI Transformation Partner</h4>
          <div className="h-px flex-1 bg-[var(--border)]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-[var(--border)] p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[var(--primary-light)] dark:bg-[var(--primary-dark)] opacity-10" />
            <div className="w-10 h-10 rounded-full bg-[var(--primary-light)] dark:bg-[var(--primary-dark)] flex items-center justify-center mb-3 relative z-10">
              <Users className="w-5 h-5 text-[var(--primary)] dark:text-[var(--primary-light)]" />
            </div>
            <h5 className="font-semibold text-sm text-[var(--foreground)] relative z-10">Employee Training Active</h5>
            <p className="text-xs text-[var(--foreground-muted)] relative z-10">Team Mastery Protocol v4.2</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-[var(--border)] p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[var(--accent-lavender-light)] dark:bg-[var(--accent-lavender-dark)] opacity-10" />
            <div className="w-10 h-10 rounded-full bg-[var(--accent-lavender-light)] dark:bg-[var(--accent-lavender-dark)] flex items-center justify-center mb-3 relative z-10">
              <Sparkles className="w-5 h-5 text-[var(--accent-lavender)] dark:text-[var(--accent-lavender-light)]" />
            </div>
            <h5 className="font-semibold text-sm text-[var(--foreground)] relative z-10">Autonomous ROI Brain</h5>
            <p className="text-xs text-[var(--foreground-muted)] relative z-10">Complete Operational Control</p>
          </div>
        </div>
      </div>
    </div>
  );

  function renderAgentCard(agent: AgentROI) {
    const Icon = agent.icon;
    const laborValue = agent.metrics.hoursSaved * HOURLY_RATE;
    const totalValue = agent.metrics.revenue + laborValue;

    return (
      <div
        key={agent.name}
        className="bg-white dark:bg-gray-800 rounded-lg border border-[var(--border)] p-5 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${agent.bgColor} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${agent.color}`} />
            </div>
            <div>
              <h4 className="font-semibold text-[var(--foreground)]">{agent.name}</h4>
              <p className="text-xs text-[var(--foreground-muted)]">{agent.role}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-[var(--foreground)]">
              ${totalValue.toLocaleString()}
            </p>
            <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mt-0.5">Value</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center py-2 px-1 bg-[var(--background-secondary)] rounded-md border border-[var(--border-light)]">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              ${agent.metrics.revenue.toLocaleString()}
            </p>
            <p className="text-[10px] text-[var(--foreground-muted)] uppercase tracking-wider">Result</p>
          </div>
          <div className="text-center py-2 px-1 bg-[var(--background-secondary)] rounded-md border border-[var(--border-light)]">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {agent.metrics.hoursSaved}h
            </p>
            <p className="text-[10px] text-[var(--foreground-muted)] uppercase tracking-wider">Saved</p>
          </div>
          <div className="text-center py-2 px-1 bg-[var(--background-secondary)] rounded-md border border-[var(--border-light)]">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {agent.metrics.actions}
            </p>
            <p className="text-[10px] text-[var(--foreground-muted)] uppercase tracking-wider truncate px-1">
              {agent.metrics.actionLabel.split(' ')[0]}
            </p>
          </div>
        </div>

        <div className="space-y-1.5 pt-3 border-t border-[var(--border-light)]">
          {agent.highlights.map((highlight, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className={`w-1 h-1 rounded-full bg-[var(--foreground-muted)] opacity-50`} />
              <span className="text-xs text-[var(--foreground-muted)]">{highlight}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
}
