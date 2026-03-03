'use client';

import { useEffect, useState } from 'react';
import { Megaphone, Send, Calendar, TrendingUp, Plus, Play, Pause, Eye, X, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase, type Campaign } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/dashboard/StatCard';
interface CampaignWithMetrics extends Campaign {
    metrics: {
        messages_sent: number;
        replies: number;
        bookings_generated: number;
    };
}

export default function CampaignsPage() {
    const { businessId, loading: authLoading } = useAuth();
    const [campaigns, setCampaigns] = useState<CampaignWithMetrics[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedCampaign, setSelectedCampaign] = useState<CampaignWithMetrics | null>(null);
    const [newCampaign, setNewCampaign] = useState({
        name: '',
        type: 'reactivation' as Campaign['type'],
        minDaysSinceVisit: 60,
        offerText: '',
        treatmentType: '',
        occasion: '',
        messageTemplate: '',
    });

    useEffect(() => {
        if (!authLoading && businessId) {
            loadCampaigns();
        } else if (!authLoading && !businessId) {
            setLoading(false);
        }
    }, [businessId, authLoading]);

    async function loadCampaigns() {
        try {
            setLoading(true);

            const { data, error } = await supabase
                .from('campaigns')
                .select('*')
                .eq('business_id', businessId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }

            // Map database fields to component format with metrics
            const mappedCampaigns: CampaignWithMetrics[] = (data || []).map((campaign: Campaign) => ({
                ...campaign,
                metrics: {
                    messages_sent: campaign.sent_count || 0,
                    replies: campaign.replied_count || 0,
                    bookings_generated: campaign.converted_count || 0,
                },
            }));

            setCampaigns(mappedCampaigns);
        } catch (error) {
            console.error('Error loading campaigns:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleLaunchCampaign() {
        if (!newCampaign.name.trim()) {
            toast.error('Campaign name is required');
            return;
        }

        setCreating(true);
        try {
            // Build the message template
            const messageTemplate = newCampaign.type === 'reactivation'
                ? `Hi {firstName}! We miss you. ${newCampaign.offerText} Book your next appointment today!`
                : newCampaign.messageTemplate;

            // Get target client count for reactivation campaigns
            let targetCount = 0;
            if (newCampaign.type === 'reactivation') {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - newCampaign.minDaysSinceVisit);

                const { count } = await supabase
                    .from('clients')
                    .select('*', { count: 'exact', head: true })
                    .eq('business_id', businessId)
                    .lt('last_visit_date', cutoffDate.toISOString());

                targetCount = count || 0;
            }

            // Create the campaign
            const { error } = await supabase
                .from('campaigns')
                .insert({
                    business_id: businessId,
                    name: newCampaign.name,
                    type: newCampaign.type,
                    status: 'draft',
                    message_template: messageTemplate,
                    target_count: targetCount,
                    target_criteria: newCampaign.type === 'reactivation'
                        ? { min_days_since_visit: newCampaign.minDaysSinceVisit }
                        : null,
                    sent_count: 0,
                    replied_count: 0,
                });

            if (error) throw error;

            toast.success(`Campaign "${newCampaign.name}" created with ${targetCount} targets`);
            setShowCreateModal(false);
            setNewCampaign({ name: '', type: 'reactivation', minDaysSinceVisit: 60, offerText: '', treatmentType: '', occasion: '', messageTemplate: '' });
            loadCampaigns();
        } catch (error) {
            console.error('Error creating campaign:', error);
            toast.error('Failed to create campaign');
        } finally {
            setCreating(false);
        }
    }

    async function toggleCampaignStatus(campaignId: string, currentStatus: string) {
        const newStatus = currentStatus === 'active' ? 'paused' : 'active';
        try {
            const { error } = await supabase
                .from('campaigns')
                .update({ status: newStatus })
                .eq('id', campaignId);

            if (error) throw error;
            toast.success(`Campaign ${newStatus === 'active' ? 'resumed' : 'paused'}`);
            loadCampaigns();
        } catch (error) {
            toast.error('Failed to update campaign');
        }
    }

    const aggregatedStats = {
        active: campaigns.filter(c => c.status === 'active').length,
        totalSent: campaigns.reduce((acc, c) => acc + c.metrics.messages_sent, 0),
        totalBookings: campaigns.reduce((acc, c) => acc + c.metrics.bookings_generated, 0),
        avgConversion: campaigns.length > 0 && campaigns.reduce((acc, c) => acc + c.metrics.messages_sent, 0) > 0
            ? ((campaigns.reduce((acc, c) => acc + c.metrics.bookings_generated, 0) /
                campaigns.reduce((acc, c) => acc + c.metrics.messages_sent, 0)) * 100).toFixed(1)
            : '0.0',
    };

    const getTypeBadge = (type: Campaign['type']) => {
        const styles: Record<string, string> = {
            reactivation: 'bg-[var(--success-light)] text-[var(--success)]',
            nurture: 'bg-[var(--info-light)] text-[var(--info)]',
            review_request: 'bg-[var(--warning-light)] text-[var(--warning)]',
            promotion: 'bg-[var(--primary-light)] text-[var(--primary)]',
            birthday: 'bg-[var(--accent-rose-light)] text-[var(--accent-rose)]',
            appointment_reminder: 'bg-[var(--accent-lavender-light)] text-[var(--accent-lavender)]',
        };

        const labels: Record<string, string> = {
            reactivation: 'Reactivation',
            nurture: 'Nurture',
            review_request: 'Review Request',
            promotion: 'Promotion',
            birthday: 'Birthday',
            appointment_reminder: 'Reminder',
        };

        const typeKey = type || 'reactivation';
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium border border-current opacity-80 ${styles[typeKey] || styles.reactivation}`}>
                {labels[typeKey] || 'Campaign'}
            </span>
        );
    };

    const getStatusBadge = (status: Campaign['status']) => {
        const styles: Record<string, string> = {
            draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
            scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
            active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
            paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
            completed: 'bg-[var(--primary-light)] text-[var(--primary)] dark:bg-[var(--primary-dark)] dark:text-[var(--primary-light)]',
            cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    const getConversionColor = (rate: number) => {
        if (rate >= 10) return 'text-[var(--success)]';
        if (rate >= 5) return 'text-[var(--warning)]';
        return 'text-[var(--destructive)]';
    };

    const generatePreview = () => {
        if (newCampaign.type === 'reactivation') {
            return `Hi {firstName}! We miss you. It's been ${newCampaign.minDaysSinceVisit} days since your last visit. ${newCampaign.offerText} Book your next appointment today!`;
        } else {
            return newCampaign.messageTemplate || 'Enter a message template to see a preview...';
        }
    };

    if (authLoading || loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-[var(--primary-light)] dark:bg-[var(--primary-dark)] flex items-center justify-center animate-pulse">
                    <Megaphone className="w-6 h-6 text-[var(--primary)]" />
                </div>
                <p className="text-[var(--foreground-muted)] animate-pulse">Loading campaigns...</p>
            </div>
        );
    }

    if (!businessId) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <AlertCircle className="w-12 h-12 text-[var(--warning)]" />
                <p className="text-[var(--foreground)] font-medium">Please log in to view campaigns.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Campaigns (Phoenix)"
                description="Manage reactivation and promotional outreach."
                icon={Megaphone}
                action={
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 transition-opacity font-medium text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Create Campaign</span>
                    </button>
                }
            />

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard title="Active Campaigns" value={aggregatedStats.active} icon={Megaphone} variant="primary" />
                <StatCard title="Messages Sent" value={aggregatedStats.totalSent} icon={Send} variant="sage" />
                <StatCard title="Bookings Generated" value={aggregatedStats.totalBookings} icon={Calendar} variant="gold" />
                <StatCard title="Avg Conversion Rate" value={`${aggregatedStats.avgConversion}%`} icon={TrendingUp} variant="lavender" />
            </div>

            {/* Campaigns Table */}
            {campaigns.length === 0 ? (
                <div className="bg-white dark:bg-[var(--background-secondary)] rounded-lg border border-[var(--border)] p-12 text-center flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-4">
                        <Megaphone className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-[var(--foreground)] mb-1">No campaigns found</h3>
                    <p className="text-sm text-[var(--foreground-muted)] mb-6">Create your first automated campaign to start re-engaging clients.</p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center space-x-2 px-4 py-2 border border-[var(--primary)] text-[var(--primary)] rounded-lg mx-auto hover:bg-[var(--primary-light)] dark:hover:bg-[var(--primary-dark)] transition-colors font-medium text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Create Campaign</span>
                    </button>
                </div>
            ) : (
                <div className="bg-white dark:bg-[var(--background-secondary)] rounded-lg border border-[var(--border)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-gray-50 dark:bg-gray-800/50 text-[var(--foreground-muted)] border-b border-[var(--border)]">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Campaign Name</th>
                                    <th className="px-6 py-4 font-medium">Type</th>
                                    <th className="px-6 py-4 font-medium">Status</th>
                                    <th className="px-6 py-4 font-medium">Outreach</th>
                                    <th className="px-6 py-4 font-medium">Conversion</th>
                                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {campaigns.map((campaign) => {
                                    const conversionRate = campaign.metrics.messages_sent > 0
                                        ? (campaign.metrics.bookings_generated / campaign.metrics.messages_sent) * 100
                                        : 0;

                                    return (
                                        <tr key={campaign.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-[var(--foreground)]">{campaign.name}</div>
                                                <div className="text-xs text-[var(--foreground-muted)] mt-1">
                                                    {campaign.started_at ? format(new Date(campaign.started_at), 'MMM d, yyyy') : 'No date'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">{getTypeBadge(campaign.type)}</td>
                                            <td className="px-6 py-4">{getStatusBadge(campaign.status)}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div>
                                                        <div className="text-[var(--foreground)] font-medium">{campaign.metrics.messages_sent}</div>
                                                        <div className="text-xs text-[var(--foreground-muted)]">Sent</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className={`font-semibold ${getConversionColor(conversionRate)}`}>
                                                        {conversionRate.toFixed(1)}%
                                                    </span>
                                                    <span className="text-xs text-[var(--foreground-muted)] mt-1">
                                                        {campaign.metrics.bookings_generated} bookings
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end space-x-2">
                                                    {campaign.status === 'active' && (
                                                        <button
                                                            onClick={() => toggleCampaignStatus(campaign.id, campaign.status)}
                                                            className="p-2 text-[var(--foreground-muted)] hover:text-gray-900 dark:hover:text-white rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                            title="Pause"
                                                        >
                                                            <Pause className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {campaign.status === 'paused' && (
                                                        <button
                                                            onClick={() => toggleCampaignStatus(campaign.id, campaign.status)}
                                                            className="p-2 text-[var(--foreground-muted)] hover:text-[var(--success)] rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                            title="Resume"
                                                        >
                                                            <Play className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setSelectedCampaign(campaign)}
                                                        className="p-2 text-[var(--primary)] hover:text-[var(--primary-dark)] rounded hover:bg-[var(--primary-light)] dark:hover:bg-[var(--primary-dark)] transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Create Campaign Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-2xl w-full border border-[var(--border)] max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 z-10">
                            <h2 className="text-xl font-bold text-[var(--foreground)]">New Automation Campaign</h2>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 text-[var(--foreground-muted)] hover:text-[var(--foreground)] rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-[var(--foreground)]">Campaign Name</label>
                                <input
                                    type="text"
                                    value={newCampaign.name}
                                    onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-[var(--border)] bg-transparent rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none transition-all placeholder:text-[var(--foreground-muted)]"
                                    placeholder="e.g., 90-Day VIP Reactivation"
                                />
                            </div>

                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-[var(--foreground)]">Campaign Goal (Type)</label>
                                <select
                                    value={newCampaign.type}
                                    onChange={(e) => setNewCampaign({ ...newCampaign, type: e.target.value as Campaign['type'] })}
                                    className="w-full px-4 py-2 border border-[var(--border)] bg-white dark:bg-gray-800 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none transition-all"
                                >
                                    <option value="reactivation">Database Reactivation</option>
                                    <option value="nurture">Lead Nurturing</option>
                                    <option value="review_request">Review Invites</option>
                                    <option value="promotion">Special Promotion</option>
                                    <option value="birthday">Birthday Automation</option>
                                </select>
                            </div>

                            {newCampaign.type === 'reactivation' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium text-[var(--foreground)]">
                                            Lapsed Window (Days)
                                        </label>
                                        <input
                                            type="number"
                                            value={newCampaign.minDaysSinceVisit}
                                            onChange={(e) => setNewCampaign({ ...newCampaign, minDaysSinceVisit: parseInt(e.target.value) })}
                                            className="w-full px-4 py-2 border border-[var(--border)] bg-transparent rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium text-[var(--foreground)]">Irresistible Offer</label>
                                        <textarea
                                            value={newCampaign.offerText}
                                            onChange={(e) => setNewCampaign({ ...newCampaign, offerText: e.target.value })}
                                            rows={2}
                                            className="w-full px-4 py-2 border border-[var(--border)] bg-transparent rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none placeholder:text-[var(--foreground-muted)] resize-none"
                                            placeholder="e.g., Have a free consultation on us!"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <label className="text-sm font-medium text-[var(--foreground)]">Target Audience / Segment</label>
                                            <input
                                                type="text"
                                                value={newCampaign.treatmentType}
                                                onChange={(e) => setNewCampaign({ ...newCampaign, treatmentType: e.target.value })}
                                                className="w-full px-4 py-2 border border-[var(--border)] bg-transparent rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none"
                                                placeholder="e.g., All active leads"
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <label className="text-sm font-medium text-[var(--foreground)]">Occasion (Optional)</label>
                                            <input
                                                type="text"
                                                value={newCampaign.occasion}
                                                onChange={(e) => setNewCampaign({ ...newCampaign, occasion: e.target.value })}
                                                className="w-full px-4 py-2 border border-[var(--border)] bg-transparent rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none"
                                                placeholder="e.g., Black Friday"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium text-[var(--foreground)]">Message Template (AI Guide)</label>
                                        <textarea
                                            value={newCampaign.messageTemplate}
                                            onChange={(e) => setNewCampaign({ ...newCampaign, messageTemplate: e.target.value })}
                                            rows={3}
                                            className="w-full px-4 py-2 border border-[var(--border)] bg-transparent rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none placeholder:text-[var(--foreground-muted)]"
                                            placeholder="Tell the AI what to focus on..."
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Preview */}
                            <div className="bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)] rounded-lg p-4 mt-4">
                                <h3 className="text-xs font-bold text-[var(--foreground-muted)] mb-2 uppercase tracking-wider">AI Execution Preview</h3>
                                <p className="text-[var(--foreground)] text-sm leading-relaxed">{generatePreview()}</p>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-[var(--border)] bg-gray-50 dark:bg-gray-900 sticky bottom-0">
                            <button
                                onClick={handleLaunchCampaign}
                                disabled={creating}
                                className="w-full px-4 py-2.5 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 transition-opacity font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {creating ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        <span>Deploying Context...</span>
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4 fill-current" />
                                        <span>Initialize Campaign</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Campaign Detail View */}
            {selectedCampaign && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-4xl w-full border border-[var(--border)] max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-[var(--foreground)]">{selectedCampaign.name}</h2>
                                <div className="flex items-center space-x-2 mt-2">
                                    {getTypeBadge(selectedCampaign.type)}
                                    {getStatusBadge(selectedCampaign.status)}
                                </div>
                            </div>
                            <button onClick={() => setSelectedCampaign(null)} className="p-2 text-[var(--foreground-muted)] hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Campaign Stats Overview */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white dark:bg-[var(--background-secondary)] border border-[var(--border)] rounded-lg p-4">
                                    <p className="text-2xl font-bold text-[var(--foreground)]">{selectedCampaign.target_count || 0}</p>
                                    <p className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider mt-1">Target List</p>
                                </div>
                                <div className="bg-[var(--accent-sage-light)] dark:bg-[var(--accent-sage-dark)] border border-transparent dark:border-[var(--accent-sage-light)]/20 rounded-lg p-4">
                                    <p className="text-2xl font-bold text-[var(--accent-sage)] dark:text-[var(--accent-sage-light)]">{selectedCampaign.delivered_count || 0}</p>
                                    <p className="text-xs font-medium text-[var(--accent-sage)]/70 dark:text-[var(--accent-sage-light)]/70 uppercase tracking-wider mt-1">Delivered</p>
                                </div>
                                <div className="bg-[var(--primary-light)] dark:bg-[var(--primary-dark)] border border-transparent dark:border-[var(--primary-light)]/20 rounded-lg p-4">
                                    <p className="text-2xl font-bold text-[var(--primary)] dark:text-[var(--primary-light)]">{selectedCampaign.opened_count || 0}</p>
                                    <p className="text-xs font-medium text-[var(--primary)]/70 dark:text-[var(--primary-light)]/70 uppercase tracking-wider mt-1">Opened</p>
                                </div>
                                <div className="bg-[var(--accent-gold-light)] dark:bg-[var(--accent-gold-dark)] border border-transparent dark:border-[var(--accent-gold-light)]/20 rounded-lg p-4">
                                    <p className="text-2xl font-bold text-[var(--accent-gold)] dark:text-[var(--accent-gold-light)]">{selectedCampaign.clicked_count || 0}</p>
                                    <p className="text-xs font-medium text-[var(--accent-gold)]/70 dark:text-[var(--accent-gold-light)]/70 uppercase tracking-wider mt-1">Clicked</p>
                                </div>
                            </div>

                            {/* Message Template Context */}
                            {selectedCampaign.message_template && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-[var(--foreground)]">Prompt Template (Phoenix System)</h3>
                                    <div className="bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)] rounded-lg p-4 text-sm text-[var(--foreground-muted)] font-mono leading-relaxed">
                                        {selectedCampaign.message_template}
                                    </div>
                                </div>
                            )}

                            {/* Activity Log (Placeholder) */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-[var(--foreground)]">Event Log</h3>
                                <div className="bg-white dark:bg-[var(--background-secondary)] border border-[var(--border)] rounded-lg py-8 text-center text-sm text-[var(--foreground-muted)] flex flex-col items-center justify-center">
                                    <Calendar className="w-8 h-8 text-gray-400 dark:text-gray-600 mb-3" />
                                    No outreach sequence triggered yet. Events will populate once AI starts dialling out to lists.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
