'use client';

import { useEffect, useState } from 'react';
import { Star, Send, TrendingUp, AlertTriangle, ExternalLink, AlertCircle, CheckCircle, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { supabase, type Review } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/dashboard/StatCard';

interface ReviewWithClient extends Review {
    client_name: string;
}

interface FunnelData {
    appointmentsCompleted: number;
    checkInsSent: number;
    positiveReplies: number;
    reviewRequestsSent: number;
}

export default function ReviewsPage() {
    const { businessId, loading: authLoading } = useAuth();
    const [reviews, setReviews] = useState<ReviewWithClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [ratingModalOpen, setRatingModalOpen] = useState<string | null>(null);
    const [settings, setSettings] = useState({
        currentReviewCount: 0,
        currentRating: 0,
        goalReviewCount: 200,
        googleReviewUrl: 'https://g.page/r/YOUR_BUSINESS_ID/review',
    });

    const [funnelData, setFunnelData] = useState<FunnelData>({
        appointmentsCompleted: 0,
        checkInsSent: 0,
        positiveReplies: 0,
        reviewRequestsSent: 0,
    });

    useEffect(() => {
        if (!authLoading && businessId) {
            loadReviews();
            loadFunnelData();
        } else if (!authLoading && !businessId) {
            setLoading(false);
        }
    }, [businessId, authLoading]);

    async function loadReviews() {
        try {
            setLoading(true);

            const { data, error } = await supabase
                .from('reviews')
                .select(`
                    *,
                    clients(first_name, last_name)
                `)
                .eq('business_id', businessId)
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }

            const mappedReviews: ReviewWithClient[] = (data || []).map((review: any) => ({
                ...review,
                client_name: review.clients
                    ? `${review.clients.first_name} ${review.clients.last_name || ''}`.trim()
                    : 'Unknown Client',
            }));

            setReviews(mappedReviews);

            // Calculate stats from reviews
            const reviewedItems = mappedReviews.filter(r => r.status === 'reviewed' && r.rating);
            const totalRating = reviewedItems.reduce((sum, r) => sum + (r.rating || 0), 0);
            const avgRating = reviewedItems.length > 0 ? totalRating / reviewedItems.length : 0;

            setSettings(prev => ({
                ...prev,
                currentReviewCount: reviewedItems.length,
                currentRating: Math.round(avgRating * 10) / 10,
            }));
        } catch (error) {
            console.error('Error loading reviews:', error);
        } finally {
            setLoading(false);
        }
    }

    async function loadFunnelData() {
        try {
            // Get appointment count
            const { count: appointmentCount } = await supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .eq('business_id', businessId)
                .eq('status', 'completed');

            // Get review requests sent
            const { count: requestsSentCount } = await supabase
                .from('reviews')
                .select('*', { count: 'exact', head: true })
                .eq('business_id', businessId)
                .in('status', ['request_sent', 'clicked', 'reviewed', 'declined']);

            // Get clicked
            const { count: clickedCount } = await supabase
                .from('reviews')
                .select('*', { count: 'exact', head: true })
                .eq('business_id', businessId)
                .in('status', ['clicked', 'reviewed']);

            // Get reviewed (positive)
            const { count: reviewedCount } = await supabase
                .from('reviews')
                .select('*', { count: 'exact', head: true })
                .eq('business_id', businessId)
                .eq('status', 'reviewed');

            setFunnelData({
                appointmentsCompleted: appointmentCount || 0,
                checkInsSent: requestsSentCount || 0,
                positiveReplies: clickedCount || 0,
                reviewRequestsSent: reviewedCount || 0,
            });
        } catch (error) {
            console.error('Error loading funnel data:', error);
        }
    }

    async function sendReviewRequest(clientId: string | undefined) {
        if (!clientId) {
            toast.error('No client associated with this review');
            return;
        }
        try {
            setActionLoading(clientId);
            // Create a new review request record
            const { error } = await supabase
                .from('reviews')
                .insert({
                    business_id: businessId,
                    client_id: clientId,
                    status: 'request_sent',
                    request_sent_at: new Date().toISOString(),
                    platform: 'google', // default platform
                });

            if (error) throw error;
            toast.success('Review request sent');
            loadReviews();
            loadFunnelData();
        } catch (error) {
            console.error('Error sending review request:', error);
            toast.error('Failed to send review request');
        } finally {
            setActionLoading(null);
        }
    }

    async function markReviewed(reviewId: string, rating: number) {
        try {
            setActionLoading(reviewId);
            const { error } = await supabase
                .from('reviews')
                .update({
                    status: 'reviewed',
                    rating: rating,
                    reviewed_at: new Date().toISOString(),
                })
                .eq('id', reviewId);

            if (error) throw error;
            toast.success('Review recorded');
            setRatingModalOpen(null);
            loadReviews();
            loadFunnelData();
        } catch (error) {
            console.error('Error recording review:', error);
            toast.error('Failed to record review');
        } finally {
            setActionLoading(null);
        }
    }

    async function updateReviewStatus(reviewId: string, status: string) {
        try {
            setActionLoading(reviewId);
            const { error } = await supabase
                .from('reviews')
                .update({ status })
                .eq('id', reviewId);

            if (error) throw error;
            toast.success('Status updated');
            loadReviews();
            loadFunnelData();
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error('Failed to update status');
        } finally {
            setActionLoading(null);
        }
    }

    async function resendRequest(reviewId: string) {
        try {
            setActionLoading(reviewId);
            const { error } = await supabase
                .from('reviews')
                .update({
                    status: 'request_sent',
                    request_sent_at: new Date().toISOString(),
                })
                .eq('id', reviewId);

            if (error) throw error;
            toast.success('Review request resent');
            loadReviews();
        } catch (error) {
            console.error('Error resending request:', error);
            toast.error('Failed to resend request');
        } finally {
            setActionLoading(null);
        }
    }

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const requestsThisMonth = reviews.filter(r =>
        r.request_sent_at && new Date(r.request_sent_at) >= thisMonth
    ).length;
    const estimatedReviews = reviews.filter(r => r.status === 'clicked' || r.status === 'reviewed').length;
    const positiveReplies = funnelData.positiveReplies;
    const totalReplies = funnelData.checkInsSent;
    const positiveSentimentRate = totalReplies > 0 ? ((positiveReplies / totalReplies) * 100).toFixed(1) : '0.0';
    const negativeReplies = reviews.filter(r => r.status === 'declined').length;

    const stats = {
        requestsSent: requestsThisMonth,
        estimatedReviews,
        positiveSentimentRate,
        ownerAlerts: negativeReplies,
    };

    // Calculate conversion rates for funnel
    const funnelConversions = {
        checkInRate: funnelData.appointmentsCompleted > 0
            ? ((funnelData.checkInsSent / funnelData.appointmentsCompleted) * 100).toFixed(1)
            : '0.0',
        positiveRate: funnelData.checkInsSent > 0
            ? ((funnelData.positiveReplies / funnelData.checkInsSent) * 100).toFixed(1)
            : '0.0',
        reviewRequestRate: funnelData.positiveReplies > 0
            ? ((funnelData.reviewRequestsSent / funnelData.positiveReplies) * 100).toFixed(1)
            : '0.0',
    };

    const getStatusBadge = (status: Review['status']) => {
        const styles: Record<string, string> = {
            pending: 'bg-[var(--foreground-muted)]/10 text-[var(--foreground-muted)]',
            request_sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
            clicked: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
            reviewed: 'bg-[var(--success-light)]/20 text-[var(--success)]',
            declined: 'bg-[var(--destructive-light)]/20 text-[var(--destructive)]',
        };

        const labels: Record<string, string> = {
            pending: 'Pending',
            request_sent: 'Sent',
            clicked: 'Clicked',
            reviewed: 'Reviewed',
            declined: 'Declined',
        };

        return (
            <span className={`px-2 py-1 rounded-md text-xs font-medium border border-transparent ${styles[status] || styles.pending}`}>
                {labels[status] || status}
            </span>
        );
    };

    // Calculate weekly data from actual reviews
    const getWeeklyData = () => {
        const now = new Date();
        const weeks = [];
        for (let i = 3; i >= 0; i--) {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - (i * 7) - 6);
            const weekEnd = new Date(now);
            weekEnd.setDate(now.getDate() - (i * 7));

            const count = reviews.filter(r => {
                if (!r.request_sent_at) return false;
                const date = new Date(r.request_sent_at);
                return date >= weekStart && date <= weekEnd;
            }).length;

            weeks.push({ week: `Week ${4 - i}`, count });
        }
        return weeks;
    };

    const weeklyData = getWeeklyData();
    const maxWeekly = Math.max(...weeklyData.map(w => w.count), 1);

    if (authLoading || loading) {
        return (
            <div className="flex items-center justify-center min-h-[500px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
            </div>
        );
    }

    if (!businessId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
                <AlertCircle className="w-12 h-12 text-[var(--warning)]" />
                <p className="text-[var(--foreground-muted)]">Please log in to view reviews.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Reputation Management (Star)"
                description="Track review requests, responses, and overall client sentiment."
                icon={Star}
            />

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    title="Average Rating"
                    value={settings.currentRating || '-'}
                    icon={Star}
                    variant="lavender"
                    subtitle="Current Google Rating"
                />
                <StatCard
                    title="Total Reviews"
                    value={settings.currentReviewCount}
                    icon={Star}
                    variant="primary"
                    subtitle={`${stats.estimatedReviews} new this month`}
                />
                <StatCard
                    title="Positive Sentiment"
                    value={`${stats.positiveSentimentRate}%`}
                    icon={TrendingUp}
                    variant="sage"
                    subtitle="Of total requests sent"
                />
                <StatCard
                    title="Owner Alerts"
                    value={stats.ownerAlerts}
                    icon={AlertTriangle}
                    variant="rose"
                    subtitle="Negative Sentiment detected"
                />
            </div>

            {/* Funnel Chart */}
            <div className="bg-[var(--background-card)] rounded-lg border border-[var(--border)] p-6">
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-6">Review Generation Funnel</h2>
                <div className="space-y-4">
                    {/* Appointments Completed */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-[var(--foreground-muted)]">Appointments Completed</span>
                            <span className="text-sm font-bold text-[var(--foreground)]">{funnelData.appointmentsCompleted}</span>
                        </div>
                        <div className="w-full bg-[var(--background-secondary)] rounded-full h-8 border border-[var(--border)] overflow-hidden">
                            <div className="bg-[var(--foreground-muted)] h-8 flex items-center justify-center text-white text-sm font-medium" style={{ width: '100%' }}>
                                100%
                            </div>
                        </div>
                    </div>

                    {/* Check-In Sent */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-[var(--foreground-muted)]">Check-In Sent</span>
                            <span className="text-sm font-bold text-[var(--foreground)]">{funnelData.checkInsSent}</span>
                        </div>
                        <div className="w-full bg-[var(--background-secondary)] rounded-full h-8 border border-[var(--border)] overflow-hidden">
                            <div className="bg-[var(--primary)] h-8 flex items-center justify-center text-white text-sm font-medium" style={{ width: `${Math.min(parseFloat(funnelConversions.checkInRate), 100)}%` }}>
                                {funnelConversions.checkInRate}%
                            </div>
                        </div>
                    </div>

                    {/* Positive Reply */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-[var(--foreground-muted)]">Positive Reply</span>
                            <span className="text-sm font-bold text-[var(--foreground)]">{funnelData.positiveReplies}</span>
                        </div>
                        <div className="w-full bg-[var(--background-secondary)] rounded-full h-8 border border-[var(--border)] overflow-hidden">
                            <div className="bg-[var(--success)] h-8 flex items-center justify-center text-white text-sm font-medium" style={{ width: `${Math.min(parseFloat(funnelConversions.positiveRate), 100)}%` }}>
                                {funnelConversions.positiveRate}%
                            </div>
                        </div>
                    </div>

                    {/* Review Request Sent */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-[var(--foreground-muted)]">Review Request Sent</span>
                            <span className="text-sm font-bold text-[var(--foreground)]">{funnelData.reviewRequestsSent}</span>
                        </div>
                        <div className="w-full bg-[var(--background-secondary)] rounded-full h-8 border border-[var(--border)] overflow-hidden">
                            <div className="bg-[var(--warning)] h-8 flex items-center justify-center text-white text-sm font-medium text-shadow-sm" style={{ width: `${Math.min(parseFloat(funnelConversions.reviewRequestRate), 100)}%` }}>
                                {funnelConversions.reviewRequestRate}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Two-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* LEFT: Recent Review Requests (60%) */}
                <div className="lg:col-span-3 bg-[var(--background-card)] rounded-lg border border-[var(--border)] overflow-hidden">
                    <div className="px-6 py-4 border-b border-[var(--border)]">
                        <h2 className="text-lg font-semibold text-[var(--foreground)]">Recent Review Requests</h2>
                    </div>
                    <div className="overflow-x-auto">
                        {reviews.length === 0 ? (
                            <div className="p-8 text-center">
                                <Star className="w-12 h-12 text-[var(--foreground-muted)] mx-auto mb-4" />
                                <p className="text-[var(--foreground-muted)]">No reviews found</p>
                                <p className="text-sm text-[var(--foreground-muted)] mt-1 opacity-70">Review requests will appear here once created</p>
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-[var(--border)]">
                                <thead className="bg-[var(--background-primary)]">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
                                            Client
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
                                            Platform
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
                                            Date Sent
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
                                            Rating
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-[var(--background-card)] divide-y divide-[var(--border)]">
                                    {reviews.map((review) => (
                                        <tr key={review.id} className="hover:bg-[var(--background-secondary)] transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--foreground)]">
                                                {review.client_name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground-muted)] capitalize">
                                                {review.platform || 'google'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground-muted)]">
                                                {review.request_sent_at
                                                    ? format(new Date(review.request_sent_at), 'MMM d, yyyy')
                                                    : format(new Date(review.created_at), 'MMM d, yyyy')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {getStatusBadge(review.status)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {review.rating ? (
                                                    <div className="flex items-center space-x-1">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <Star
                                                                key={star}
                                                                className={`w-4 h-4 ${star <= review.rating!
                                                                    ? 'text-[var(--warning)] fill-current'
                                                                    : 'text-[var(--foreground-muted)] opacity-30'
                                                                    }`}
                                                            />
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-[var(--foreground-muted)] opacity-50">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center space-x-2">
                                                    {/* Show different actions based on status */}
                                                    {review.status === 'pending' && (
                                                        <button
                                                            onClick={() => sendReviewRequest(review.client_id)}
                                                            disabled={actionLoading === review.client_id}
                                                            className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {actionLoading === review.client_id ? (
                                                                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1"></div>
                                                            ) : (
                                                                <Send className="w-3 h-3 mr-1" />
                                                            )}
                                                            Send Request
                                                        </button>
                                                    )}

                                                    {(review.status === 'request_sent' || review.status === 'clicked') && (
                                                        <>
                                                            <button
                                                                onClick={() => setRatingModalOpen(review.id)}
                                                                disabled={actionLoading === review.id}
                                                                className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded border border-[var(--success)] text-[var(--success)] hover:bg-[var(--success)] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                <CheckCircle className="w-3 h-3 mr-1" />
                                                                Mark Reviewed
                                                            </button>
                                                            <button
                                                                onClick={() => resendRequest(review.id)}
                                                                disabled={actionLoading === review.id}
                                                                className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary-light)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                <Send className="w-3 h-3 mr-1" />
                                                                Resend
                                                            </button>
                                                        </>
                                                    )}

                                                    {review.status === 'declined' && (
                                                        <button
                                                            onClick={() => updateReviewStatus(review.id, 'pending')}
                                                            disabled={actionLoading === review.id}
                                                            className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded border border-[var(--border)] text-[var(--foreground-muted)] hover:bg-[var(--background-secondary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <MoreHorizontal className="w-3 h-3 mr-1" />
                                                            Reset
                                                        </button>
                                                    )}

                                                    {review.status === 'reviewed' && (
                                                        <span className="text-xs text-[var(--foreground-muted)] italic">Completed</span>
                                                    )}
                                                </div>

                                                {/* Rating Modal */}
                                                {ratingModalOpen === review.id && (
                                                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                                                        <div className="bg-[var(--background-card)] border border-[var(--border)] rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
                                                            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                                                                Record Review for {review.client_name}
                                                            </h3>
                                                            <p className="text-sm text-[var(--foreground-muted)] mb-4">
                                                                Select the rating the client left:
                                                            </p>
                                                            <div className="flex justify-center space-x-2 mb-6">
                                                                {[1, 2, 3, 4, 5].map((rating) => (
                                                                    <button
                                                                        key={rating}
                                                                        onClick={() => markReviewed(review.id, rating)}
                                                                        disabled={actionLoading === review.id}
                                                                        className="p-2 hover:bg-[var(--background-secondary)] rounded-lg transition-colors disabled:opacity-50"
                                                                    >
                                                                        <Star
                                                                            className="w-8 h-8 text-[var(--warning)] hover:fill-current"
                                                                        />
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <div className="flex justify-end space-x-3">
                                                                <button
                                                                    onClick={() => setRatingModalOpen(null)}
                                                                    className="px-4 py-2 text-sm font-medium text-[var(--foreground)] bg-[var(--background-secondary)] border border-[var(--border)] rounded-lg hover:brightness-95 transition-all"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* RIGHT: Quick Stats (40%) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Current Reviews Card */}
                    <div className="bg-[var(--background-card)] rounded-lg border border-[var(--border)] p-6">
                        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Quick Stats</h3>

                        <div className="space-y-4">
                            {/* Current Rating */}
                            <div>
                                <p className="text-sm text-[var(--foreground-muted)] mb-1">Current Google Rating</p>
                                <div className="flex items-center space-x-2">
                                    <div className="flex items-center">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <Star
                                                key={star}
                                                className={`w-5 h-5 ${star <= Math.floor(settings.currentRating)
                                                    ? 'text-[var(--warning)] fill-current'
                                                    : 'text-[var(--foreground-muted)] opacity-30'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-2xl font-bold text-[var(--foreground)]">{settings.currentRating || '-'}</span>
                                </div>
                            </div>

                            {/* Review Count */}
                            <div>
                                <p className="text-sm text-[var(--foreground-muted)] mb-1">Total Reviews</p>
                                <p className="text-3xl font-bold text-[var(--foreground)]">{settings.currentReviewCount}</p>
                            </div>

                            {/* Goal Progress */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm text-[var(--foreground-muted)]">Goal Progress</p>
                                    <p className="text-sm font-medium text-[var(--foreground)]">
                                        {settings.currentReviewCount} / {settings.goalReviewCount}
                                    </p>
                                </div>
                                <div className="w-full bg-[var(--background-secondary)] rounded-full h-3 border border-[var(--border)] overflow-hidden">
                                    <div
                                        className="bg-[var(--primary)] h-3 transition-all duration-500"
                                        style={{ width: `${Math.min((settings.currentReviewCount / settings.goalReviewCount) * 100, 100)}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Google Review Link */}
                            <a
                                href={settings.googleReviewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center space-x-2 w-full px-4 py-3 bg-[var(--primary)] text-white rounded-lg hover:brightness-110 transition-colors"
                            >
                                <span className="font-medium">View Google Reviews</span>
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                    </div>

                    {/* Monthly Trend Chart */}
                    <div className="bg-[var(--background-card)] rounded-lg border border-[var(--border)] p-6">
                        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Monthly Trend</h3>
                        <div className="space-y-3">
                            {weeklyData.map((week) => (
                                <div key={week.week}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm text-[var(--foreground-muted)]">{week.week}</span>
                                        <span className="text-sm font-medium text-[var(--foreground)]">{week.count}</span>
                                    </div>
                                    <div className="w-full bg-[var(--background-secondary)] rounded-full h-2 border border-[var(--border)] overflow-hidden">
                                        <div
                                            className="bg-[var(--foreground-muted)] h-2"
                                            style={{ width: `${(week.count / maxWeekly) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Pro Tip Box */}
            <div className="bg-[var(--primary)]/10 border border-[var(--primary)]/20 rounded-lg p-6">
                <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-[var(--primary)] rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-sm">i</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Pro Tip</h3>
                        <p className="text-[var(--foreground)]/80">
                            Respond to every Google review within 24 hours. Businesses that respond to reviews get 35% more engagement and build stronger trust with potential clients.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
