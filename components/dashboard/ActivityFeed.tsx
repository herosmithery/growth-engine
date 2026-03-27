'use client';

import { MessageSquare, Phone, Star, Calendar, Mail, UserPlus } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'sms' | 'call' | 'review' | 'appointment' | 'email' | 'lead';
  description: string;
  time: string;
  status?: 'success' | 'pending' | 'info';
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  title?: string;
  emptyMessage?: string;
}

const typeConfig: Record<string, {
  icon: typeof MessageSquare;
  color: string;
  bg: string;
}> = {
  sms: {
    icon: MessageSquare,
    color: 'text-[var(--accent-sage-dark)]',
    bg: 'bg-[var(--accent-sage-light)]',
  },
  call: {
    icon: Phone,
    color: 'text-[var(--accent-rose-dark)]',
    bg: 'bg-[var(--accent-rose-light)]',
  },
  review: {
    icon: Star,
    color: 'text-[var(--accent-gold)]',
    bg: 'bg-[var(--accent-gold-light)]',
  },
  appointment: {
    icon: Calendar,
    color: 'text-[var(--primary)]',
    bg: 'bg-[var(--primary-light)]/30',
  },
  email: {
    icon: Mail,
    color: 'text-[var(--accent-lavender)]',
    bg: 'bg-[var(--accent-lavender-light)]',
  },
  lead: {
    icon: UserPlus,
    color: 'text-[var(--success)]',
    bg: 'bg-[var(--success-light)]',
  },
};

export function ActivityFeed({
  activities,
  title = 'Recent Activity',
  emptyMessage = 'No recent activity',
}: ActivityFeedProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-[var(--border)] p-6">
      <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
        {title}
      </h2>

      {activities.length === 0 ? (
        <div className="py-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--background-secondary)] flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-[var(--foreground-muted)]" />
          </div>
          <p className="text-[var(--foreground-muted)]">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {activities.map((activity, index) => {
            const config = typeConfig[activity.type] || typeConfig.sms;
            const Icon = config.icon;

            return (
              <div
                key={activity.id}
                className={`
                  flex items-center gap-4 p-3 rounded-lg
                  hover:bg-gray-50 dark:hover:bg-gray-800/80
                  transition-colors cursor-pointer group
                  ${index !== 0 ? 'border-t border-[var(--border-light)]' : ''}
                `}
              >
                {/* Icon */}
                <div
                  className={`
                    w-10 h-10 rounded-full ${config.bg}
                    flex items-center justify-center flex-shrink-0
                  `}
                >
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--foreground)] truncate group-hover:text-[var(--primary)] transition-colors">
                    {activity.description}
                  </p>
                  <p className="text-xs text-[var(--foreground-muted)]">
                    {activity.time}
                  </p>
                </div>

                {/* Status dot */}
                {activity.status && (
                  <span
                    className={`
                      w-2 h-2 rounded-full flex-shrink-0
                      ${activity.status === 'success' ? 'bg-[var(--success)]' : ''}
                      ${activity.status === 'pending' ? 'bg-[var(--warning)] animate-pulse' : ''}
                      ${activity.status === 'info' ? 'bg-[var(--info)]' : ''}
                    `}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {activities.length > 0 && (
        <button className="w-full mt-4 py-2.5 text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-dark)] transition-colors">
          View All Activity
        </button>
      )}
    </div>
  );
}
