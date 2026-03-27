'use client';

import { LucideIcon } from 'lucide-react';
import { Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';

export type AgentVariant = 'aura' | 'phoenix' | 'star' | 'sage';

interface AgentMetric {
  label: string;
  value: number | string;
}

interface AgentCardProps {
  name: string;
  role: string;
  description?: string;
  icon: LucideIcon;
  variant: AgentVariant;
  metrics: AgentMetric[];
  status?: 'active' | 'idle' | 'learning';
  onClick?: () => void;
  href?: string;
}

const agentStyles: Record<AgentVariant, {
  bg: string;
  iconBg: string;
  accent: string;
  statusColor: string;
}> = {
  aura: {
    bg: 'bg-white dark:bg-gray-800',
    iconBg: 'bg-[var(--accent-rose)]',
    accent: 'text-[var(--accent-rose)]',
    statusColor: 'bg-[var(--success)]',
  },
  phoenix: {
    bg: 'bg-white dark:bg-gray-800',
    iconBg: 'bg-[var(--accent-gold)]',
    accent: 'text-[var(--accent-gold)]',
    statusColor: 'bg-[var(--success)]',
  },
  star: {
    bg: 'bg-white dark:bg-gray-800',
    iconBg: 'bg-[var(--accent-lavender)]',
    accent: 'text-[var(--accent-lavender)]',
    statusColor: 'bg-[var(--success)]',
  },
  sage: {
    bg: 'bg-white dark:bg-gray-800',
    iconBg: 'bg-[var(--accent-sage)]',
    accent: 'text-[var(--accent-sage)]',
    statusColor: 'bg-[var(--success)]',
  },
};

export function AgentCard({
  name,
  role,
  description,
  icon: Icon,
  variant,
  metrics,
  status = 'active',
  onClick,
  href,
}: AgentCardProps) {
  const router = useRouter();
  const styles = agentStyles[variant];

  const statusLabels = {
    active: 'Active',
    idle: 'Idle',
    learning: 'Learning',
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (href) {
      router.push(href);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`
        relative overflow-hidden
        rounded-xl border border-white/20 dark:border-gray-700/50
        p-5 transition-all duration-300
        hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-2xl
        backdrop-blur-xl bg-white/70 dark:bg-gray-800/50
        group cursor-pointer
      `}
    >
      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Agent Icon */}
            <div
              className={`
                w-10 h-10 rounded-full
                ${styles.iconBg}
                flex items-center justify-center flex-shrink-0
              `}
            >
              <Icon className="w-5 h-5 text-white" />
            </div>

            {/* Agent Info */}
            <div>
              <h3 className="font-semibold text-[var(--foreground)] text-base">
                {name}
              </h3>
              <p className={`text-xs ${styles.accent} font-medium`}>{role}</p>
            </div>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-1.5 bg-[var(--background-secondary)] px-2 py-1 rounded-md border border-[var(--border-light)]">
            <span
              className={`
                w-1.5 h-1.5 rounded-full ${styles.statusColor}
                ${status === 'active' ? 'animate-pulse' : ''}
              `}
            />
            <span className="text-xs text-[var(--foreground-muted)] font-medium">
              {statusLabels[status]}
            </span>
          </div>
        </div>

        {/* Description */}
        {description && (
          <p className="text-sm text-[var(--foreground-muted)] mb-4 line-clamp-2">
            {description}
          </p>
        )}

        {/* Metrics Grid */}
        <div className="space-y-2.5">
          {metrics.map((metric, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-1.5 border-t border-[var(--border-light)] first:border-t-0 first:pt-0"
            >
              <span className="text-xs text-[var(--foreground-muted)]">
                {metric.label}
              </span>
              <span className={`text-sm font-semibold text-[var(--foreground)]`}>
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Mini version for quick status overview
export function AgentStatusCard({
  name,
  icon: Icon,
  variant,
  mainMetric,
  status = 'active',
}: {
  name: string;
  icon: LucideIcon;
  variant: AgentVariant;
  mainMetric: { label: string; value: string | number };
  status?: 'active' | 'idle' | 'learning';
}) {
  const styles = agentStyles[variant];

  return (
    <div
      className={`
        ${styles.bg} rounded-lg border border-[var(--border)]
        p-3 transition-all duration-200
        hover:bg-gray-50 dark:hover:bg-gray-800/80
        flex items-center gap-3
      `}
    >
      <div
        className={`
          w-8 h-8 rounded-full
          ${styles.iconBg}
          flex items-center justify-center flex-shrink-0
        `}
      >
        <Icon className="w-4 h-4 text-white" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-[var(--foreground)] text-sm truncate">
            {name}
          </span>
          <span
            className={`
              w-1.5 h-1.5 rounded-full ${styles.statusColor}
              ${status === 'active' ? 'animate-pulse' : ''}
            `}
          />
        </div>
        <p className="text-xs text-[var(--foreground-muted)]">
          {mainMetric.label}: <span className="font-medium text-[var(--foreground)]">{mainMetric.value}</span>
        </p>
      </div>

      <Activity className={`w-4 h-4 ${styles.accent} opacity-50`} />
    </div>
  );
}
