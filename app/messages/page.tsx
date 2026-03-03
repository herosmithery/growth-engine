'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Mail, Send, TrendingUp, ArrowUp, ArrowDown, X, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

import { supabase } from '../../lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { PageLoading } from '@/components/ui/page-loading';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/dashboard/StatCard';

interface Message {
    id: string;
    business_id: string;
    client_id: string;
    client_name: string;
    channel: 'sms' | 'email';
    direction: 'outbound' | 'inbound';
    type: 'confirmation' | 'followup' | 'review_request' | 'reactivation' | 'nurture';
    content: string;
    sent_at: string;
    status: 'sent' | 'delivered' | 'failed' | 'replied';
    sentiment?: 'positive' | 'negative' | 'neutral';
}

interface ConversationThread {
    client_id: string;
    client_name: string;
    messages: Message[];
}

export default function MessagesPage() {
    const { businessId, loading: authLoading } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedClient, setSelectedClient] = useState<ConversationThread | null>(null);
    const [filters, setFilters] = useState({
        channel: 'all',
        direction: 'all',
        type: 'all',
        search: '',
        startDate: '',
        endDate: '',
    });
    const [page, setPage] = useState(1);
    const itemsPerPage = 50;

    useEffect(() => {
        if (businessId) {
            loadMessages();
        }
    }, [businessId, filters, page]);

    async function loadMessages() {
        if (!businessId) return;

        try {
            setLoading(true);

            // Fetch real messages from Supabase
            const { data, error } = await supabase
                .from('messages')
                .select(`
                    id,
                    business_id,
                    client_id,
                    channel,
                    direction,
                    content,
                    status,
                    sent_at,
                    created_at,
                    clients (
                        first_name,
                        last_name
                    )
                `)
                .eq('business_id', businessId)
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }

            // Map DB data to UI format
            const realMessages: Message[] = (data || []).map((msg: any) => ({
                id: msg.id,
                business_id: msg.business_id,
                client_id: msg.client_id,
                client_name: msg.clients ? `${msg.clients.first_name} ${msg.clients.last_name}` : 'Unknown Client',
                channel: msg.channel || 'sms',
                direction: msg.direction || 'outbound',
                type: 'nurture', // Default type, could be refined if DB has it
                content: msg.content,
                sent_at: msg.sent_at || msg.created_at,
                status: msg.status || 'sent',
                sentiment: 'neutral' // Placeholder
            }));

            setMessages(realMessages);
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setLoading(false);
        }
    }

    async function loadConversation(clientId: string, clientName: string) {
        // Filter messages for this client
        const clientMessages = messages.filter(m => m.client_id === clientId);
        setSelectedClient({
            client_id: clientId,
            client_name: clientName,
            messages: clientMessages.sort((a, b) =>
                new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
            ),
        });
    }

    const totalSent = messages.filter(m => m.direction === 'outbound').length;
    const delivered = messages.filter(m => m.status === 'delivered' || m.status === 'replied').length;
    const replied = messages.filter(m => m.status === 'replied').length;
    const positiveSentiment = messages.filter(m => m.sentiment === 'positive').length;
    const inboundMessages = messages.filter(m => m.direction === 'inbound').length;

    const stats = {
        totalSent,
        deliveryRate: totalSent > 0 ? ((delivered / totalSent) * 100).toFixed(1) : '0.0',
        replyRate: totalSent > 0 ? ((replied / totalSent) * 100).toFixed(1) : '0.0',
        positiveSentimentRate: inboundMessages > 0 ? ((positiveSentiment / inboundMessages) * 100).toFixed(1) : '0.0',
    };

    const getTypeBadge = (type: Message['type']) => {
        const styles = {
            confirmation: 'bg-blue-100 text-blue-800',
            followup: 'bg-primary-light/30 text-primary-dark',
            review_request: 'bg-yellow-100 text-yellow-800',
            reactivation: 'bg-green-100 text-green-800',
            nurture: 'bg-pink-100 text-pink-800',
        };

        const labels = {
            confirmation: 'Confirmation',
            followup: 'Follow-Up',
            review_request: 'Review Request',
            reactivation: 'Reactivation',
            nurture: 'Nurture',
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[type]}`}>
                {labels[type]}
            </span>
        );
    };

    const getStatusBadge = (status: Message['status']) => {
        const styles = {
            sent: 'bg-gray-100 text-gray-800',
            delivered: 'bg-green-100 text-green-800',
            failed: 'bg-red-100 text-red-800',
            replied: 'bg-blue-100 text-blue-800',
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
                {status}
            </span>
        );
    };

    const getSentimentDot = (sentiment?: 'positive' | 'negative' | 'neutral') => {
        if (!sentiment) return null;
        const colors = {
            positive: 'bg-green-500',
            negative: 'bg-red-500',
            neutral: 'bg-gray-500',
        };
        return <div className={`w-2 h-2 rounded-full ${colors[sentiment]}`} />;
    };

    const filteredMessages = messages.filter(msg => {
        if (filters.channel !== 'all' && msg.channel !== filters.channel) return false;
        if (filters.direction !== 'all' && msg.direction !== filters.direction) return false;
        if (filters.type !== 'all' && msg.type !== filters.type) return false;
        if (filters.search && !msg.client_name.toLowerCase().includes(filters.search.toLowerCase()) &&
            !msg.content.toLowerCase().includes(filters.search.toLowerCase())) return false;
        return true;
    });

    const paginatedMessages = filteredMessages.slice((page - 1) * itemsPerPage, page * itemsPerPage);
    const totalPages = Math.ceil(filteredMessages.length / itemsPerPage);

    if (authLoading || loading) {
        return <PageLoading variant="skeleton" message="Loading messages..." />;
    }

    if (!businessId) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <AlertCircle className="w-10 h-10 text-amber-500" />
                </div>
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Welcome to Messages</h2>
                    <p className="text-gray-500 dark:text-gray-400">Please sign in to view your messages.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="Messages"
                description="Full message log - every SMS and email sent or received"
                icon={Mail}
                badge={
                    <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm font-medium">
                        {stats.replyRate}% reply rate
                    </span>
                }
            />

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    title="Total Sent"
                    value={stats.totalSent}
                    icon={Send}
                    variant="primary"
                    subtitle="This Month"
                />
                <StatCard
                    title="Delivery Rate"
                    value={`${stats.deliveryRate}%`}
                    icon={TrendingUp}
                    variant="sage"
                />
                <StatCard
                    title="Reply Rate"
                    value={`${stats.replyRate}%`}
                    icon={MessageSquare}
                    variant="lavender"
                />
                <StatCard
                    title="Positive Sentiment"
                    value={`${stats.positiveSentimentRate}%`}
                    icon={TrendingUp}
                    variant="gold"
                />
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                            <input
                                type="text"
                                placeholder="Search client or content..."
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                            <select
                                value={filters.channel}
                                onChange={(e) => setFilters({ ...filters, channel: e.target.value })}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            >
                                <option value="all">All Channels</option>
                                <option value="sms">SMS</option>
                                <option value="email">Email</option>
                            </select>
                            <select
                                value={filters.direction}
                                onChange={(e) => setFilters({ ...filters, direction: e.target.value })}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            >
                                <option value="all">All Directions</option>
                                <option value="outbound">Outbound</option>
                                <option value="inbound">Inbound</option>
                            </select>
                            <select
                                value={filters.type}
                                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            >
                                <option value="all">All Types</option>
                                <option value="confirmation">Confirmation</option>
                                <option value="followup">Follow-Up</option>
                                <option value="review_request">Review Request</option>
                                <option value="reactivation">Reactivation</option>
                                <option value="nurture">Nurture</option>
                            </select>
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Messages Table */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Date/Time
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Client
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Channel
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Direction
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Type
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Content
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Sentiment
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {paginatedMessages.map((msg) => (
                                    <tr key={msg.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {format(new Date(msg.sent_at), 'MMM d, h:mm a')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button
                                                onClick={() => loadConversation(msg.client_id, msg.client_name)}
                                                className="text-sm font-medium text-primary hover:text-primary-dark"
                                            >
                                                {msg.client_name}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {msg.channel === 'sms' ? (
                                                <MessageSquare className="w-5 h-5 text-blue-500" />
                                            ) : (
                                                <Mail className="w-5 h-5 text-primary" />
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {msg.direction === 'outbound' ? (
                                                <ArrowUp className="w-5 h-5 text-green-500" />
                                            ) : (
                                                <ArrowDown className="w-5 h-5 text-blue-500" />
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getTypeBadge(msg.type)}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate">
                                            {msg.content.substring(0, 80)}{msg.content.length > 80 ? '...' : ''}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(msg.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getSentimentDot(msg.sentiment)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
                            <div className="text-sm text-gray-700">
                                Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, filteredMessages.length)} of {filteredMessages.length} messages
                            </div>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                                >
                                    Previous
                                </button>
                                <span className="text-sm text-gray-700">
                                    Page {page} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Conversation Slide-Out Panel */}
                    {selectedClient && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-end z-50">
                            <div className="bg-white h-full w-full md:w-1/2 lg:w-1/3 shadow-xl flex flex-col">
                                {/* Panel Header */}
                                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">{selectedClient.client_name}</h2>
                                        <p className="text-sm text-gray-600">{selectedClient.messages.length} messages</p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedClient(null)}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                {/* Conversation Thread */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                    {selectedClient.messages.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className={`flex ${msg.direction === 'outbound' ? 'justify-start' : 'justify-end'}`}
                                        >
                                            <div className={`max-w-[80%] ${msg.direction === 'outbound' ? 'bg-blue-100' : 'bg-gray-100'
                                                } rounded-lg p-3`}>
                                                <div className="flex items-center space-x-2 mb-1">
                                                    {msg.channel === 'sms' ? (
                                                        <MessageSquare className="w-4 h-4 text-gray-600" />
                                                    ) : (
                                                        <Mail className="w-4 h-4 text-gray-600" />
                                                    )}
                                                    <span className="text-xs text-gray-600">
                                                        {format(new Date(msg.sent_at), 'MMM d, h:mm a')}
                                                    </span>
                                                    {msg.sentiment && getSentimentDot(msg.sentiment)}
                                                </div>
                                                <p className={`text-sm ${msg.direction === 'outbound' ? 'text-blue-900' : 'text-gray-900'
                                                    }`}>
                                                    {msg.content}
                                                </p>
                                                <div className="mt-2">
                                                    {getTypeBadge(msg.type)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
        </div>
    );
}
