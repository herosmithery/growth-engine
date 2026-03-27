import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  variant?: 'default' | 'compact';
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const isCompact = variant === 'compact';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        isCompact ? 'py-8 px-4' : 'py-16 px-6',
        className
      )}
    >
      <div
        className={cn(
          'rounded-2xl bg-[#f6f8fa] dark:bg-[#161b22] border border-[var(--border)] flex items-center justify-center mb-4',
          isCompact ? 'w-12 h-12' : 'w-16 h-16'
        )}
      >
        <Icon
          className={cn(
            'text-[var(--foreground-muted)]',
            isCompact ? 'w-6 h-6' : 'w-8 h-8'
          )}
        />
      </div>
      <h3
        className={cn(
          'font-semibold text-[var(--foreground)] mb-1',
          isCompact ? 'text-base' : 'text-lg'
        )}
      >
        {title}
      </h3>
      <p
        className={cn(
          'text-[var(--foreground-muted)] max-w-sm',
          isCompact ? 'text-sm' : 'text-base'
        )}
      >
        {description}
      </p>
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className={cn(
              'mt-4 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-md transition-colors font-medium border border-transparent hover:border-black/10 dark:hover:border-white/10 shadow-sm',
              isCompact ? 'text-sm' : 'text-base'
            )}
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className={cn(
              'mt-4 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-md transition-colors font-medium border border-transparent hover:border-black/10 dark:hover:border-white/10 shadow-sm',
              isCompact ? 'text-sm' : 'text-base'
            )}
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
