'use client';

import { useEffect, useState } from 'react';
import { Users, TrendingUp, CheckCircle, XCircle, Phone, Mail, MessageSquare, Calendar, ArrowRight, AlertCircle, UserPlus, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { supabase, type Lead as LeadType } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { PageLoading } from '@/components/ui/page-loading';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/dashboard/StatCard';

interface LeadWithUI extends LeadType {
    name: string;
    interested_treatment?: string;
}

export default function LeadsPage() {
    const { businessId, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [leads, setLeads] = useState<LeadWithUI[]>([]);
    const [selectedLead, setSelectedLead] = useState<LeadWithUI | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [sourceFilter, setSourceFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (!authLoading && businessId) {
            loadLeads();
        } else if (!authLoading && !businessId) {
            setLoading(false);
        }
    }, [businessId, authLoading]);

    async function loadLeads() {
        try {
            setLoading(true);

            // Fetch natively from Supabase `agency_prospects`
            const { data, error } = await supabase
                .from('agency_prospects')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mappedLeads: LeadWithUI[] = data.map((lead: any) => ({
                ...lead,
                id: lead.id,
                first_name: lead.name,
                last_name: '',
                name: lead.name || 'Unknown',
                email: lead.email,
                phone: lead.phone || '',
                status: lead.status || 'new',
                created_at: lead.created_at,
                source: lead.niche || 'agency_scan',
                demoReady: !!lead.mockup_html,
                score: lead.website_score || 0
            }));

            setLeads(mappedLeads);
        } catch (error) {
            console.error('Error loading leads:', error);
        } finally {
            setLoading(false);
        }
    }

    async function convertToClient(lead: LeadWithUI) {
        setActionLoading(true);
        try {
            // Create a new client from the lead
            const { data: newClient, error: clientError } = await supabase
                .from('clients')
                .insert({
                    business_id: businessId,
                    first_name: lead.first_name,
                    last_name: lead.last_name,
                    phone: lead.phone,
                    email: lead.email,
                    source: lead.source,
                    notes: lead.notes,
                })
                .select()
                .single();

            if (clientError) throw clientError;

            // Update the lead status
            const { error: leadError } = await supabase
                .from('leads')
                .update({
                    status: 'converted',
                    converted_client_id: newClient.id,
                    converted_at: new Date().toISOString(),
                })
                .eq('id', lead.id);

            if (leadError) throw leadError;

            toast.success(`${lead.name} converted to client!`);
            setSelectedLead(null);
            loadLeads();
        } catch (error) {
            console.error('Error converting lead:', error);
            toast.error('Failed to convert lead');
        } finally {
            setActionLoading(false);
        }
    }

    async function markAsLost(leadId: string, reason?: string) {
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('leads')
                .update({
                    status: 'lost',
                    lost_reason: reason || 'Manually marked as lost',
                })
                .eq('id', leadId);

            if (error) throw error;

            toast.success('Lead marked as lost');
            setSelectedLead(null);
            loadLeads();
        } catch (error) {
            console.error('Error updating lead:', error);
            toast.error('Failed to update lead');
        } finally {
            setActionLoading(false);
        }
    }

    async function updateLeadStatus(leadId: string, newStatus: string) {
        try {
            const { error } = await supabase
                .from('leads')
                .update({
                    status: newStatus,
                    last_contacted_at: new Date().toISOString(),
                })
                .eq('id', leadId);

            if (error) throw error;
            toast.success(`Lead status updated to ${newStatus}`);
            loadLeads();
        } catch (error) {
            toast.error('Failed to update status');
        }
    }

    const stats = {
        total: leads.length,
        nurturing: leads.filter(l => l.status === 'nurturing').length,
        qualified: leads.filter(l => l.status === 'qualified').length,
        conversionRate: leads.length > 0
            ? Math.round((leads.filter(l => l.status === 'converted').length / leads.length) * 100)
            : 0,
    };

    const filteredLeads = leads.filter(lead => {
        if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
        if (sourceFilter !== 'all' && lead.source !== sourceFilter) return false;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                (lead.first_name || '').toLowerCase().includes(query) ||
                lead.last_name?.toLowerCase().includes(query) ||
                (lead.phone || '').includes(query) ||
                lead.email?.toLowerCase().includes(query)
            );
        }
        return true;
    });

    const getStatusBadge = (status: string) => {
        const badges: Record<string, string> = {
            new: 'bg-blue-100/50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            contacted: 'bg-indigo-100/50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
            nurturing: 'bg-[var(--primary-light)]/30 text-[var(--primary)]',
            qualified: 'bg-[var(--success-light)]/20 text-[var(--success)]',
            appointment_scheduled: 'bg-[var(--success-light)]/20 text-[var(--success)]',
            converted: 'bg-[var(--success-light)]/20 text-[var(--success)]',
            lost: 'bg-[var(--foreground-muted)]/10 text-[var(--foreground-muted)]',
        };
        const labels: Record<string, string> = {
            new: 'New',
            contacted: 'Contacted',
            nurturing: 'Nurturing',
            qualified: 'Qualified',
            appointment_scheduled: 'Appt Scheduled',
            converted: 'Converted',
            lost: 'Lost',
        };
        return (
            <span className={`px-2.5 py-1.5 rounded-md text-xs font-medium border border-transparent ${badges[status] || 'bg-[var(--foreground-muted)]/10 text-[var(--foreground-muted)]'}`}>
                {labels[status] || status}
            </span>
        );
    };

    const getSourceBadge = (source: string) => {
        const labels: Record<string, string> = {
            website_form: 'Website Form',
            website_chat: 'Website Chat',
            instagram_dm: 'Instagram',
            facebook: 'Facebook',
            manual: 'Manual',
        };
        return (
            <span className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-[var(--border)] bg-[#f6f8fa] dark:bg-[#161b22] text-[var(--foreground)]">
                {labels[source] || source}
            </span>
        );
    };


    if (authLoading || loading) {
        return <PageLoading variant="skeleton" message="Loading leads..." />;
    }

    if (!businessId) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <AlertCircle className="w-10 h-10 text-amber-500" />
                </div>
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Welcome to Leads</h2>
                    <p className="text-gray-500 dark:text-gray-400">Please sign in to view your leads.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="Leads"
                description="Track and nurture inbound leads from your website and social media"
                icon={UserPlus}
                badge={
                    <span className="px-2.5 py-1 rounded-md bg-[var(--success)]/10 text-[var(--success)] text-xs font-semibold border border-transparent">
                        {stats.conversionRate}% conversion
                    </span>
                }
            />

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    title="Total Leads"
                    value={stats.total}
                    icon={Users}
                    variant="primary"
                />
                <StatCard
                    title="Nurturing"
                    value={stats.nurturing}
                    icon={MessageSquare}
                    variant="lavender"
                />
                <StatCard
                    title="Qualified"
                    value={stats.qualified}
                    icon={CheckCircle}
                    variant="sage"
                />
                <StatCard
                    title="Conversion Rate"
                    value={`${stats.conversionRate}%`}
                    icon={TrendingUp}
                    variant="gold"
                />
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-[#0d1117] rounded-lg border border-[var(--border)] p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input
                        type="text"
                        placeholder="Search by name, phone, or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--background)] hover:bg-[var(--background-hover)] focus:bg-[var(--background)] focus:ring-1 focus:ring-[var(--primary)] focus:border-transparent transition-colors text-sm dark:text-gray-200"
                    />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--background)] hover:bg-[var(--background-hover)] focus:ring-1 focus:ring-[var(--primary)] focus:border-transparent transition-colors text-sm dark:text-gray-200"
                    >
                        <option value="all">All Statuses</option>
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="nurturing">Nurturing</option>
                        <option value="qualified">Qualified</option>
                        <option value="appointment_scheduled">Appt Scheduled</option>
                        <option value="converted">Converted</option>
                        <option value="lost">Lost</option>
                    </select>
                    <select
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value)}
                        className="px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--background)] hover:bg-[var(--background-hover)] focus:ring-1 focus:ring-[var(--primary)] focus:border-transparent transition-colors text-sm dark:text-gray-200"
                    >
                        <option value="all">All Sources</option>
                        <option value="website_form">Website Form</option>
                        <option value="website_chat">Website Chat</option>
                        <option value="instagram_dm">Instagram</option>
                        <option value="facebook">Facebook</option>
                        <option value="manual">Manual</option>
                    </select>
                    <div className="text-sm text-[var(--foreground-muted)] flex items-center justify-end">
                        Showing {filteredLeads.length} of {leads.length} leads
                    </div>
                </div>
            </div>

            {/* Leads Table */}
            <div className="bg-white dark:bg-[#0d1117] rounded-lg border border-[var(--border)] overflow-hidden">
                {filteredLeads.length === 0 ? (
                    <EmptyState
                        icon={UserPlus}
                        title="No leads found"
                        description={searchQuery || statusFilter !== 'all' || sourceFilter !== 'all'
                            ? "Try adjusting your filters"
                            : "You don't have any leads yet."}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-[var(--border)]">
                            <thead className="bg-[#f6f8fa] dark:bg-[#161b22]">
                                <tr>
                                    <th className="px-6 py-4 text-left text-[11px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th className="px-6 py-4 text-left text-[11px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                        Contact
                                    </th>
                                    <th className="px-6 py-4 text-left text-[11px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                        Interested In
                                    </th>
                                    <th className="px-6 py-4 text-left text-[11px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                        Source
                                    </th>
                                    <th className="px-6 py-4 text-left text-[11px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-4 text-left text-[11px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                        Last Contact
                                    </th>
                                    <th className="px-6 py-4 text-left text-[11px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                        Created
                                    </th>
                                    <th className="px-6 py-4 text-left text-[11px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-[#0d1117] divide-y divide-[var(--border)]">
                                {filteredLeads.map((lead) => (
                                    <tr
                                        key={lead.id}
                                        onClick={() => setSelectedLead(lead)}
                                        className="hover:bg-gray-50 dark:hover:bg-[#161b22] cursor-pointer transition-colors"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-[var(--primary)] hover:underline flex items-center gap-2">
                                                {lead.first_name} {lead.last_name || ''}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-[var(--foreground)] font-mono">{lead.phone}</div>
                                            {lead.email && <div className="text-xs text-[var(--foreground-muted)]">{lead.email}</div>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground)]">
                                            {lead.interested_treatment || '—'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getSourceBadge(lead.source || 'unknown')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(lead.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground-muted)]">
                                            {lead.last_contacted_at
                                                ? formatDistanceToNow(new Date(lead.last_contacted_at), { addSuffix: true })
                                                : 'Never'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground-muted)]">
                                            {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    convertToClient(lead);
                                                }}
                                                className="text-[var(--primary)] hover:text-[var(--primary-dark)] hover:underline font-medium"
                                            >
                                                Convert
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Lead Detail Panel */}
            {selectedLead && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-end z-50">
                    <div className="bg-white dark:bg-[#0d1117] h-full w-full md:w-2/3 lg:w-1/2 border-l border-[var(--border)] shadow-2xl flex flex-col transform transition-transform">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-[var(--border)] bg-[#f6f8fa] dark:bg-[#161b22] flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-semibold text-[var(--foreground)] tracking-tight">
                                    {selectedLead.first_name} {selectedLead.last_name || ''}
                                </h2>
                                <div className="flex items-center space-x-2 mt-2">
                                    {getStatusBadge(selectedLead.status)}
                                    {getSourceBadge(selectedLead.source || 'unknown')}
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedLead(null)}
                                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Contact Info */}
                            <div className="bg-[#f6f8fa] dark:bg-[#161b22] rounded-lg border border-[var(--border)] p-4">
                                <h3 className="font-semibold text-[var(--foreground)] mb-3 text-sm uppercase tracking-wider">Contact Information</h3>
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[var(--foreground-muted)] flex items-center"><Phone className="w-3.5 h-3.5 mr-2" /> Phone:</span>
                                        <span className="text-[var(--foreground)] font-mono">{selectedLead.phone}</span>
                                    </div>
                                    {selectedLead.email && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-[var(--foreground-muted)] flex items-center"><Mail className="w-3.5 h-3.5 mr-2" /> Email:</span>
                                            <span className="text-[var(--foreground)]">{selectedLead.email}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-[var(--border)]">
                                        <span className="text-[var(--foreground-muted)] flex items-center"><Calendar className="w-3.5 h-3.5 mr-2" /> Created:</span>
                                        <span className="text-[var(--foreground)] font-medium">{formatDistanceToNow(new Date(selectedLead.created_at), { addSuffix: true })}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Interested Treatment */}
                            {selectedLead.interested_treatment && (
                                <div>
                                    <h3 className="font-semibold text-[var(--foreground)] mb-3 text-sm uppercase tracking-wider">Interested In</h3>
                                    <p className="text-sm text-[var(--foreground)] bg-[#f6f8fa] dark:bg-[#161b22] border border-[var(--border)] rounded-md p-3">{selectedLead.interested_treatment}</p>
                                </div>
                            )}

                            {/* Lead Status Timeline */}
                            <div>
                                <h3 className="font-semibold text-[var(--foreground)] mb-3 text-sm uppercase tracking-wider">Lead Status</h3>
                                <div className="bg-white dark:bg-[#0d1117] border border-[var(--border)] rounded-md p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-[var(--foreground-muted)]">Current Status</span>
                                        {getStatusBadge(selectedLead.status)}
                                    </div>
                                    {selectedLead.last_contacted_at && (
                                        <div className="flex items-center justify-between text-sm mt-3 pt-3 border-t border-[var(--border)]">
                                            <span className="text-[var(--foreground-muted)]">Last Contacted</span>
                                            <span className="text-[var(--foreground)] font-medium">
                                                {formatDistanceToNow(new Date(selectedLead.last_contacted_at), { addSuffix: true })}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Notes */}
                            {selectedLead.notes && (
                                <div>
                                    <h3 className="font-semibold text-[var(--foreground)] mb-3 text-sm uppercase tracking-wider">Notes</h3>
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-md p-3 leading-relaxed">
                                        {selectedLead.notes}
                                    </p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="pt-4 border-t border-[var(--border)]">
                                <h3 className="font-semibold text-[var(--foreground)] mb-3 text-sm uppercase tracking-wider">Quick Actions</h3>
                                <div className="space-y-2">
                                    {(selectedLead as any).demoReady && (
                                        <a href={`http://localhost:4242/api/lead/${selectedLead.id}/preview.html`} target="_blank" rel="noreferrer"
                                            className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-md hover:from-purple-700 hover:to-blue-700 transition-colors font-medium flex items-center justify-center space-x-2 text-sm shadow-sm"
                                        >
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            View Generated Mockup
                                        </a>
                                    )}
                                    <button
                                        onClick={() => convertToClient(selectedLead)}
                                        disabled={actionLoading}
                                        className="w-full px-4 py-2.5 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-dark)] transition-colors font-medium flex items-center justify-center space-x-2 text-sm disabled:opacity-50 shadow-sm border border-transparent hover:border-black/10 dark:hover:border-white/10"
                                    >
                                        <span>Convert to Client</span>
                                        <ArrowRight className="w-4 h-4 ml-1" />
                                    </button>
                                    <button className="w-full px-4 py-2.5 bg-[#f6f8fa] dark:bg-[#161b22] border border-[var(--border)] rounded-md text-[var(--foreground)] hover:border-gray-400 dark:hover:border-gray-500 transition-colors font-medium flex items-center justify-center text-sm shadow-sm">
                                        <MessageSquare className="w-4 h-4 mr-2 text-[var(--foreground-muted)]" />
                                        Send Manual Message
                                    </button>
                                    <button
                                        onClick={() => markAsLost(selectedLead.id)}
                                        disabled={actionLoading}
                                        className="w-full px-4 py-2.5 border border-[var(--destructive)]/30 text-[var(--destructive)] rounded-md hover:bg-[var(--destructive-light)]/10 transition-colors font-medium flex items-center justify-center text-sm disabled:opacity-50"
                                    >
                                        Mark as Lost
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
