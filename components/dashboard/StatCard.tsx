'use client';

import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

// New variant names with old names for backward compatibility
export type StatCardVariant =
  | 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'
  | 'rose' | 'sage' | 'gold' | 'lavender';  // Legacy names

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  variant?: StatCardVariant;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
  className?: string;
}

const variantStyles: Record<string, {
  iconBg: string;
  iconColor: string;
}> = {
  default: {
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
  },
  success: {
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  danger: {
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
  },
  info: {
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  primary: {
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
  },
};

// Map old variant names to new ones for backwards compatibility
const variantMap: Record<string, StatCardVariant> = {
  rose: 'danger',
  sage: 'success',
  gold: 'warning',
  lavender: 'info',
  primary: 'primary',
};

export function StatCard({
  title,
  value,
  icon: Icon,
  variant = 'default',
  trend,
  subtitle,
  className,
}: StatCardProps) {
  // Support old variant names
  const mappedVariant = variantMap[variant] || variant;
  const styles = variantStyles[mappedVariant] || variantStyles.default;

  return (
    <Card className={cn("transition-all duration-300 hover:-translate-y-1 hover:shadow-lg bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl border-white/20 dark:border-gray-700/50", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold tracking-tight">
                {value}
              </p>
              {trend && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-sm font-medium",
                    trend.isPositive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  )}
                >
                  {trend.isPositive ? (
                    <TrendingUp className="size-3.5" />
                  ) : (
                    <TrendingDown className="size-3.5" />
                  )}
                  {trend.value}%
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>

          <div
            className={cn(
              "size-10 rounded-lg flex items-center justify-center flex-shrink-0",
              styles.iconBg
            )}
          >
            <Icon className={cn("size-5", styles.iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact version for grids with many items
export function StatCardCompact({
  title,
  value,
  icon: Icon,
  variant = 'default',
  className,
}: Omit<StatCardProps, 'trend' | 'subtitle'>) {
  const mappedVariant = variantMap[variant] || variant;
  const styles = variantStyles[mappedVariant] || variantStyles.default;

  return (
    <Card className={cn("transition-all duration-300 hover:-translate-y-1 hover:shadow-md bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl border-white/20 dark:border-gray-700/50", className)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "size-9 rounded-lg flex items-center justify-center",
              styles.iconBg
            )}
          >
            <Icon className={cn("size-4", styles.iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">
              {title}
            </p>
            <p className="text-lg font-semibold tracking-tight truncate">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
