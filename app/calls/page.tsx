'use client';

import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';
import Script from 'next/script';

import { Phone, Clock, CheckCircle, PhoneCall, X, AlertCircle, Bot, Sparkles, Mic } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { PageLoading } from '@/components/ui/page-loading';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/dashboard/StatCard';

interface Call {
    id: string;
    caller_name: string | null;
    caller_phone: string;
    call_time: string;
    duration: number;
    treatment_requested: string | null;
    outcome: 'booked' | 'callback_requested' | 'info_only' | 'dropped';
    transcript: Array<{ role: 'ai' | 'caller'; message: string; timestamp: string }>;
    summary: string | null;
    recording_url: string | null;
    appointment_id: string | null;
}

export default function CallsPage() {
    const { businessId, loading: authLoading } = useAuth();
    const [calls, setCalls] = useState<Call[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCall, setSelectedCall] = useState<Call | null>(null);
    const [filters, setFilters] = useState({
        outcome: 'all',
        search: '',
        startDate: '',
        endDate: '',
    });
    const [syncing, setSyncing] = useState(false);
    const [page, setPage] = useState(1);
    const itemsPerPage = 20;

    useEffect(() => {
        if (!authLoading && businessId) {
            loadCalls();
        } else if (!authLoading && !businessId) {
            setLoading(false);
        }
    }, [businessId, authLoading, filters, page]);

    async function loadCalls() {
        if (!businessId) return;

        try {
            setLoading(true);

            const { data, error } = await supabase
                .from('call_logs')
                .select(`
                    id,
                    created_at,
                    caller_phone,
                    caller_name,
                    requested_treatment,
                    duration_seconds,
                    outcome,
                    summary,
                    transcript,
                    recording_url
                `)
                .eq('business_id', businessId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mappedCalls: Call[] = (data || []).map((call: any) => ({
                id: call.id,
                caller_name: call.caller_name || 'Unknown Caller',
                caller_phone: call.caller_phone || 'Unknown',
                call_time: call.created_at,
                duration: call.duration_seconds || 0,
                treatment_requested: call.requested_treatment || null,
                outcome: (call.outcome as Call['outcome']) || 'info_only',
                transcript: call.transcript ?
                    (typeof call.transcript === 'string' ? JSON.parse(call.transcript) : call.transcript)
                    : [],
                summary: call.summary,
                recording_url: call.recording_url,
                appointment_id: null
            }));

            setCalls(mappedCalls);
        } catch (error) {
            console.error('Error loading calls:', error);
        } finally {
            setLoading(false);
        }
    }

    const stats = {
        totalCalls: calls.length,
        booked: calls.filter(c => c.outcome === 'booked').length,
        callbacks: calls.filter(c => c.outcome === 'callback_requested').length,
        avgDuration: Math.round(calls.reduce((acc, c) => acc + c.duration, 0) / calls.length) || 0,
    };

    const getOutcomeBadge = (outcome: Call['outcome']) => {
        const styles = {
            booked: 'bg-green-100 text-green-800',
            callback_requested: 'bg-amber-100 text-amber-800',
            info_only: 'bg-gray-100 text-gray-800',
            dropped: 'bg-red-100 text-red-800',
        };

        const labels = {
            booked: 'Booked',
            callback_requested: 'Callback',
            info_only: 'Info Only',
            dropped: 'Dropped',
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[outcome]}`}>
                {labels[outcome]}
            </span>
        );
    };

    const formatDuration = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    const filteredCalls = calls.filter(call => {
        if (filters.outcome !== 'all' && call.outcome !== filters.outcome) return false;
        if (filters.search && !call.caller_name?.toLowerCase().includes(filters.search.toLowerCase()) &&
            !call.caller_phone.includes(filters.search)) return false;
        return true;
    });

    const paginatedCalls = filteredCalls.slice((page - 1) * itemsPerPage, page * itemsPerPage);
    const totalPages = Math.ceil(filteredCalls.length / itemsPerPage);

    if (authLoading || loading) {
        return <PageLoading variant="skeleton" message="Loading AI call logs..." />;
    }

    if (!businessId) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <AlertCircle className="w-10 h-10 text-amber-500" />
                </div>
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Welcome to AI Calls</h2>
                    <p className="text-gray-500 dark:text-gray-400">Please sign in to view call logs.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="AI Calls"
                description="AI phone agent performance and call history"
                icon={Bot}
                badge={
                    stats.totalCalls > 0 ? (
                        <span className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            {stats.booked} booked
                        </span>
                    ) : null
                }
            />

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    title="Total Calls"
                    value={stats.totalCalls}
                    icon={Phone}
                    variant="primary"
                />
                <StatCard
                    title="Appointments Booked"
                    value={stats.booked}
                    icon={CheckCircle}
                    variant="sage"
                />
                <StatCard
                    title="Callback Requests"
                    value={stats.callbacks}
                    icon={PhoneCall}
                    variant="gold"
                />
                <StatCard
                    title="Avg Duration"
                    value={formatDuration(stats.avgDuration)}
                    icon={Clock}
                    variant="lavender"
                />
            </div>

            {/* Aria Live Widget */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-purple-600/20 flex items-center justify-center">
                            <Mic className="w-4 h-4 text-purple-400" />
                        </div>
                        <div>
                            <p className="font-semibold text-white text-sm">Aria — AI Voice Agent</p>
                            <p className="text-xs text-gray-400">Live on +1 (910) 541-8383</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            Active
                        </span>
                        <button
                            onClick={async () => {
                                setSyncing(true);
                                await fetch('/api/elevenlabs/sync-calls', { method: 'POST' });
                                await loadCalls();
                                setSyncing(false);
                            }}
                            disabled={syncing}
                            className="px-3 py-1.5 text-xs font-medium bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                        >
                            {syncing ? 'Syncing…' : 'Sync Calls'}
                        </button>
                        <button
                            onClick={async () => {
                                await fetch('/api/demo/seed-calls', { method: 'POST' });
                                loadCalls();
                            }}
                            className="px-3 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors"
                        >
                            Load Demo Data
                        </button>
                    </div>
                </div>
                <div className="flex justify-center">
                    {/* @ts-expect-error Custom Web Component from ElevenLabs */}
                    <elevenlabs-convai agent-id="agent_5101kjkx6dh8e3q8v6hxry0s0cyv" />
                </div>
            </div>
            <Script src="https://elevenlabs.io/convai-widget/index.js" strategy="lazyOnload" />

            {/* Filter Bar */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input
                        type="text"
                        placeholder="Search by name or phone..."
                        value={filters.search}
                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                        className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-[#9B7E6B] focus:border-transparent dark:text-white"
                    />
                    <select
                        value={filters.outcome}
                        onChange={(e) => setFilters({ ...filters, outcome: e.target.value })}
                        className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-[#9B7E6B] focus:border-transparent dark:text-white"
                    >
                        <option value="all">All Outcomes</option>
                        <option value="booked">Booked</option>
                        <option value="callback_requested">Callback Requested</option>
                        <option value="info_only">Info Only</option>
                        <option value="dropped">Dropped</option>
                    </select>
                    <input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                        className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-[#9B7E6B] focus:border-transparent dark:text-white"
                    />
                    <input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                        className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-[#9B7E6B] focus:border-transparent dark:text-white"
                    />
                </div>
            </div>

            {/* Calls Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Date/Time
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Caller
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Duration
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Treatment
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Outcome
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {paginatedCalls.map((call) => (
                                <tr key={call.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                        {formatDistanceToNow(new Date(call.call_time), { addSuffix: true })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                            {call.caller_name || 'Unknown'}
                                        </div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">{call.caller_phone}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {formatDuration(call.duration)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {call.treatment_requested || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getOutcomeBadge(call.outcome)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <button
                                            onClick={() => setSelectedCall(call)}
                                            className="text-[#9B7E6B] dark:text-[#D4C4B5] hover:underline font-medium"
                                        >
                                            View Transcript
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                        Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, filteredCalls.length)} of {filteredCalls.length} calls
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                            Page {page} of {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Transcript Modal */}
            {selectedCall && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Call Transcript</h2>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    {selectedCall.caller_name || selectedCall.caller_phone} • {format(new Date(selectedCall.call_time), 'MMM d, yyyy h:mm a')}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedCall(null)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Call Summary */}
                            {selectedCall.summary && (
                                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 rounded-lg p-4">
                                    <h3 className="font-semibold text-purple-900 dark:text-purple-300 mb-2">Call Summary</h3>
                                    <p className="text-purple-800 dark:text-purple-200">{selectedCall.summary}</p>
                                </div>
                            )}

                            {/* Call Metadata */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Duration</p>
                                    <p className="font-medium text-gray-900 dark:text-white">{formatDuration(selectedCall.duration)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Outcome</p>
                                    <div className="mt-1">{getOutcomeBadge(selectedCall.outcome)}</div>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Phone</p>
                                    <p className="font-medium text-gray-900 dark:text-white">{selectedCall.caller_phone}</p>
                                </div>
                            </div>

                            {/* Transcript */}
                            <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Conversation</h3>
                                <div className="space-y-3">
                                    {selectedCall.transcript.map((msg, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}
                                        >
                                            <div className={`max-w-[70%] ${msg.role === 'ai' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700'} rounded-lg p-3`}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`text-xs font-medium ${msg.role === 'ai' ? 'text-blue-900 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
                                                        {msg.role === 'ai' ? 'AI Assistant' : 'Caller'}
                                                    </span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">{msg.timestamp}</span>
                                                </div>
                                                <p className={`text-sm ${msg.role === 'ai' ? 'text-blue-800 dark:text-blue-200' : 'text-gray-800 dark:text-gray-200'}`}>
                                                    {msg.message}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Appointment Details */}
                            {selectedCall.appointment_id && (
                                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-lg p-4">
                                    <h3 className="font-semibold text-green-900 dark:text-green-300 mb-2">Appointment Booked</h3>
                                    <p className="text-green-800 dark:text-green-200">Appointment ID: {selectedCall.appointment_id}</p>
                                    <p className="text-green-800 dark:text-green-200">Treatment: {selectedCall.treatment_requested}</p>
                                </div>
                            )}

                            {/* Audio Player */}
                            {selectedCall.recording_url && (
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Recording</h3>
                                    <audio controls className="w-full">
                                        <source src={selectedCall.recording_url} type="audio/mpeg" />
                                        Your browser does not support the audio element.
                                    </audio>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
