'use client';

import { useEffect, useState } from 'react';
import { FileText, Clock, Star, RefreshCw, CheckCircle, Circle, AlertCircle, Mail, Phone, MessageSquare, Send, SkipForward, Play } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { supabase, type FollowUp } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/dashboard/StatCard';

interface FollowUpWithClient extends FollowUp {
    client_name: string;
}

export default function FollowUpsPage() {
    const { businessId, loading: authLoading } = useAuth();
    const [followUps, setFollowUps] = useState<FollowUpWithClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        status: 'all',
        type: 'all',
        channel: 'all',
    });
    const [sortBy, setSortBy] = useState<'scheduled' | 'created'>('scheduled');

    useEffect(() => {
        if (!authLoading && businessId) {
            loadFollowUps();
        } else if (!authLoading && !businessId) {
            setLoading(false);
        }
    }, [businessId, authLoading]);

    async function loadFollowUps() {
        try {
            setLoading(true);

            const { data, error } = await supabase
                .from('follow_ups')
                .select(`
                    *,
                    clients(first_name, last_name, phone)
                `)
                .eq('business_id', businessId)
                .order('scheduled_for', { ascending: false })
                .limit(200);

            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }

            const mappedFollowUps: FollowUpWithClient[] = (data || []).map((fu: any) => ({
                ...fu,
                client_name: fu.clients
                    ? `${fu.clients.first_name} ${fu.clients.last_name || ''}`.trim()
                    : 'Unknown Client',
            }));

            setFollowUps(mappedFollowUps);
        } catch (error) {
            console.error('Error loading follow-ups:', error);
        } finally {
            setLoading(false);
        }
    }

    const now = new Date();
    const next48hrs = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats = {
        pending: followUps.filter(fu => fu.status === 'pending').length,
        scheduledNext48: followUps.filter(fu =>
            fu.status === 'scheduled' &&
            fu.scheduled_for &&
            new Date(fu.scheduled_for) <= next48hrs &&
            new Date(fu.scheduled_for) >= now
        ).length,
        sentThisWeek: followUps.filter(fu =>
            fu.status === 'sent' &&
            fu.sent_at &&
            new Date(fu.sent_at) >= weekAgo
        ).length,
        completedThisMonth: followUps.filter(fu =>
            fu.status === 'completed' &&
            fu.completed_at &&
            new Date(fu.completed_at) >= monthAgo
        ).length,
    };

    const getStatusBadge = (status: FollowUp['status']) => {
        const styles: Record<string, string> = {
            pending: 'bg-[var(--foreground-muted)]/10 text-[var(--foreground-muted)]',
            scheduled: 'bg-[var(--primary)]/10 text-[var(--primary)]',
            sent: 'bg-[var(--success)]/10 text-[var(--success)]',
            completed: 'bg-[var(--success)]/10 text-[var(--success)]',
            skipped: 'bg-[var(--foreground-muted)]/10 text-[var(--foreground-muted)]',
            failed: 'bg-[var(--destructive)]/10 text-[var(--destructive)]',
        };

        return (
            <span className={`px-2 py-1 rounded-md text-xs font-medium border border-transparent ${styles[status] || styles.pending}`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    const getTypeBadge = (type: FollowUp['type']) => {
        const styles: Record<string, string> = {
            post_treatment: 'bg-[var(--primary)]/10 text-[var(--primary)]',
            booking_reminder: 'bg-[var(--primary)]/10 text-[var(--primary)]',
            reactivation: 'bg-[var(--warning)]/10 text-[var(--warning)]',
            review_request: 'bg-[var(--success)]/10 text-[var(--success)]',
            birthday: 'bg-[var(--primary)]/10 text-[var(--primary)]',
            custom: 'bg-[var(--foreground-muted)]/10 text-[var(--foreground-muted)]',
        };

        const labels: Record<string, string> = {
            post_treatment: 'Post-Treatment',
            booking_reminder: 'Booking Reminder',
            reactivation: 'Reactivation',
            review_request: 'Review Request',
            birthday: 'Birthday',
            custom: 'Custom',
        };

        return (
            <span className={`px-2 py-1 rounded-md text-xs font-medium border border-transparent ${styles[type] || styles.custom}`}>
                {labels[type] || type}
            </span>
        );
    };

    const getChannelIcon = (channel?: FollowUp['channel']) => {
        if (channel === 'sms') return <MessageSquare className="w-3 h-3 text-[var(--primary)]" />;
        if (channel === 'email') return <Mail className="w-3 h-3 text-[var(--foreground-muted)]" />;
        if (channel === 'call') return <Phone className="w-3 h-3 text-[var(--success)]" />;
        return null;
    };

    async function sendFollowUp(followUpId: string) {
        try {
            const { error } = await supabase
                .from('follow_ups')
                .update({
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                })
                .eq('id', followUpId);

            if (error) throw error;
            toast.success('Follow-up marked as sent');
            loadFollowUps();
        } catch (error) {
            console.error('Error sending follow-up:', error);
            toast.error('Failed to update follow-up');
        }
    }

    async function skipFollowUp(followUpId: string) {
        try {
            const { error } = await supabase
                .from('follow_ups')
                .update({
                    status: 'skipped',
                })
                .eq('id', followUpId);

            if (error) throw error;
            toast.success('Follow-up skipped');
            loadFollowUps();
        } catch (error) {
            console.error('Error skipping follow-up:', error);
            toast.error('Failed to skip follow-up');
        }
    }

    async function completeFollowUp(followUpId: string) {
        try {
            const { error } = await supabase
                .from('follow_ups')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                })
                .eq('id', followUpId);

            if (error) throw error;
            toast.success('Follow-up completed');
            loadFollowUps();
        } catch (error) {
            console.error('Error completing follow-up:', error);
            toast.error('Failed to complete follow-up');
        }
    }

    const filteredFollowUps = followUps.filter(fu => {
        if (filters.status !== 'all' && fu.status !== filters.status) return false;
        if (filters.type !== 'all' && fu.type !== filters.type) return false;
        if (filters.channel !== 'all' && fu.channel !== filters.channel) return false;
        return true;
    });

    const sortedFollowUps = [...filteredFollowUps].sort((a, b) => {
        if (sortBy === 'scheduled') {
            const aDate = a.scheduled_for ? new Date(a.scheduled_for).getTime() : 0;
            const bDate = b.scheduled_for ? new Date(b.scheduled_for).getTime() : 0;
            return bDate - aDate;
        } else {
            const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
            return bDate - aDate;
        }
    });

    if (authLoading || loading) {
        return (
            <>
                <main className="container mx-auto p-6">
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
                    </div>
                </main>
            </>
        );
    }

    if (!businessId) {
        return (
            <>
                <main className="container mx-auto p-6">
                    <div className="flex flex-col items-center justify-center h-64 space-y-4">
                        <AlertCircle className="w-12 h-12 text-[var(--warning)]" />
                        <p className="text-[var(--foreground-muted)]">Please log in to view follow-ups.</p>
                    </div>
                </main>
            </>
        );
    }

    return (
        <>
            <div className="p-6 max-w-[1600px] mx-auto space-y-6">
                <PageHeader
                    title="Follow-Ups"
                    description="Manage client follow-up sequences, reactivations, and reminders"
                />

                {/* Pipeline View */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <StatCard
                        title="Pending"
                        value={stats.pending.toString()}
                        subtitle="Awaiting Action"
                        icon={FileText}
                    />
                    <StatCard
                        title="Scheduled"
                        value={stats.scheduledNext48.toString()}
                        subtitle="Next 48 Hours"
                        icon={Clock}
                    />
                    <StatCard
                        title="Sent"
                        value={stats.sentThisWeek.toString()}
                        subtitle="This Week"
                        icon={Star}
                    />
                    <StatCard
                        title="Completed"
                        value={stats.completedThisMonth.toString()}
                        subtitle="This Month"
                        icon={RefreshCw}
                    />
                </div>

                {/* Filters and Sort */}
                <div className="bg-[var(--background-card)] rounded-lg border border-[var(--border)] p-4 mb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            className="px-4 py-2 border border-[var(--border)] bg-[var(--background-card)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none transition-all duration-200"
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="sent">Sent</option>
                            <option value="completed">Completed</option>
                            <option value="skipped">Skipped</option>
                            <option value="failed">Failed</option>
                        </select>
                        <select
                            value={filters.type}
                            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                            className="px-4 py-2 border border-[var(--border)] bg-[var(--background-card)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none transition-all duration-200"
                        >
                            <option value="all">All Types</option>
                            <option value="post_treatment">Post-Treatment</option>
                            <option value="booking_reminder">Booking Reminder</option>
                            <option value="reactivation">Reactivation</option>
                            <option value="review_request">Review Request</option>
                            <option value="birthday">Birthday</option>
                            <option value="custom">Custom</option>
                        </select>
                        <select
                            value={filters.channel}
                            onChange={(e) => setFilters({ ...filters, channel: e.target.value })}
                            className="px-4 py-2 border border-[var(--border)] bg-[var(--background-card)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none transition-all duration-200"
                        >
                            <option value="all">All Channels</option>
                            <option value="sms">SMS</option>
                            <option value="email">Email</option>
                            <option value="call">Call</option>
                        </select>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as 'scheduled' | 'created')}
                            className="px-4 py-2 border border-[var(--border)] bg-[var(--background-card)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none transition-all duration-200"
                        >
                            <option value="scheduled">Sort by Scheduled Date</option>
                            <option value="created">Sort by Created Date</option>
                        </select>
                    </div>
                </div>

                {/* Follow-Ups List DataTable */}
                <div className="bg-[var(--background-card)] rounded-lg border border-[var(--border)] overflow-hidden">
                    {followUps.length === 0 ? (
                        <div className="p-12 text-center">
                            <Clock className="w-12 h-12 text-[var(--foreground-muted)] opacity-50 mx-auto mb-4" />
                            <p className="text-[var(--foreground-muted)] text-lg">No follow-ups found</p>
                            <p className="text-sm text-[var(--foreground-muted)]/70 mt-1">Follow-ups will appear here once created</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-[var(--border)] bg-[var(--background-card)] text-[var(--foreground-muted)]">
                                        <th className="p-4 text-sm font-medium">Client & Type</th>
                                        <th className="p-4 text-sm font-medium">Message & Notes</th>
                                        <th className="p-4 text-sm font-medium">Timing</th>
                                        <th className="p-4 text-sm font-medium">Status</th>
                                        <th className="p-4 text-sm font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                    {sortedFollowUps.map((fu) => (
                                        <tr key={fu.id} className="hover:bg-[var(--foreground)]/5 transition-colors group">
                                            <td className="p-4 align-top">
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="font-semibold text-[var(--foreground)]">{fu.client_name}</span>
                                                    <div className="flex items-center gap-2">
                                                        {getTypeBadge(fu.type)}
                                                        {fu.channel && (
                                                            <span className="flex items-center space-x-1 border border-[var(--border)] bg-[var(--background)] px-1.5 py-0.5 rounded-md text-xs text-[var(--foreground-muted)]">
                                                                {getChannelIcon(fu.channel)}
                                                                <span>{fu.channel.toUpperCase()}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 align-top max-w-sm">
                                                <div className="flex flex-col gap-2">
                                                    {fu.message_template && (
                                                        <p className="text-sm text-[var(--foreground)]/80 line-clamp-2" title={fu.message_template}>
                                                            {fu.message_template}
                                                        </p>
                                                    )}
                                                    {fu.notes && (
                                                        <p className="text-xs text-[var(--foreground-muted)] italic line-clamp-2 border-l-2 border-[var(--border)] pl-2" title={fu.notes}>
                                                            {fu.notes}
                                                        </p>
                                                    )}
                                                    {fu.result && (
                                                        <p className="text-xs text-[var(--success)] font-medium">
                                                            Result: {fu.result}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 align-top">
                                                <div className="flex flex-col gap-2 text-sm text-[var(--foreground-muted)]">
                                                    {fu.scheduled_for && (
                                                        <div className="flex flex-col">
                                                            <span className="text-xs uppercase tracking-wider opacity-60">Scheduled</span>
                                                            <span className="font-medium text-[var(--foreground)]/80">{format(new Date(fu.scheduled_for), 'MMM d, h:mm a')}</span>
                                                        </div>
                                                    )}
                                                    {fu.sent_at && (
                                                        <div className="flex flex-col">
                                                            <span className="text-xs uppercase tracking-wider opacity-60">Sent</span>
                                                            <span className="font-medium text-[var(--foreground)]/80">{formatDistanceToNow(new Date(fu.sent_at), { addSuffix: true })}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col mt-1">
                                                        <span className="text-[10px] opacity-50">Created {formatDistanceToNow(new Date(fu.created_at), { addSuffix: true })}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 align-top">
                                                <div className="flex flex-col gap-2 items-start">
                                                    {getStatusBadge(fu.status)}
                                                </div>
                                            </td>
                                            <td className="p-4 align-top text-right">
                                                <div className="flex flex-col items-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {(fu.status === 'pending' || fu.status === 'scheduled') && (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => skipFollowUp(fu.id)}
                                                                className="inline-flex items-center px-2 py-1.5 text-xs font-medium text-[var(--foreground-muted)] bg-[var(--background)] hover:bg-[var(--foreground)]/5 border border-[var(--border)] rounded-md transition-colors"
                                                                title="Skip Follow-up"
                                                            >
                                                                <SkipForward className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => sendFollowUp(fu.id)}
                                                                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary)]/90 rounded-md transition-colors"
                                                            >
                                                                <Play className="w-3.5 h-3.5 mr-1.5" />
                                                                Send
                                                            </button>
                                                            <button
                                                                onClick={() => completeFollowUp(fu.id)}
                                                                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-[var(--success)] hover:bg-[var(--success)]/90 rounded-md transition-colors"
                                                                title="Mark Complete"
                                                            >
                                                                <CheckCircle className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                    {fu.status === 'sent' && (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => completeFollowUp(fu.id)}
                                                                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-[var(--success)] hover:bg-[var(--success)]/90 rounded-md transition-colors"
                                                            >
                                                                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                                                                Complete
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
