'use client';

import Link from 'next/link';
import {
  UserPlus,
  Calendar,
  Megaphone,
  MessageSquare,
  Star,
  Phone,
  ArrowRight,
  Bot,
} from 'lucide-react';
import { toast } from 'sonner';

interface QuickAction {
  label: string;
  description: string;
  href?: string;
  onClick?: () => void;
  icon: any;
  variant: string;
}

const defaultActions: QuickAction[] = [
  {
    label: 'Run Agency Scan',
    description: 'Trigger autonomous agents',
    icon: Bot,
    variant: 'primary',
    onClick: async () => {
      const niche = window.prompt("Enter Target Niche (e.g., Roofers, Plumbers, Medspas):", "Roofers");
      if (!niche) return;
      const location = window.prompt("Enter Target Location (e.g., Austin TX):", "Austin TX");
      if (!location) return;

      const promise = fetch('http://localhost:4242/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, location })
      }).then(res => {
        if (!res.ok) throw new Error('API Error');
        return res.json();
      });
      toast.promise(promise, {
        loading: 'Orchestrating AI agents...',
        success: 'Scout, Design, and Outreach agents deployed on backend!',
        error: 'Failed to start scan (is the python backend running?)'
      });
    }
  },
  {
    label: 'Add New Client',
    description: 'Register a new client',
    href: '/clients?action=new',
    icon: UserPlus,
    variant: 'rose',
  },
  {
    label: 'Book Appointment',
    description: 'Schedule a treatment',
    href: '/appointments?action=new',
    icon: Calendar,
    variant: 'sage',
  },
  {
    label: 'Launch Campaign',
    description: 'Start a reactivation',
    href: '/campaigns?action=new',
    icon: Megaphone,
    variant: 'gold',
  },
];

const variantStyles: Record<string, {
  iconBg: string;
  iconColor: string;
  hoverBorder: string;
}> = {
  rose: {
    iconBg: 'bg-[var(--accent-rose-light)] dark:bg-[var(--accent-rose-dark)]',
    iconColor: 'text-[var(--accent-rose)] dark:text-[var(--accent-rose-light)]',
    hoverBorder: 'hover:border-[var(--accent-rose)] dark:hover:border-[var(--accent-rose-dark)]',
  },
  sage: {
    iconBg: 'bg-[var(--accent-sage-light)] dark:bg-[var(--accent-sage-dark)]',
    iconColor: 'text-[var(--accent-sage)] dark:text-[var(--accent-sage-light)]',
    hoverBorder: 'hover:border-[var(--accent-sage)] dark:hover:border-[var(--accent-sage-dark)]',
  },
  gold: {
    iconBg: 'bg-[var(--accent-gold-light)] dark:bg-[var(--accent-gold-dark)]',
    iconColor: 'text-[var(--accent-gold)] dark:text-[var(--accent-gold-light)]',
    hoverBorder: 'hover:border-[var(--accent-gold)] dark:hover:border-[var(--accent-gold-dark)]',
  },
  lavender: {
    iconBg: 'bg-[var(--accent-lavender-light)] dark:bg-[var(--accent-lavender-dark)]',
    iconColor: 'text-[var(--accent-lavender)] dark:text-[var(--accent-lavender-light)]',
    hoverBorder: 'hover:border-[var(--accent-lavender)] dark:hover:border-[var(--accent-lavender-dark)]',
  },
  primary: {
    iconBg: 'bg-[var(--primary-light)] dark:bg-[var(--primary-dark)]',
    iconColor: 'text-[var(--primary)] dark:text-[var(--primary-light)]',
    hoverBorder: 'hover:border-[var(--primary)] dark:hover:border-[var(--primary-dark)]',
  },
};

interface QuickActionsProps {
  actions?: QuickAction[];
  title?: string;
}

export function QuickActions({
  actions = defaultActions,
  title = 'Quick Actions',
}: QuickActionsProps) {
  return (
    <div className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl rounded-xl border border-white/20 dark:border-gray-700/50 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
        {title}
      </h2>

      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => {
          const styles = variantStyles[action.variant];
          const Icon = action.icon;

          const innerContent = (
            <>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full ${styles?.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${styles?.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors text-left">
                    {action.label}
                  </p>
                  <p className="text-xs text-[var(--foreground-muted)] truncate text-left">
                    {action.description}
                  </p>
                </div>
              </div>
              <ArrowRight className="absolute bottom-3 right-3 w-4 h-4 text-[var(--foreground-muted)] opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
            </>
          );

          const classNameStr = `group relative overflow-hidden bg-white/50 dark:bg-gray-800/40 backdrop-blur-md rounded-xl border border-[var(--border-light)] dark:border-gray-700 ${styles?.hoverBorder} p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:bg-white/90 dark:hover:bg-gray-800/80 w-full`;

          if (action.onClick) {
            return (
              <button key={action.label} onClick={action.onClick} className={classNameStr}>
                {innerContent}
              </button>
            );
          }

          return (
            <Link key={action.label} href={action.href || '#'} className={classNameStr}>
              {innerContent}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
