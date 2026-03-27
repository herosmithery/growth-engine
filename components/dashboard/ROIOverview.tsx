'use client';

import { useRouter } from 'next/navigation';
import { DollarSign, Clock, Users, TrendingUp, Sparkles, ArrowUpRight } from 'lucide-react';

interface ROIMetrics {
  revenueRecovered: number;
  hoursSaved: number;
  leadsGenerated: number;
  clientsReactivated: number;
  callsHandled: number;
  followUpsSent: number;
  reviewsCollected: number;
  conversionRate: number;
}

interface ROIOverviewProps {
  metrics: ROIMetrics;
  period?: string;
}

// Cost assumptions for ROI calculation
const COSTS = {
  hourlyReceptionistRate: 22, // Average hourly rate for receptionist
  avgCallDuration: 5, // minutes
  avgFollowUpTime: 3, // minutes per follow-up
  avgBookingValue: 250, // Average treatment value
  reactivationValue: 350, // Average value of reactivated client
  leadValue: 150, // Average value per qualified lead
};

export function ROIOverview({ metrics, period = 'This Month' }: ROIOverviewProps) {
  // Calculate derived ROI metrics
  const callHoursSaved = (metrics.callsHandled * COSTS.avgCallDuration) / 60;
  const followUpHoursSaved = (metrics.followUpsSent * COSTS.avgFollowUpTime) / 60;
  const totalHoursSaved = callHoursSaved + followUpHoursSaved + metrics.hoursSaved;

  const laborSavings = totalHoursSaved * COSTS.hourlyReceptionistRate;
  const reactivationRevenue = metrics.clientsReactivated * COSTS.reactivationValue;
  const leadRevenue = metrics.leadsGenerated * COSTS.leadValue * (metrics.conversionRate / 100);

  const totalROI = metrics.revenueRecovered + laborSavings + reactivationRevenue + leadRevenue;
  const monthlySubscriptionCost = 497; // Example subscription cost
  const roiMultiplier = totalROI > 0 ? (totalROI / monthlySubscriptionCost).toFixed(1) : '0';

  return (
    <div className="relative overflow-hidden bg-white dark:bg-gray-800 border border-[var(--border)] rounded-lg p-6">

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="w-4 h-4 text-[var(--accent-gold)]" />
              <span className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">Growth Engine ROI</span>
            </div>
            <h2 className="text-3xl font-bold text-[var(--foreground)] tracking-tight mb-1">
              ${totalROI.toLocaleString()}
            </h2>
            <p className="text-[var(--foreground-muted)] text-sm">
              Total value generated {period.toLowerCase()}
            </p>
          </div>

          <div className="text-right">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--background-secondary)] border border-[var(--border-light)]">
              <TrendingUp className="w-4 h-4 text-[var(--success)]" />
              <span className="text-sm font-semibold text-[var(--foreground)]">{roiMultiplier}x ROI</span>
            </div>
            <p className="text-xs text-[var(--foreground-muted)] mt-2">Return on investment</p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <ROIMetricCard
            icon={DollarSign}
            label="Revenue Recovered"
            value={`$${metrics.revenueRecovered.toLocaleString()}`}
            subValue="From reactivations"
            color="gold"
            href="/campaigns"
          />
          <ROIMetricCard
            icon={Clock}
            label="Hours Saved"
            value={`${Math.round(totalHoursSaved)}h`}
            subValue={`$${laborSavings.toLocaleString()} in labor`}
            color="sage"
            href="/calls"
          />
          <ROIMetricCard
            icon={Users}
            label="Leads Generated"
            value={metrics.leadsGenerated.toString()}
            subValue={`${metrics.conversionRate}% conversion`}
            color="rose"
            href="/leads"
          />
          <ROIMetricCard
            icon={ArrowUpRight}
            label="Clients Reactivated"
            value={metrics.clientsReactivated.toString()}
            subValue={`$${reactivationRevenue.toLocaleString()} value`}
            color="lavender"
            href="/clients"
          />
        </div>

        {/* ROI Breakdown Bar */}
        <div className="mt-6 pt-5 border-t border-[var(--border)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-[var(--foreground)] font-medium">Value Breakdown</span>
            <span className="text-xs text-[var(--foreground-muted)]">Hover for details</span>
          </div>
          <div className="h-2.5 bg-[var(--background-secondary)] rounded-full overflow-hidden flex">
            <ROIBarSegment
              value={reactivationRevenue}
              total={totalROI}
              color="bg-[var(--accent-gold)]"
              label="Reactivations"
            />
            <ROIBarSegment
              value={laborSavings}
              total={totalROI}
              color="bg-[var(--accent-sage)]"
              label="Labor Savings"
            />
            <ROIBarSegment
              value={leadRevenue}
              total={totalROI}
              color="bg-[var(--accent-rose)]"
              label="Lead Value"
            />
            <ROIBarSegment
              value={metrics.revenueRecovered - reactivationRevenue}
              total={totalROI}
              color="bg-[var(--accent-lavender)]"
              label="Other Revenue"
            />
          </div>
          <div className="flex items-center gap-6 mt-3 flex-wrap">
            <LegendItem color="bg-[var(--accent-gold)]" label="Reactivations" />
            <LegendItem color="bg-[var(--accent-sage)]" label="Labor Savings" />
            <LegendItem color="bg-[var(--accent-rose)]" label="Lead Value" />
            <LegendItem color="bg-[var(--accent-lavender)]" label="Other Revenue" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface ROIMetricCardProps {
  icon: typeof DollarSign;
  label: string;
  value: string;
  subValue: string;
  color: 'gold' | 'sage' | 'rose' | 'lavender';
  href?: string;
}

