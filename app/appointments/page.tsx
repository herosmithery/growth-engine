'use client';

import { useEffect, useState } from 'react';
import { Calendar, CheckCircle, XCircle, Clock, Users, ChevronDown, ChevronRight, ThumbsUp, ThumbsDown, Minus, AlertCircle, List, CalendarDays, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { CalendarWidget } from '@/components/dashboard/CalendarWidget';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { PageLoading } from '@/components/ui/page-loading';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/dashboard/StatCard';

interface AppointmentWithDetails {
    id: string;
    business_id?: string;
    client_id?: string;
    client_name: string;
    treatment_type?: string;
    start_time?: string;
    status?: string;
    source?: string;
    provider_name?: string;
    notes?: string;
    amount?: number;
    google_event_id?: string;
    follow_up_status: 'pending' | 'in_progress' | 'completed';
    follow_up_messages: Array<{
        id: string;
        type: string;
        sent_at: string;
        status: 'sent' | 'pending' | 'failed';
        content: string;
    }>;
    client_reply: {
        message: string;
        sentiment: 'positive' | 'negative' | 'neutral';
        received_at: string;
    } | null;
    [key: string]: any;
}

export default function AppointmentsPage() {
    const router = useRouter();
    const { businessId, loading: authLoading } = useAuth();
    const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [filters, setFilters] = useState({
        status: 'all',
        source: 'all',
        search: '',
        startDate: '',
        endDate: '',
    });
    const [page, setPage] = useState(1);
    const itemsPerPage = 25;

    useEffect(() => {
        if (!authLoading && businessId) {
            loadAppointments();
        } else if (!authLoading && !businessId) {
            setLoading(false);
        }
    }, [filters, page, businessId, authLoading]);

    async function loadAppointments() {
        if (!businessId) return;
        try {
            setLoading(true);

            const params = new URLSearchParams({ business_id: businessId });
            if (filters.status !== 'all') params.set('status', filters.status);
            if (filters.source !== 'all') params.set('source', filters.source);
            if (filters.startDate) params.set('start_date', filters.startDate);
            if (filters.endDate) params.set('end_date', filters.endDate);

            const res = await fetch(`/api/appointments?${params}`);
            if (!res.ok) throw new Error('Failed to load appointments');
            const data = await res.json();

            const mappedAppointments: AppointmentWithDetails[] = (data.appointments || []).map((appt: any) => ({
                ...appt,
                follow_up_messages: (appt.follow_ups || []).map((f: any) => ({
                    id: f.id,
                    type: f.type || 'Follow-up',
                    sent_at: f.sent_at || f.scheduled_for,
                    status: f.status === 'sent' || f.status === 'completed' ? 'sent' : f.status === 'failed' ? 'failed' : 'pending',
                    content: f.message_template || '',
                })),
                client_reply: null,
            }));

            // Apply search filter client-side
            const filteredData = filters.search
                ? mappedAppointments.filter(appt =>
                    appt.client_name.toLowerCase().includes(filters.search.toLowerCase()) ||
                    appt.treatment_type?.toLowerCase().includes(filters.search.toLowerCase())
                )
                : mappedAppointments;

            setAppointments(filteredData);
        } catch (error) {
            console.error('Error loading appointments:', error);
        } finally {
            setLoading(false);
        }
    }

    const stats = {
        total: appointments.length,
        completed: appointments.filter(a => a.status === 'completed').length,
        noShows: appointments.filter(a => a.status === 'no_show').length,
        aiBooked: appointments.filter(a => a.source === 'ai-agent' || a.source === 'ai_phone').length,
    };

    const noShowPercentage = stats.total > 0 ? ((stats.noShows / stats.total) * 100).toFixed(1) : '0.0';

    const getSourceBadge = (source?: string) => {
        const labels: Record<string, string> = {
            'ai-agent': 'AI Phone',
            'ai_phone': 'AI Phone',
            'phone': 'Phone',
            'website': 'Website',
            'walk-in': 'Walk-in',
        };

        const label = labels[source || ''] || source || 'Unknown';

        return (
            <span className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold border border-[var(--border)] bg-[#f6f8fa] dark:bg-[#161b22] text-[var(--foreground)] uppercase tracking-wide">
                {label}
            </span>
        );
    };

    const getStatusBadge = (status: string | undefined) => {
        const styles: Record<string, string> = {
            scheduled: 'bg-yellow-100/50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
            confirmed: 'bg-blue-100/50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            completed: 'bg-[var(--success)]/10 text-[var(--success)]',
            cancelled: 'bg-[var(--foreground-muted)]/10 text-[var(--foreground-muted)]',
            no_show: 'bg-[var(--destructive)]/10 text-[var(--destructive)]',
            rescheduled: 'bg-[var(--primary-light)]/30 text-[var(--primary)]',
        };

        const labels: Record<string, string> = {
            scheduled: 'Scheduled',
            confirmed: 'Confirmed',
            completed: 'Completed',
            cancelled: 'Cancelled',
            no_show: 'No-Show',
            rescheduled: 'Rescheduled',
        };

        return (
            <span className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wide border border-transparent ${(status && styles[status]) || 'bg-[var(--foreground-muted)]/10 text-[var(--foreground-muted)]'}`}>
                {(status && labels[status]) || status}
            </span>
        );
    };

    const getFollowUpBadge = (status: 'pending' | 'in_progress' | 'completed') => {
        const styles = {
            pending: 'bg-yellow-100/50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
            in_progress: 'bg-blue-100/50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            completed: 'bg-[var(--success)]/10 text-[var(--success)]',
        };

        const labels = {
            pending: 'Pending',
            in_progress: 'In Progress',
            completed: 'Completed',
        };

        return (
            <span className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold border border-transparent uppercase tracking-wide ${styles[status]}`}>
                {labels[status]}
            </span>
        );
    };

    const getSentimentIcon = (sentiment: 'positive' | 'negative' | 'neutral') => {
        if (sentiment === 'positive') return <ThumbsUp className="w-4 h-4 text-green-500" />;
        if (sentiment === 'negative') return <ThumbsDown className="w-4 h-4 text-red-500" />;
        return <Minus className="w-4 h-4 text-gray-500" />;
    };

    const paginatedAppointments = appointments.slice((page - 1) * itemsPerPage, page * itemsPerPage);
    const totalPages = Math.ceil(appointments.length / itemsPerPage) || 1;

    if (authLoading || loading) {
        return <PageLoading variant="skeleton" message="Loading appointments..." />;
    }

    if (!businessId) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-yellow-100/50 dark:bg-yellow-900/30 flex items-center justify-center">
                    <AlertCircle className="w-10 h-10 text-yellow-600" />
                </div>
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Welcome to Appointments</h2>
                    <p className="text-gray-500 dark:text-gray-400">Please sign in to view your appointments.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="Appointments"
                description="Full appointment pipeline and follow-up tracking"
                icon={CalendarDays}
                action={
                    <div className="flex bg-[#f6f8fa] dark:bg-[#0d1117] p-1 rounded-md border border-[var(--border)]">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-[var(--background)] border border-[var(--border)] shadow-sm text-[var(--foreground)] rounded-md' : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)] rounded-md'}`}
                        >
                            <List className="w-4 h-4" />
                            <span>List</span>
                        </button>
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium transition-colors ${viewMode === 'calendar' ? 'bg-[var(--background)] border border-[var(--border)] shadow-sm text-[var(--foreground)] rounded-md' : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)] rounded-md'}`}
                        >
                            <Calendar className="w-4 h-4" />
                            <span>Calendar</span>
                        </button>
                    </div>
                }
            />

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    title="Total This Month"
                    value={stats.total}
                    icon={Calendar}
                    variant="primary"
                />
                <StatCard
                    title="Completed"
                    value={stats.completed}
                    icon={CheckCircle}
                    variant="sage"
                />
                <StatCard
                    title="No-Shows"
                    value={stats.noShows}
                    icon={XCircle}
                    variant="rose"
                    subtitle={`${noShowPercentage}% of total`}
                />
                <StatCard
                    title="AI-Booked"
                    value={stats.aiBooked}
                    icon={Sparkles}
                    variant="lavender"
                />
            </div>

            {/* Filter Bar */}
            <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] p-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <Input
                        type="text"
                        placeholder="Search by client name..."
                        value={filters.search}
                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                        className="rounded-md bg-[#f6f8fa] dark:bg-[#161b22] border-[var(--border)] focus-visible:ring-1 focus-visible:ring-[var(--primary)] text-sm"
                    />
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        className="px-3 py-2 border border-[var(--border)] rounded-md bg-[#f6f8fa] dark:bg-[#161b22] focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] dark:text-[var(--foreground)] text-sm transition-colors"
                    >
                        <option value="all">All Statuses</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="no_show">No-Show</option>
                    </select>
                    <select
                        value={filters.source}
                        onChange={(e) => setFilters({ ...filters, source: e.target.value })}
                        className="px-3 py-2 border border-[var(--border)] rounded-md bg-[#f6f8fa] dark:bg-[#161b22] focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] dark:text-[var(--foreground)] text-sm transition-colors"
                    >
                        <option value="all">All Sources</option>
                        <option value="ai-agent">AI Phone</option>
                        <option value="phone">Phone</option>
                        <option value="website">Website</option>
                        <option value="walk-in">Walk-in</option>
                    </select>
                    <Input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                        className="rounded-md bg-[#f6f8fa] dark:bg-[#161b22] border-[var(--border)] focus-visible:ring-1 focus-visible:ring-[var(--primary)] text-sm"
                    />
                    <Input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                        className="rounded-md bg-[#f6f8fa] dark:bg-[#161b22] border-[var(--border)] focus-visible:ring-1 focus-visible:ring-[var(--primary)] text-sm"
                    />
                </div>
            </div>

            {viewMode === 'calendar' ? (
                <div className="mt-6">
                    <CalendarWidget appointments={appointments} />
                </div>
            ) : (
                <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] overflow-hidden">
                    {appointments.length === 0 ? (
                        <EmptyState
                            icon={CalendarDays}
                            title="No appointments yet"
                            description="Appointments will appear here once clients book through AI phone, website, or manual entry."
                        />
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-[var(--border)]">
                                    <thead className="bg-[#f6f8fa] dark:bg-[#161b22]">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-[11px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wider w-12">
                                                {/* Expand icon column */}
                                            </th>
                                            <th className="px-6 py-4 text-left text-[11px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                                Date/Time
                                            </th>
                                            <th className="px-6 py-4 text-left text-[11px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                                Client
                                            </th>
                                            <th className="px-6 py-4 text-left text-[11px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                                Treatment
                                            </th>
                                            <th className="px-6 py-4 text-left text-[11px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                                Provider
                                            </th>
                                            <th className="px-6 py-4 text-left text-[11px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                                Source
                                            </th>
                                            <th className="px-6 py-4 text-left text-[11px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-6 py-4 text-left text-[11px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                                Follow-Up
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-[var(--background)] divide-y divide-[var(--border)]">
                                        {paginatedAppointments.map((appt) => (
                                            <tr key={appt.id}>
                                                <td colSpan={8} className="p-0">
                                                    <div>
                                                        <div
                                                            className="flex hover:bg-gray-50 dark:hover:bg-[#161b22] cursor-pointer transition-colors"
                                                            onClick={() => setExpandedRow(expandedRow === appt.id ? null : appt.id)}
                                                        >
                                                            <div className="px-6 py-4 whitespace-nowrap w-12">
                                                                {expandedRow === appt.id ? (
                                                                    <ChevronDown className="w-5 h-5 text-[var(--foreground-muted)]" />
                                                                ) : (
                                                                    <ChevronRight className="w-5 h-5 text-[var(--foreground-muted)]" />
                                                                )}
                                                            </div>
                                                            <div className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground)] flex-1">
                                                                {appt.start_time ? format(new Date(appt.start_time), 'MMM d, yyyy h:mm a') : 'No date'}
                                                            </div>
                                                            <div className="px-6 py-4 whitespace-nowrap flex-1">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        router.push(`/clients/${appt.client_id}`);
                                                                    }}
                                                                    className="text-sm font-medium text-[var(--primary)] hover:underline"
                                                                >
                                                                    {appt.client_name}
                                                                </button>
                                                            </div>
                                                            <div className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground)] flex-1">
                                                                {appt.treatment_type}
                                                            </div>
                                                            <div className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground-muted)] flex-1">
                                                                {appt.provider_name || '-'}
                                                            </div>
                                                            <div className="px-6 py-4 whitespace-nowrap flex-1">
                                                                {getSourceBadge(appt.source)}
                                                            </div>
                                                            <div className="px-6 py-4 whitespace-nowrap flex-1">
                                                                {getStatusBadge(appt.status)}
                                                            </div>
                                                            <div className="px-6 py-4 whitespace-nowrap flex-1">
                                                                {getFollowUpBadge(appt.follow_up_status)}
                                                            </div>
                                                        </div>

                                                        {expandedRow === appt.id && (
                                                            <div className="px-6 py-4 bg-[#f6f8fa] dark:bg-[#161b22] border-t border-[var(--border)]">
                                                                <div className="space-y-4">
                                                                    {/* Follow-up Sequence Status */}
                                                                    <div>
                                                                        <h4 className="font-semibold text-[var(--foreground)] mb-3">Follow-up Sequence</h4>
                                                                        {appt.follow_up_messages.length === 0 ? (
                                                                            <p className="text-sm text-[var(--foreground-muted)]">No follow-ups scheduled</p>
                                                                        ) : (
                                                                            <div className="space-y-2">
                                                                                {appt.follow_up_messages.map((msg) => (
                                                                                    <div key={msg.id} className="flex items-start space-x-3 bg-[var(--background)] p-3 rounded-md border border-[var(--border)]">
                                                                                        <div className="flex-shrink-0 mt-1">
                                                                                            {msg.status === 'sent' ? (
                                                                                                <CheckCircle className="w-5 h-5 text-[var(--success)]" />
                                                                                            ) : msg.status === 'failed' ? (
                                                                                                <XCircle className="w-5 h-5 text-[var(--destructive)]" />
                                                                                            ) : (
                                                                                                <Clock className="w-5 h-5 text-yellow-500" />
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="flex-1">
                                                                                            <div className="flex items-center justify-between">
                                                                                                <span className="text-sm font-medium text-[var(--foreground)]">{msg.type}</span>
                                                                                                <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border border-transparent uppercase tracking-wide ${msg.status === 'sent' ? 'bg-[var(--success)]/10 text-[var(--success)]' :
                                                                                                    msg.status === 'failed' ? 'bg-[var(--destructive)]/10 text-[var(--destructive)]' :
                                                                                                        'bg-yellow-100/50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                                                                    }`}>
                                                                                                    {msg.status}
                                                                                                </span>
                                                                                            </div>
                                                                                            <p className="text-sm text-[var(--foreground-muted)] mt-1">{msg.content}</p>
                                                                                            <p className="text-xs text-[var(--foreground-muted)] mt-1">
                                                                                                {msg.status === 'pending' ? 'Scheduled for' : 'Sent'} {format(new Date(msg.sent_at), 'MMM d, h:mm a')}
                                                                                            </p>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Client Reply */}
                                                                    {appt.client_reply && (
                                                                        <div>
                                                                            <h4 className="font-semibold text-[var(--foreground)] mb-3">Client Reply</h4>
                                                                            <div className="bg-[var(--background)] p-4 rounded-md border border-[var(--border)]">
                                                                                <div className="flex items-start justify-between">
                                                                                    <div className="flex-1">
                                                                                        <p className="text-sm text-[var(--foreground)]">{appt.client_reply.message}</p>
                                                                                        <p className="text-xs text-[var(--foreground-muted)] mt-2">
                                                                                            {format(new Date(appt.client_reply.received_at), 'MMM d, yyyy h:mm a')}
                                                                                        </p>
                                                                                    </div>
                                                                                    <div className="flex items-center space-x-2 ml-4">
                                                                                        {getSentimentIcon(appt.client_reply.sentiment)}
                                                                                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border border-transparent uppercase tracking-wide ${appt.client_reply.sentiment === 'positive' ? 'bg-[var(--success)]/10 text-[var(--success)]' :
                                                                                            appt.client_reply.sentiment === 'negative' ? 'bg-[var(--destructive)]/10 text-[var(--destructive)]' :
                                                                                                'bg-[var(--foreground-muted)]/10 text-[var(--foreground-muted)]'
                                                                                            }`}>
                                                                                            {appt.client_reply.sentiment}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="bg-[#f6f8fa] dark:bg-[#161b22] px-6 py-3 flex items-center justify-between border-t border-[var(--border)]">
                                <div className="text-[13px] text-[var(--foreground-muted)]">
                                    Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, appointments.length)} of {appointments.length} appointments
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="px-3 py-1 text-sm border border-[var(--border)] rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--background-hover)] text-[var(--foreground)] transition-colors"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-[13px] font-medium text-[var(--foreground-muted)]">
                                        Page {page} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                        className="px-3 py-1 text-sm border border-[var(--border)] rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--background-hover)] text-[var(--foreground)] transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
