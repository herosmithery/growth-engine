'use client';

import { useEffect, useState } from 'react';
import { Users, UserCheck, AlertCircle, UserX, Search, X, Calendar, MessageSquare, DollarSign, Send, Clock, Sparkles } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { PageLoading } from '@/components/ui/page-loading';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/dashboard/StatCard';

interface ClientWithStatus {
    id: string;
    business_id?: string;
    first_name: string;
    last_name?: string;
    phone?: string;
    email?: string;
    last_visit_at?: string;
    total_visits?: number;
    lifetime_value?: number;
    status: 'active' | 'at_risk' | 'lapsed';
    name: string;
    [key: string]: any;
}

interface ClientDetail extends ClientWithStatus {
    appointments: Array<{
        id: string;
        date: string;
        treatment: string;
        amount: number;
        status: string;
    }>;
    messages: Array<{
        id: string;
        direction: 'inbound' | 'outbound';
        content: string;
        sent_at: string;
        channel: 'sms' | 'email';
    }>;
    active_sequences: Array<{
        id: string;
        type: string;
        status: string;
        next_message: string;
    }>;
}

const FALLBACK_BUSINESS_ID = 'ab445992-80fd-46d0-bec0-138a86e1d607';

export default function ClientsPage() {
    const { businessId: authBusinessId, isAdmin, loading: authLoading } = useAuth();
    const [businessId, setBusinessId] = useState<string | null>(null);
    const [clients, setClients] = useState<ClientWithStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedClient, setSelectedClient] = useState<ClientDetail | null>(null);
    const [filters, setFilters] = useState({
        status: 'all',
        search: '',
        sortBy: 'last_visit' as 'last_visit' | 'total_visits' | 'name',
    });
    const [messageText, setMessageText] = useState('');
    const [sending, setSending] = useState(false);
    const [showMessageInput, setShowMessageInput] = useState(false);

    useEffect(() => {
        if (!authLoading) {
            const urlParams = new URLSearchParams(window.location.search);
            const queryBusinessId = urlParams.get('businessId');

            if (isAdmin && queryBusinessId) {
                setBusinessId(queryBusinessId);
            } else {
                setBusinessId(authBusinessId || FALLBACK_BUSINESS_ID);
            }
        }
    }, [authLoading, authBusinessId, isAdmin]);

    useEffect(() => {
        if (businessId) {
            loadClients();
        }
    }, [businessId]);

    function getClientStatus(lastVisit: string | null | undefined): 'active' | 'at_risk' | 'lapsed' {
        if (!lastVisit) return 'lapsed';
        const now = new Date();
        const visitDate = new Date(lastVisit);
        const daysSinceVisit = Math.floor((now.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceVisit <= 90) return 'active';
        if (daysSinceVisit <= 180) return 'at_risk';
        return 'lapsed';
    }

    async function loadClients() {
        if (!businessId) return;
        try {
            setLoading(true);
            const res = await fetch(`/api/clients?business_id=${businessId}`);
            if (!res.ok) throw new Error('Failed to load clients');
            const data = await res.json();
            const mappedClients: ClientWithStatus[] = (data.clients || []).map((client: any) => ({
                ...client,
                name: `${client.first_name} ${client.last_name || ''}`.trim(),
                status: getClientStatus(client.last_visit_at),
            }));
            setClients(mappedClients);
        } catch (error) {
            console.error('Error loading clients:', error);
        } finally {
            setLoading(false);
        }
    }

    async function loadClientDetail(clientId: string) {
        const client = clients.find(c => c.id === clientId);
        if (!client || !businessId) return;

        try {
            const res = await fetch(`/api/clients?business_id=${businessId}&client_id=${clientId}`);
            if (!res.ok) throw new Error('Failed to load client detail');
            const { appointments, messages, followUps } = await res.json();

            const detailData: ClientDetail = {
                ...client,
                appointments: (appointments || []).map((apt: any) => ({
                    id: apt.id,
                    date: apt.start_time,
                    treatment: apt.treatment_type,
                    amount: apt.amount || 0,
                    status: apt.status,
                })),
                messages: (messages || []).map((msg: any) => ({
                    id: msg.id,
                    direction: msg.direction,
                    content: msg.content,
                    sent_at: msg.created_at,
                    channel: msg.channel,
                })),
                active_sequences: (followUps || []).map((fu: any) => ({
                    id: fu.id,
                    type: fu.type,
                    status: fu.status,
                    next_message: fu.scheduled_for,
                })),
            };

            setSelectedClient(detailData);
        } catch (error) {
            console.error('Error loading client detail:', error);
        }
    }

    async function sendMessage(clientId: string, phone: string | undefined) {
        if (!messageText.trim()) {
            toast.error('Please enter a message');
            return;
        }
        if (!phone) {
            toast.error('Client has no phone number');
            return;
        }

        setSending(true);
        try {
            // Send via Twilio + log to Supabase
            const res = await fetch('/api/messages/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel: 'sms',
                    to: phone,
                    content: messageText,
                    clientId,
                    messageType: 'nurture',
                    businessId,
                }),
            });

            if (!res.ok) throw new Error(await res.text());

            toast.success('SMS sent successfully');
            setMessageText('');
            setShowMessageInput(false);

            if (selectedClient) {
                loadClientDetail(selectedClient.id);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Failed to send SMS');
        } finally {
            setSending(false);
        }
    }

    const stats = {
        total: clients.length,
        active: clients.filter(c => c.status === 'active').length,
        atRisk: clients.filter(c => c.status === 'at_risk').length,
        lapsed: clients.filter(c => c.status === 'lapsed').length,
    };

    const getStatusBadge = (status: ClientWithStatus['status']) => {
        const styles = {
            active: 'bg-green-100 text-green-800',
            at_risk: 'bg-amber-100 text-amber-800',
            lapsed: 'bg-red-100 text-red-800',
        };

        const labels = {
            active: 'Active',
            at_risk: 'At Risk',
            lapsed: 'Lapsed',
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
                {labels[status]}
            </span>
        );
    };

    const filteredClients = clients.filter(client => {
        if (filters.status !== 'all' && client.status !== filters.status) return false;
        if (filters.search) {
            const search = filters.search.toLowerCase();
            return (
                client.name.toLowerCase().includes(search) ||
                client.phone?.includes(search) ||
                client.email?.toLowerCase().includes(search)
            );
        }
        return true;
    });

    const sortedClients = [...filteredClients].sort((a, b) => {
        if (filters.sortBy === 'last_visit') {
            const aDate = a.last_visit_at ? new Date(a.last_visit_at).getTime() : 0;
            const bDate = b.last_visit_at ? new Date(b.last_visit_at).getTime() : 0;
            return bDate - aDate;
        } else if (filters.sortBy === 'total_visits') {
            return (b.total_visits || 0) - (a.total_visits || 0);
        } else {
            return a.name.localeCompare(b.name);
        }
    });

    if (authLoading || loading) {
        return <PageLoading variant="skeleton" message="Loading clients..." />;
    }

    if (!businessId) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <AlertCircle className="w-10 h-10 text-amber-500" />
                </div>
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Welcome to Clients</h2>
                    <p className="text-gray-500 dark:text-gray-400">Please sign in to view your client database.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="Clients"
                description="Manage your client database and engagement"
                icon={Users}
                badge={
                    <span className="px-3 py-1 rounded-md bg-[var(--foreground-muted)]/10 text-[var(--foreground-muted)] text-sm font-medium border border-transparent">
                        {stats.total} total
                    </span>
                }
            />

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    title="Total Clients"
                    value={stats.total}
                    icon={Users}
                    variant="primary"
                />
                <StatCard
                    title="Active"
                    value={stats.active}
                    icon={UserCheck}
                    variant="sage"
                    subtitle="Last 90 days"
                />
                <StatCard
                    title="At Risk"
                    value={stats.atRisk}
                    icon={AlertCircle}
                    variant="gold"
                    subtitle="90-180 days"
                />
                <StatCard
                    title="Lapsed"
                    value={stats.lapsed}
                    icon={UserX}
                    variant="rose"
                    subtitle="180+ days"
                />
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-[#0d1117] rounded-lg border border-[var(--border)] p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, phone, or email..."
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                            className="w-full pl-9 pr-4 py-2 border border-[var(--border)] rounded-md bg-[var(--background)] hover:bg-[var(--background-hover)] focus:bg-[var(--background)] focus:ring-1 focus:ring-[var(--primary)] focus:border-transparent transition-colors text-sm dark:text-gray-200"
                        />
                    </div>
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        className="px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--background)] hover:bg-[var(--background-hover)] focus:ring-1 focus:ring-[var(--primary)] focus:border-transparent transition-colors text-sm dark:text-gray-200"
                    >
                        <option value="all">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="at_risk">At Risk</option>
                        <option value="lapsed">Lapsed</option>
                    </select>
                    <select
                        value={filters.sortBy}
                        onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as any })}
                        className="px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--background)] hover:bg-[var(--background-hover)] focus:ring-1 focus:ring-[var(--primary)] focus:border-transparent transition-colors text-sm dark:text-gray-200"
                    >
                        <option value="last_visit">Sort by Last Visit</option>
                        <option value="total_visits">Sort by Total Visits</option>
                        <option value="name">Sort by Name</option>
                    </select>
                </div>
            </div>

            {/* Clients Table */}
            <div className="bg-white dark:bg-[#0d1117] rounded-lg border border-[var(--border)] overflow-hidden">
                {clients.length === 0 ? (
                    <EmptyState
                        icon={Users}
                        title="No clients yet"
                        description="Your client database is empty. Clients will appear here once they book appointments or are added manually."
                        action={{
                            label: "Add Client",
                            onClick: () => toast.info("Add client feature coming soon!")
                        }}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-[var(--border)]">
                            <thead className="bg-[#f6f8fa] dark:bg-[#161b22]">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                        Client Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                        Phone
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                        Email
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                        Last Visit
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                        Total Visits
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                        Revenue
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-[#0d1117] divide-y divide-[var(--border)]">
                                {sortedClients.map((client) => (
                                    <tr
                                        key={client.id}
                                        onClick={() => loadClientDetail(client.id)}
                                        className="hover:bg-gray-50 dark:hover:bg-[#161b22] cursor-pointer transition-colors"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-[var(--primary)] hover:underline">
                                                {client.name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground-muted)] font-mono">
                                            {client.phone || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground-muted)]">
                                            {client.email || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground-muted)]">
                                            {client.last_visit_at ? formatDistanceToNow(new Date(client.last_visit_at), { addSuffix: true }) : 'Never'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground)] font-medium">
                                            {client.total_visits || 0}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(client.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--success)] font-medium">
                                            ${(client.total_revenue || 0).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Client Detail Panel */}
            {selectedClient && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-end z-50">
                    <div className="bg-white dark:bg-[#0d1117] h-full w-full md:w-2/3 lg:w-1/2 border-l border-[var(--border)] shadow-2xl flex flex-col transform transition-transform">
                        {/* Panel Header */}
                        <div className="px-6 py-4 border-b border-[var(--border)] bg-[#f6f8fa] dark:bg-[#161b22] flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-semibold text-[var(--foreground)] tracking-tight">{selectedClient.name}</h2>
                                <div className="flex items-center space-x-2 mt-2">
                                    {getStatusBadge(selectedClient.status)}
                                    <span className="text-sm text-[var(--foreground-muted)]">{selectedClient.total_visits || 0} visits</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedClient(null)}
                                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Panel Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Client Info Card */}
                            <div className="bg-[#f6f8fa] dark:bg-[#161b22] rounded-lg border border-[var(--border)] p-4">
                                <h3 className="font-semibold text-[var(--foreground)] mb-3 text-sm uppercase tracking-wider">Contact Information</h3>
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[var(--foreground-muted)]">Phone:</span>
                                        <span className="text-[var(--foreground)] font-mono">{selectedClient.phone || '-'}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[var(--foreground-muted)]">Email:</span>
                                        <span className="text-[var(--foreground)]">{selectedClient.email || '-'}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[var(--foreground-muted)]">Last Visit:</span>
                                        <span className="text-[var(--foreground)]">
                                            {selectedClient.last_visit_at ? formatDistanceToNow(new Date(selectedClient.last_visit_at), { addSuffix: true }) : 'Never'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-[var(--border)]">
                                        <span className="text-[var(--foreground-muted)]">Lifetime Value:</span>
                                        <span className="text-[var(--success)] font-semibold">${(selectedClient.total_revenue || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Appointment History */}
                            <div>
                                <h3 className="font-semibold text-[var(--foreground)] mb-3 flex items-center text-sm uppercase tracking-wider">
                                    <Calendar className="w-4 h-4 mr-2" />
                                    Recent Appointments
                                </h3>
                                {selectedClient.appointments.length === 0 ? (
                                    <p className="text-sm text-[var(--foreground-muted)]">No appointments found</p>
                                ) : (
                                    <div className="space-y-2">
                                        {selectedClient.appointments.map((apt) => (
                                            <div key={apt.id} className="bg-white dark:bg-[#0d1117] border border-[var(--border)] rounded-md p-3 hover:border-[var(--primary)] transition-colors">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-medium text-[var(--foreground)] text-sm">{apt.treatment}</span>
                                                    <span className="text-[var(--success)] font-medium text-sm">${apt.amount}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs text-[var(--foreground-muted)]">
                                                    <span>{format(new Date(apt.date), 'MMM d, yyyy')}</span>
                                                    <span className={`px-2 py-0.5 rounded-sm border ${apt.status.toLowerCase() === 'completed' ? 'border-[var(--success)]/20 text-[var(--success)] bg-[var(--success-light)]/10' :
                                                            apt.status.toLowerCase() === 'cancelled' ? 'border-[var(--destructive)]/20 text-[var(--destructive)] bg-[var(--destructive-light)]/10' :
                                                                'border-gray-500/20 text-gray-500 bg-gray-500/10'
                                                        }`}>
                                                        {apt.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Message Timeline */}
                            <div>
                                <h3 className="font-semibold text-[var(--foreground)] mb-3 flex items-center text-sm uppercase tracking-wider">
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                    Message Timeline
                                </h3>
                                {selectedClient.messages.length === 0 ? (
                                    <p className="text-sm text-[var(--foreground-muted)]">No messages found</p>
                                ) : (
                                    <div className="space-y-3">
                                        {selectedClient.messages.map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`flex ${msg.direction === 'outbound' ? 'justify-start' : 'justify-end'}`}
                                            >
                                                <div className={`max-w-[85%] ${msg.direction === 'outbound' ? 'bg-[#f6f8fa] dark:bg-[#161b22] border border-[var(--border)]' : 'bg-[var(--primary)] text-white'
                                                    } rounded-lg p-3`}>
                                                    <p className={`text-sm ${msg.direction === 'outbound' ? 'text-[var(--foreground)]' : 'text-white'}`}>{msg.content}</p>
                                                    <p className={`text-xs mt-1.5 ${msg.direction === 'outbound' ? 'text-[var(--foreground-muted)]' : 'text-white/70'}`}>
                                                        {format(new Date(msg.sent_at), 'MMM d, h:mm a')}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Follow-Up Status */}
                            <div>
                                <h3 className="font-semibold text-[var(--foreground)] mb-3 flex items-center text-sm uppercase tracking-wider">
                                    <Clock className="w-4 h-4 mr-2" />
                                    Active Follow-Up Sequences
                                </h3>
                                {selectedClient.active_sequences.length > 0 ? (
                                    <div className="space-y-2">
                                        {selectedClient.active_sequences.map((seq) => (
                                            <div key={seq.id} className="bg-white dark:bg-[#0d1117] border border-[var(--border)] rounded-md p-3">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-medium text-[var(--foreground)] text-sm">{seq.type}</span>
                                                    <span className="px-2 py-0.5 border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-sm text-xs">
                                                        {seq.status}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-[var(--foreground-muted)] mt-2">
                                                    Next message: {format(new Date(seq.next_message), 'MMM d, h:mm a')}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-[var(--foreground-muted)] bg-[#f6f8fa] dark:bg-[#161b22] border border-[var(--border)] p-3 rounded-md">No active sequences</p>
                                )}
                            </div>

                            {/* Quick Actions */}
                            <div className="pt-4 border-t border-[var(--border)]">
                                <h3 className="font-semibold text-[var(--foreground)] mb-3 text-sm uppercase tracking-wider">Actions</h3>
                                <div className="grid grid-cols-1 gap-2">
                                    {showMessageInput ? (
                                        <div className="space-y-2">
                                            <textarea
                                                value={messageText}
                                                onChange={(e) => setMessageText(e.target.value)}
                                                placeholder="Type your message..."
                                                className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--background)] text-sm text-[var(--foreground)] focus:ring-1 focus:ring-[var(--primary)] min-h-[100px] resize-y"
                                                rows={3}
                                            />
                                            <div className="flex justify-end space-x-2">
                                                <button
                                                    onClick={() => { setShowMessageInput(false); setMessageText(''); }}
                                                    className="px-4 py-2 border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] hover:bg-[#f6f8fa] dark:hover:bg-[#161b22] transition-colors font-medium"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => sendMessage(selectedClient.id, selectedClient.phone)}
                                                    disabled={sending}
                                                    className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-dark)] disabled:opacity-50 transition-colors font-medium flex items-center"
                                                >
                                                    {sending ? 'Sending...' : 'Send Message'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setShowMessageInput(true)}
                                            className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#f6f8fa] dark:bg-[#161b22] border border-[var(--border)] text-[var(--foreground)] rounded-md hover:border-gray-400 dark:hover:border-gray-500 transition-colors text-sm font-medium"
                                        >
                                            <Send className="w-4 h-4 text-[var(--foreground-muted)]" />
                                            <span>Send Manual Message</span>
                                        </button>
                                    )}
                                    <button className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#f6f8fa] dark:bg-[#161b22] border border-[var(--border)] text-[var(--foreground)] rounded-md hover:border-gray-400 dark:hover:border-gray-500 transition-colors text-sm font-medium">
                                        <Clock className="w-4 h-4 text-[var(--foreground-muted)]" />
                                        <span>Schedule Follow-Up</span>
                                    </button>
                                    <button className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#f6f8fa] dark:bg-[#161b22] border border-[var(--border)] text-[var(--foreground)] rounded-md hover:border-gray-400 dark:hover:border-gray-500 transition-colors text-sm font-medium cursor-not-allowed opacity-50">
                                        <Users className="w-4 h-4 text-[var(--foreground-muted)]" />
                                        <span>Add to Campaign (Coming Soon)</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
