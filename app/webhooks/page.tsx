'use client';

import { useEffect, useState } from 'react';
import { supabase, type WebhookLog } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Webhook, CheckCircle, XCircle, Clock, RefreshCw, AlertCircle } from 'lucide-react';

export default function WebhooksPage() {
    const [webhooks, setWebhooks] = useState<WebhookLog[]>([]);
    const [loading, setLoading] = useState(true);
    const { businessId, loading: authLoading } = useAuth();

    useEffect(() => {
        if (!authLoading && businessId) {
            loadWebhooks();

            // Subscribe to real-time updates
            const subscription = supabase
                .channel('webhooks-changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'webhook_logs' }, () => {
                    loadWebhooks();
                })
                .subscribe();

            return () => {
                subscription.unsubscribe();
            };
        } else if (!authLoading && !businessId) {
            setLoading(false);
        }
    }, [businessId, authLoading]);

    async function loadWebhooks() {
        if (!businessId) return;

        try {
            const { data, error } = await supabase
                .from('webhook_logs')
                .select('*')
                .eq('business_id', businessId)
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            setWebhooks(data || []);
        } catch (error) {
            console.error('Error loading webhooks:', error);
        } finally {
            setLoading(false);
        }
    }

    if (authLoading || loading) {
        return (
            <>
                <main className="container mx-auto p-6">
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
                        <AlertCircle className="w-12 h-12 text-yellow-500" />
                        <p className="text-gray-600">Please log in to view webhooks.</p>
                    </div>
                </main>
            </>
        );
    }

    const stats = {
        total: webhooks.length,
        completed: webhooks.filter(w => w.processing_status === 'completed').length,
        failed: webhooks.filter(w => w.processing_status === 'failed').length,
        pending: webhooks.filter(w => w.processing_status === 'pending').length,
    };

    return (
        <>
            <main className="container mx-auto p-6">
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Webhook Monitor</h1>
                            <p className="text-gray-600 mt-2">Real-time webhook processing logs</p>
                        </div>
                        <button
                            onClick={loadWebhooks}
                            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            <span>Refresh</span>
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                            <p className="text-sm text-gray-600">Total</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                            <p className="text-sm text-gray-600">Completed</p>
                            <p className="text-2xl font-bold text-green-600 mt-1">{stats.completed}</p>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                            <p className="text-sm text-gray-600">Failed</p>
                            <p className="text-2xl font-bold text-red-600 mt-1">{stats.failed}</p>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                            <p className="text-sm text-gray-600">Pending</p>
                            <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
                        </div>
                    </div>

                    {/* Webhook Logs */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                        <div className="divide-y divide-gray-200">
                            {webhooks.map((webhook) => (
                                <div key={webhook.id} className="p-6 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start space-x-4 flex-1">
                                            <div className="w-10 h-10 bg-primary-light/30 rounded-lg flex items-center justify-center">
                                                <Webhook className="w-5 h-5 text-primary" />
                                            </div>

                                            <div className="flex-1">
                                                <div className="flex items-center space-x-2">
                                                    <span className="font-semibold text-gray-900">{webhook.source}</span>
                                                    <span className="text-sm text-gray-500">•</span>
                                                    <span className="text-sm text-gray-600">{webhook.event_type}</span>
                                                </div>
                                                <p className="text-sm text-gray-500 mt-1">
                                                    {new Date(webhook.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="ml-4">
                                            {webhook.processing_status === 'completed' && (
                                                <div className="flex items-center space-x-1 text-green-600">
                                                    <CheckCircle className="w-4 h-4" />
                                                    <span className="text-sm">Completed</span>
                                                </div>
                                            )}
                                            {webhook.processing_status === 'failed' && (
                                                <div className="flex items-center space-x-1 text-red-600">
                                                    <XCircle className="w-4 h-4" />
                                                    <span className="text-sm">Failed</span>
                                                </div>
                                            )}
                                            {webhook.processing_status === 'pending' && (
                                                <div className="flex items-center space-x-1 text-yellow-600">
                                                    <Clock className="w-4 h-4" />
                                                    <span className="text-sm">Pending</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {webhooks.length === 0 && (
                            <div className="text-center py-12">
                                <Webhook className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-500">No webhook logs yet</p>
                                <p className="text-sm text-gray-400 mt-2">
                                    Webhooks will appear here when your CRM sends events
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </>
    );
}