function ROIMetricCard({ icon: Icon, label, value, subValue, color, href }: ROIMetricCardProps) {
  const router = useRouter();
  const colorClasses = {
    gold: 'bg-[var(--accent-gold-light)] text-[var(--accent-gold)]',
    sage: 'bg-[var(--accent-sage-light)] text-[var(--accent-sage)]',
    rose: 'bg-[var(--accent-rose-light)] text-[var(--accent-rose)]',
    lavender: 'bg-[var(--accent-lavender-light)] text-[var(--accent-lavender)]',
  };

  return (
    <div
      className={`bg-[var(--background-secondary)] border border-[var(--border-light)] rounded-lg p-4 transition-colors hover:bg-white dark:hover:bg-gray-700/50 ${href ? 'cursor-pointer' : ''}`}
      onClick={() => href && router.push(href)}
    >
      <div className={`w-8 h-8 rounded-full ${colorClasses[color]} flex items-center justify-center mb-3`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xl font-bold text-[var(--foreground)] tracking-tight mb-1">{value}</p>
      <p className="text-xs font-medium text-[var(--foreground-muted)]">{label}</p>
      <p className="text-xs text-[var(--foreground-muted)] mt-1 opacity-80">{subValue}</p>
    </div>
  );
}

function ROIBarSegment({
  value,
  total,
  color,
  label
}: {
  value: number;
  total: number;
  color: string;
  label: string;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  if (percentage <= 0) return null;

  return (
    <div
      className={`${color} h-full transition-all duration-300 hover:opacity-80 cursor-pointer relative group`}
      style={{ width: `${percentage}%` }}
      title={`${label}: $${value.toLocaleString()} (${percentage.toFixed(1)}%)`}
    >
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg">
        {label}: ${value.toLocaleString()}
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs text-[var(--foreground-muted)]">{label}</span>
    </div>
  );
}

// Compact version for sidebar or smaller spaces
export function ROICompact({ totalROI, roiMultiplier }: { totalROI: number; roiMultiplier: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-[var(--border)] rounded-lg p-4 text-[var(--foreground)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[var(--foreground-muted)] mb-1">Monthly ROI</p>
          <p className="text-lg font-bold">${totalROI.toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--background-secondary)] border border-[var(--border-light)]">
          <TrendingUp className="w-3 h-3 text-[var(--success)]" />
          <span className="text-xs font-semibold">{roiMultiplier}x</span>
        </div>
      </div>
    </div>
  );
}
