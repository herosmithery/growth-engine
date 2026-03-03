import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  iconColor = 'text-[var(--primary)]',
  action,
  badge,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6', className)}>
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="p-2 rounded-lg bg-[var(--primary-light)] dark:bg-[var(--primary-dark)]">
            <Icon className={cn('w-6 h-6', iconColor)} />
          </div>
        )}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="text-[var(--foreground-muted)] mb-1">
              {description}
            </p>
          )}
        </div>
      </div>
      {action && (
        <div className="flex items-center gap-2 sm:ml-auto">
          {action}
        </div>
      )}
    </div>
  );
}
