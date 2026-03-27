'use client';

import { useEffect, useState } from 'react';
import { Building2, FileText, Webhook, Bell, Settings as SettingsIcon, Save, Plus, Edit, Trash2, Copy, ExternalLink, CheckCircle, XCircle, AlertCircle, CreditCard, Loader2, Crown, Zap, Star, TrendingUp, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, type Business, type Settings, type TreatmentTemplate } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

type Tab = 'business' | 'treatments' | 'crm' | 'notifications' | 'integrations' | 'billing' | 'knowledge';

interface BusinessInfo {
    name: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    timezone: string;
    google_review_url: string;
    business_hours: {
        [key: string]: { open: string; close: string; closed: boolean };
    };
}

interface TreatmentTemplateUI {
    id: string;
    name: string;
    category: string;
    default_duration_minutes: number;
    default_price: number;
    review_request_delay_hours: number;
    is_active: boolean;
}

export default function SettingsPage() {
    const { businessId, user, loading: authLoading } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('business');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Business Info State
    const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
        name: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        timezone: 'America/Los_Angeles',
        google_review_url: '',
        business_hours: {
            monday: { open: '09:00', close: '18:00', closed: false },
            tuesday: { open: '09:00', close: '18:00', closed: false },
            wednesday: { open: '09:00', close: '18:00', closed: false },
            thursday: { open: '09:00', close: '18:00', closed: false },
            friday: { open: '09:00', close: '18:00', closed: false },
            saturday: { open: '10:00', close: '16:00', closed: false },
            sunday: { open: '', close: '', closed: true },
        },
    });

    // Treatment Templates State
    const [treatments, setTreatments] = useState<TreatmentTemplateUI[]>([]);
    const [showTreatmentModal, setShowTreatmentModal] = useState(false);
    const [editingTreatment, setEditingTreatment] = useState<TreatmentTemplateUI | null>(null);

    // Settings State (from settings table)
    const [settings, setSettings] = useState<Settings | null>(null);

    // CRM Connection State
    const [crmStatus, setCrmStatus] = useState({
        type: 'Boulevard',
        connected: false,
        webhook_url: '',
        last_received: '',
    });

    // Notifications State
    const [notifications, setNotifications] = useState({
        negative_sentiment_alerts: true,
        daily_summary_email: true,
        owner_phone: '',
        owner_email: '',
    });

    // Integrations State
    const [integrations, setIntegrations] = useState({
        vapi_phone: '',
        vapi_status: 'inactive',
        booking_url: '',
        google_calendar_connected: false,
    });

    const [syncing, setSyncing] = useState(false);
    async function syncAssistant() {
        if (!businessId) return;
        setSyncing(true);
        try {
            const res = await fetch('/api/vapi/sync-assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ business_id: businessId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Sync failed');
            toast.success(`AI synced! ${data.knowledge_entries} knowledge entries pushed to Vapi.`);
        } catch (e: any) {
            toast.error(e.message || 'Failed to sync AI');
        } finally {
            setSyncing(false);
        }
    }

    // Knowledge Base State
    interface KnowledgeEntry {
        id?: string;
        category: string;
        title: string;
        content: string;
        metadata?: any;
    }
    const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
    const [knowledgeLoading, setKnowledgeLoading] = useState(false);
    const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
    const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
    const [knowledgeSaving, setKnowledgeSaving] = useState(false);

    useEffect(() => {
        if (!authLoading && businessId) {
            loadSettings();
        } else if (!authLoading && !businessId) {
            setLoading(false);
        }
    }, [businessId, authLoading]);

    async function loadSettings() {
        try {
            setLoading(true);

            // Load business info
            const { data: businessData, error: businessError } = await supabase
                .from('businesses')
                .select('*')
                .eq('id', businessId)
                .single();

            if (businessError) {
                console.error('Error loading business:', businessError);
            } else if (businessData) {
                setBusinessInfo({
                    name: businessData.name || '',
                    phone: businessData.phone || '',
                    email: businessData.email || '',
                    address: businessData.address || '',
                    city: businessData.city || '',
                    state: businessData.state || '',
                    zip: businessData.zip || '',
                    timezone: businessData.timezone || 'America/Los_Angeles',
                    google_review_url: '',
                    business_hours: {
                        monday: { open: '09:00', close: '18:00', closed: false },
                        tuesday: { open: '09:00', close: '18:00', closed: false },
                        wednesday: { open: '09:00', close: '18:00', closed: false },
                        thursday: { open: '09:00', close: '18:00', closed: false },
                        friday: { open: '09:00', close: '18:00', closed: false },
                        saturday: { open: '10:00', close: '16:00', closed: false },
                        sunday: { open: '', close: '', closed: true },
                    },
                });

                // Update integrations with business data
                setIntegrations({
                    vapi_phone: businessData.vapi_phone_number || '',
                    vapi_status: businessData.vapi_assistant_id ? 'active' : 'inactive',
                    booking_url: '',
                    google_calendar_connected: businessData.google_calendar_connected || false,
                });
            }

            // Load settings
            const { data: settingsData, error: settingsError } = await supabase
                .from('settings')
                .select('*')
                .eq('business_id', businessId)
                .single();

            if (settingsError && settingsError.code !== 'PGRST116') {
                console.error('Error loading settings:', settingsError);
            } else if (settingsData) {
                setSettings(settingsData);
                setCrmStatus({
                    type: settingsData.crm_provider || 'Boulevard',
                    connected: !!settingsData.crm_webhook_url,
                    webhook_url: settingsData.crm_webhook_url || `https://api.scalewithjak.com/webhooks/crm/${businessId}`,
                    last_received: '',
                });
                setNotifications({
                    negative_sentiment_alerts: settingsData.notification_sms || false,
                    daily_summary_email: settingsData.notification_email_enabled || false,
                    owner_phone: '',
                    owner_email: settingsData.notification_email || '',
                });
            } else {
                // Set default webhook URL if no settings exist
                setCrmStatus(prev => ({
                    ...prev,
                    webhook_url: `https://api.scalewithjak.com/webhooks/crm/${businessId}`,
                }));
            }

            // Load treatment templates
            const { data: treatmentsData, error: treatmentsError } = await supabase
                .from('treatment_templates')
                .select('*')
                .eq('business_id', businessId)
                .order('name', { ascending: true });

            if (treatmentsError) {
                console.error('Error loading treatments:', treatmentsError);
            } else if (treatmentsData) {
                setTreatments(treatmentsData.map(t => ({
                    id: t.id,
                    name: t.name,
                    category: t.category || '',
                    default_duration_minutes: t.default_duration_minutes || 60,
                    default_price: t.default_price || 0,
                    review_request_delay_hours: t.review_request_delay_hours || 48,
                    is_active: t.is_active ?? true,
                })));
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        } finally {
            setLoading(false);
        }
    }

    async function saveBusinessSettings() {
        if (!businessId) return;

        setSaving(true);
        try {
            const { error } = await supabase
                .from('businesses')
                .update({
                    name: businessInfo.name,
                    phone: businessInfo.phone,
                    email: businessInfo.email,
                    address: businessInfo.address,
                    city: businessInfo.city,
                    state: businessInfo.state,
                    zip: businessInfo.zip,
                    timezone: businessInfo.timezone,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', businessId);

            if (error) throw error;
            toast.success('Business settings saved successfully');
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    }

    async function saveNotificationSettings() {
        if (!businessId) return;

        setSaving(true);
        try {
            const settingsPayload = {
                business_id: businessId,
                notification_email: notifications.owner_email,
                notification_sms: notifications.negative_sentiment_alerts,
                notification_email_enabled: notifications.daily_summary_email,
                updated_at: new Date().toISOString(),
            };

            if (settings?.id) {
                // Update existing settings
                const { error } = await supabase
                    .from('settings')
                    .update(settingsPayload)
                    .eq('id', settings.id);

                if (error) throw error;
            } else {
                // Insert new settings
                const { error } = await supabase
                    .from('settings')
                    .insert(settingsPayload);

                if (error) throw error;
            }

            toast.success('Notification settings saved successfully');
        } catch (error) {
            console.error('Error saving notification settings:', error);
            toast.error('Failed to save notification settings');
        } finally {
            setSaving(false);
        }
    }

    async function saveIntegrationSettings() {
        if (!businessId) return;

        setSaving(true);
        try {
            // Update CRM settings
            const settingsPayload = {
                business_id: businessId,
                crm_provider: crmStatus.type,
                crm_webhook_url: crmStatus.webhook_url,
                updated_at: new Date().toISOString(),
            };

            if (settings?.id) {
                const { error } = await supabase
                    .from('settings')
                    .update(settingsPayload)
                    .eq('id', settings.id);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('settings')
                    .insert(settingsPayload);

                if (error) throw error;
            }

            toast.success('Integration settings saved successfully');
        } catch (error) {
            console.error('Error saving integration settings:', error);
            toast.error('Failed to save integration settings');
        } finally {
            setSaving(false);
        }
    }

    async function saveTreatment(treatment: TreatmentTemplateUI) {
        if (!businessId) return;

        setSaving(true);
        try {
            const treatmentPayload = {
                business_id: businessId,
                name: treatment.name,
                category: treatment.category,
                default_duration_minutes: treatment.default_duration_minutes,
                default_price: treatment.default_price,
                review_request_delay_hours: treatment.review_request_delay_hours,
                is_active: treatment.is_active,
                updated_at: new Date().toISOString(),
            };

            if (treatment.id && !treatment.id.startsWith('new-')) {
                // Update existing
                const { error } = await supabase
                    .from('treatment_templates')
                    .update(treatmentPayload)
                    .eq('id', treatment.id);

                if (error) throw error;

                setTreatments(prev => prev.map(t => t.id === treatment.id ? treatment : t));
            } else {
                // Insert new
                const { data, error } = await supabase
                    .from('treatment_templates')
                    .insert(treatmentPayload)
                    .select()
                    .single();

                if (error) throw error;

                setTreatments(prev => [...prev, {
                    ...treatment,
                    id: data.id,
                }]);
            }

            setShowTreatmentModal(false);
            setEditingTreatment(null);
            toast.success('Treatment saved successfully');
        } catch (error) {
            console.error('Error saving treatment:', error);
            toast.error('Failed to save treatment');
        } finally {
            setSaving(false);
        }
    }

    async function deleteTreatment(treatmentId: string) {
        if (!confirm('Are you sure you want to delete this treatment?')) return;

        try {
            const { error } = await supabase
                .from('treatment_templates')
                .delete()
                .eq('id', treatmentId);

            if (error) throw error;

            setTreatments(prev => prev.filter(t => t.id !== treatmentId));
            toast.success('Treatment deleted successfully');
        } catch (error) {
            console.error('Error deleting treatment:', error);
            toast.error('Failed to delete treatment');
        }
    }

    async function loadKnowledge() {
        if (!businessId) return;
        setKnowledgeLoading(true);
        try {
            const res = await fetch(`/api/knowledge?business_id=${businessId}`);
            if (res.ok) {
                const data = await res.json();
                setKnowledgeEntries(data.entries || []);
            }
        } catch (e) {
            console.error('Failed to load knowledge base:', e);
        } finally {
            setKnowledgeLoading(false);
        }
    }

    async function saveKnowledgeEntry(entry: KnowledgeEntry) {
        if (!businessId) return;
        setKnowledgeSaving(true);
        try {
            const res = await fetch('/api/knowledge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...entry, business_id: businessId }),
            });
            if (!res.ok) throw new Error('Failed to save');
            const data = await res.json();
            if (entry.id) {
                setKnowledgeEntries(prev => prev.map(e => e.id === entry.id ? { ...entry, ...data.entry } : e));
            } else {
                setKnowledgeEntries(prev => [...prev, data.entry]);
            }
            setShowKnowledgeModal(false);
            setEditingEntry(null);
            toast.success('Knowledge entry saved' + (data.embedded ? ' with AI embedding' : ' (no embedding — check OpenAI key)'));
        } catch (e) {
            toast.error('Failed to save knowledge entry');
        } finally {
            setKnowledgeSaving(false);
        }
    }

    async function deleteKnowledgeEntry(id: string) {
        if (!businessId || !confirm('Delete this knowledge entry?')) return;
        try {
            const res = await fetch(`/api/knowledge?id=${id}&business_id=${businessId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            setKnowledgeEntries(prev => prev.filter(e => e.id !== id));
            toast.success('Entry deleted');
        } catch (e) {
            toast.error('Failed to delete entry');
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard!');
    };

    const testGoogleReviewLink = () => {
        window.open(businessInfo.google_review_url, '_blank');
    };

    const isWebhookHealthy = () => {
        if (!crmStatus.last_received) return false;
        const lastReceived = new Date(crmStatus.last_received);
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return lastReceived > twentyFourHoursAgo;
    };

    const tabs = [
        { id: 'business' as Tab, label: 'Business Info', icon: Building2 },
        { id: 'treatments' as Tab, label: 'Treatment Templates', icon: FileText },
        { id: 'knowledge' as Tab, label: 'AI Knowledge Base', icon: BookOpen },
        { id: 'crm' as Tab, label: 'CRM Connection', icon: Webhook },
        { id: 'notifications' as Tab, label: 'Notifications', icon: Bell },
        { id: 'integrations' as Tab, label: 'Integrations', icon: SettingsIcon },
        { id: 'billing' as Tab, label: 'Billing', icon: CreditCard },
    ];

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
                        <p className="text-muted-foreground">Please log in to view settings.</p>
                    </div>
                </main>
            </>
        );
    }

    return (
        <>
            <main className="container mx-auto p-6">
                <div className="space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
                        <p className="text-muted-foreground mt-2">Manage your business configuration and integrations</p>
                    </div>

                    {/* Tabs */}
                    <div className="border-b border-border">
                        <nav className="-mb-px flex space-x-8 overflow-x-auto">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === tab.id
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span>{tab.label}</span>
                                    </button>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Tab Content */}
                    <div className="bg-card rounded-lg shadow-sm border border-border p-6 text-card-foreground">
                        {/* Business Info Tab */}
                        {activeTab === 'business' && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Business Name</label>
                                        <input
                                            type="text"
                                            value={businessInfo.name}
                                            onChange={(e) => setBusinessInfo({ ...businessInfo, name: e.target.value })}
                                            className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Phone</label>
                                        <input
                                            type="tel"
                                            value={businessInfo.phone}
                                            onChange={(e) => setBusinessInfo({ ...businessInfo, phone: e.target.value })}
                                            className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                                        <input
                                            type="email"
                                            value={businessInfo.email}
                                            onChange={(e) => setBusinessInfo({ ...businessInfo, email: e.target.value })}
                                            className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Timezone</label>
                                        <select
                                            value={businessInfo.timezone}
                                            onChange={(e) => setBusinessInfo({ ...businessInfo, timezone: e.target.value })}
                                            className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                                        >
                                            <option value="America/Los_Angeles">Pacific Time</option>
                                            <option value="America/Denver">Mountain Time</option>
                                            <option value="America/Chicago">Central Time</option>
                                            <option value="America/New_York">Eastern Time</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-foreground mb-1">Street Address</label>
                                        <input
                                            type="text"
                                            value={businessInfo.address}
                                            onChange={(e) => setBusinessInfo({ ...businessInfo, address: e.target.value })}
                                            className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">City</label>
                                        <input
                                            type="text"
                                            value={businessInfo.city}
                                            onChange={(e) => setBusinessInfo({ ...businessInfo, city: e.target.value })}
                                            className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">State</label>
                                        <input
                                            type="text"
                                            value={businessInfo.state}
                                            onChange={(e) => setBusinessInfo({ ...businessInfo, state: e.target.value })}
                                            className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">ZIP Code</label>
                                        <input
                                            type="text"
                                            value={businessInfo.zip}
                                            onChange={(e) => setBusinessInfo({ ...businessInfo, zip: e.target.value })}
                                            className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Google Review Link</label>
                                    <div className="flex space-x-2">
                                        <input
                                            type="url"
                                            value={businessInfo.google_review_url}
                                            onChange={(e) => setBusinessInfo({ ...businessInfo, google_review_url: e.target.value })}
                                            className="flex-1 px-4 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                                            placeholder="https://g.page/r/YOUR_BUSINESS_ID/review"
                                        />
                                        <button
                                            onClick={testGoogleReviewLink}
                                            disabled={!businessInfo.google_review_url}
                                            className="flex items-center space-x-2 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted/50 disabled:opacity-50"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            <span>Test Link</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Business Hours */}
                                <div>
                                    <h3 className="text-lg font-semibold text-foreground mb-4">Business Hours</h3>
                                    <div className="space-y-3">
                                        {Object.entries(businessInfo.business_hours).map(([day, hours]) => (
                                            <div key={day} className="grid grid-cols-4 gap-4 items-center">
                                                <div className="font-medium text-foreground capitalize">{day}</div>
                                                <input
                                                    type="time"
                                                    value={hours.open}
                                                    onChange={(e) => setBusinessInfo({
                                                        ...businessInfo,
                                                        business_hours: {
                                                            ...businessInfo.business_hours,
                                                            [day]: { ...hours, open: e.target.value },
                                                        },
                                                    })}
                                                    disabled={hours.closed}
                                                    className="px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-transparent disabled:bg-muted disabled:text-muted-foreground"
                                                />
                                                <input
                                                    type="time"
                                                    value={hours.close}
                                                    onChange={(e) => setBusinessInfo({
                                                        ...businessInfo,
                                                        business_hours: {
                                                            ...businessInfo.business_hours,
                                                            [day]: { ...hours, close: e.target.value },
                                                        },
                                                    })}
                                                    disabled={hours.closed}
                                                    className="px-4 py-2 bg-background border border-input rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-transparent disabled:bg-muted disabled:text-muted-foreground"
                                                />
                                                <label className="flex items-center space-x-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={hours.closed}
                                                        onChange={(e) => setBusinessInfo({
                                                            ...businessInfo,
                                                            business_hours: {
                                                                ...businessInfo.business_hours,
                                                                [day]: { ...hours, closed: e.target.checked },
                                                            },
                                                        })}
                                                        className="rounded border-input text-primary focus:ring-primary"
                                                    />
                                                    <span className="text-sm text-muted-foreground">Closed</span>
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={saveBusinessSettings}
                                    disabled={saving}
                                    className="flex items-center space-x-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                                >
                                    <Save className="w-5 h-5" />
                                    <span>{saving ? 'Saving...' : 'Save Business Info'}</span>
                                </button>
                            </div>
                        )}

                        {/* Treatment Templates Tab */}
                        {activeTab === 'treatments' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-foreground">Treatment Templates</h3>
                                    <button
                                        onClick={() => {
                                            setEditingTreatment({
                                                id: `new-${Date.now()}`,
                                                name: '',
                                                category: '',
                                                default_duration_minutes: 60,
                                                default_price: 0,
                                                review_request_delay_hours: 48,
                                                is_active: true,
                                            });
                                            setShowTreatmentModal(true);
                                        }}
                                        className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
                                    >
                                        <Plus className="w-5 h-5" />
                                        <span>Add Treatment</span>
                                    </button>
                                </div>

                                {treatments.length === 0 ? (
                                    <div className="text-center py-12">
                                        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                        <p className="text-muted-foreground">No treatment templates found</p>
                                        <p className="text-sm text-gray-400 mt-1">Add your first treatment template to get started</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-border">
                                            <thead className="bg-muted/50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Category</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Duration</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Price</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Review Delay</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-background divide-y divide-border">
                                                {treatments.map((treatment) => (
                                                    <tr key={treatment.id}>
                                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground">{treatment.name}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">{treatment.category || '-'}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">{treatment.default_duration_minutes} min</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">${treatment.default_price}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">{treatment.review_request_delay_hours} hrs</td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${treatment.is_active ? 'bg-green-100 text-green-800' : 'bg-muted text-gray-800'
                                                                }`}>
                                                                {treatment.is_active ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center space-x-2">
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingTreatment(treatment);
                                                                        setShowTreatmentModal(true);
                                                                    }}
                                                                    className="text-primary hover:text-primary-dark"
                                                                >
                                                                    <Edit className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => deleteTreatment(treatment.id)}
                                                                    className="text-red-600 hover:text-red-900"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Treatment Modal */}
                                {showTreatmentModal && editingTreatment && (
                                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                        <div className="bg-card rounded-lg shadow-xl p-6 w-full max-w-md">
                                            <h3 className="text-lg font-semibold text-foreground mb-4">
                                                {editingTreatment.id.startsWith('new-') ? 'Add Treatment' : 'Edit Treatment'}
                                            </h3>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                                                    <input
                                                        type="text"
                                                        value={editingTreatment.name}
                                                        onChange={(e) => setEditingTreatment({ ...editingTreatment, name: e.target.value })}
                                                        className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-foreground mb-1">Category</label>
                                                    <input
                                                        type="text"
                                                        value={editingTreatment.category}
                                                        onChange={(e) => setEditingTreatment({ ...editingTreatment, category: e.target.value })}
                                                        className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                                                        placeholder="e.g., Injectables, Laser, Skincare"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-foreground mb-1">Duration (min)</label>
                                                        <input
                                                            type="number"
                                                            value={editingTreatment.default_duration_minutes}
                                                            onChange={(e) => setEditingTreatment({ ...editingTreatment, default_duration_minutes: parseInt(e.target.value) || 0 })}
                                                            className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-foreground mb-1">Price ($)</label>
                                                        <input
                                                            type="number"
                                                            value={editingTreatment.default_price}
                                                            onChange={(e) => setEditingTreatment({ ...editingTreatment, default_price: parseFloat(e.target.value) || 0 })}
                                                            className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-foreground mb-1">Review Request Delay (hours)</label>
                                                    <input
                                                        type="number"
                                                        value={editingTreatment.review_request_delay_hours}
                                                        onChange={(e) => setEditingTreatment({ ...editingTreatment, review_request_delay_hours: parseInt(e.target.value) || 0 })}
                                                        className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                                                    />
                                                </div>
                                                <label className="flex items-center space-x-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={editingTreatment.is_active}
                                                        onChange={(e) => setEditingTreatment({ ...editingTreatment, is_active: e.target.checked })}
                                                        className="rounded border-input text-primary focus:ring-primary"
                                                    />
                                                    <span className="text-sm text-foreground">Active</span>
                                                </label>
                                            </div>
                                            <div className="flex justify-end space-x-3 mt-6">
                                                <button
                                                    onClick={() => {
                                                        setShowTreatmentModal(false);
                                                        setEditingTreatment(null);
                                                    }}
                                                    className="px-4 py-2 border border-input rounded-lg hover:bg-muted/50"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => saveTreatment(editingTreatment)}
                                                    disabled={saving || !editingTreatment.name}
                                                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
                                                >
                                                    {saving ? 'Saving...' : 'Save'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* CRM Connection Tab */}
                        {activeTab === 'crm' && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-muted/50 rounded-lg p-4">
                                        <h4 className="font-semibold text-foreground mb-2">CRM Type</h4>
                                        <select
                                            value={crmStatus.type}
                                            onChange={(e) => setCrmStatus({ ...crmStatus, type: e.target.value })}
                                            className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                                        >
                                            <option value="Boulevard">Boulevard</option>
                                            <option value="Zenoti">Zenoti</option>
                                            <option value="Vagaro">Vagaro</option>
                                            <option value="Mindbody">Mindbody</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-4">
                                        <h4 className="font-semibold text-foreground mb-2">Connection Status</h4>
                                        <div className="flex items-center space-x-2">
                                            {crmStatus.connected ? (
                                                <>
                                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                                    <span className="text-green-700">Connected</span>
                                                </>
                                            ) : (
                                                <>
                                                    <XCircle className="w-5 h-5 text-red-500" />
                                                    <span className="text-red-700">Disconnected</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Webhook URL</label>
                                    <div className="flex space-x-2">
                                        <input
                                            type="text"
                                            value={crmStatus.webhook_url}
                                            readOnly
                                            className="flex-1 px-4 py-2 border border-input rounded-lg bg-muted/50"
                                        />
                                        <button
                                            onClick={() => copyToClipboard(crmStatus.webhook_url)}
                                            className="flex items-center space-x-2 px-4 py-2 border border-input rounded-lg hover:bg-muted/50"
                                        >
                                            <Copy className="w-4 h-4" />
                                            <span>Copy</span>
                                        </button>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Add this URL to your CRM&apos;s webhook settings to receive appointment and client updates.
                                    </p>
                                </div>

                                <div className="bg-muted/50 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-semibold text-foreground">Webhook Health</h4>
                                        {crmStatus.last_received ? (
                                            isWebhookHealthy() ? (
                                                <div className="flex items-center space-x-2 text-green-700">
                                                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                                    <span className="text-sm">Healthy</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center space-x-2 text-red-700">
                                                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                                    <span className="text-sm">No Recent Activity</span>
                                                </div>
                                            )
                                        ) : (
                                            <div className="flex items-center space-x-2 text-muted-foreground">
                                                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                                                <span className="text-sm">No data yet</span>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {crmStatus.last_received
                                            ? `Last received: ${new Date(crmStatus.last_received).toLocaleString()}`
                                            : 'Waiting for first webhook...'}
                                    </p>
                                </div>

                                <button
                                    onClick={saveIntegrationSettings}
                                    disabled={saving}
                                    className="flex items-center space-x-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                                >
                                    <Save className="w-5 h-5" />
                                    <span>{saving ? 'Saving...' : 'Save CRM Settings'}</span>
                                </button>
                            </div>
                        )}

                        {/* Notifications Tab */}
                        {activeTab === 'notifications' && (
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <label className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-foreground">Negative Sentiment Alerts</p>
                                            <p className="text-sm text-muted-foreground">Send SMS alerts when negative feedback is detected</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={notifications.negative_sentiment_alerts}
                                            onChange={(e) => setNotifications({ ...notifications, negative_sentiment_alerts: e.target.checked })}
                                            className="rounded border-input text-primary focus:ring-primary w-5 h-5"
                                        />
                                    </label>

                                    <label className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-foreground">Daily Summary Email</p>
                                            <p className="text-sm text-muted-foreground">Receive daily performance summary via email</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={notifications.daily_summary_email}
                                            onChange={(e) => setNotifications({ ...notifications, daily_summary_email: e.target.checked })}
                                            className="rounded border-input text-primary focus:ring-primary w-5 h-5"
                                        />
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Owner Alert Phone</label>
                                        <input
                                            type="tel"
                                            value={notifications.owner_phone}
                                            onChange={(e) => setNotifications({ ...notifications, owner_phone: e.target.value })}
                                            className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                                            placeholder="+1 (555) 123-4567"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Owner Alert Email</label>
                                        <input
                                            type="email"
                                            value={notifications.owner_email}
                                            onChange={(e) => setNotifications({ ...notifications, owner_email: e.target.value })}
                                            className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                                            placeholder="owner@example.com"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={saveNotificationSettings}
                                    disabled={saving}
                                    className="flex items-center space-x-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                                >
                                    <Save className="w-5 h-5" />
                                    <span>{saving ? 'Saving...' : 'Save Notification Settings'}</span>
                                </button>
                            </div>
                        )}

                        {/* Integrations Tab */}
                        {activeTab === 'integrations' && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-muted/50 rounded-lg p-4">
                                        <h4 className="font-semibold text-foreground mb-2">VAPI Phone Number</h4>
                                        <p className="text-foreground font-mono">{integrations.vapi_phone || 'Not configured'}</p>
                                        <p className="text-xs text-muted-foreground mt-1">Used for SMS & AI calls</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-4">
                                        <h4 className="font-semibold text-foreground mb-2">VAPI Assistant Status</h4>
                                        <div className="flex items-center space-x-2">
                                            {integrations.vapi_status === 'active' ? (
                                                <>
                                                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                                    <span className="text-green-700 capitalize">{integrations.vapi_status}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                                                    <span className="text-muted-foreground capitalize">{integrations.vapi_status}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Booking Link</label>
                                    <input
                                        type="url"
                                        value={integrations.booking_url}
                                        onChange={(e) => setIntegrations({ ...integrations, booking_url: e.target.value })}
                                        className="w-full px-4 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                                        placeholder="https://cal.com/yourbusiness"
                                    />
                                    <p className="text-sm text-muted-foreground mt-1">Cal.com URL or custom booking page</p>
                                </div>

                                <div className="bg-muted/50 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h4 className="font-semibold text-foreground mb-1">Google Calendar Setup</h4>
                                        <p className="text-sm text-muted-foreground">Connect Google Calendar for 2-way sync to appointments.</p>
                                    </div>
                                    <div>
                                        {integrations.google_calendar_connected ? (
                                            <div className="flex items-center space-x-2 px-4 py-2 border border-green-200 bg-green-50 text-green-700 rounded-lg font-medium">
                                                <CheckCircle className="w-5 h-5" />
                                                <span>Connected</span>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => window.location.href = `/api/google-calendar/auth?business_id=${businessId}`}
                                                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
                                            >
                                                Connect Google Calendar
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Calendar Sync Controls */}
                                {integrations.google_calendar_connected && (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="font-semibold text-green-900 mb-1">Calendar Sync</h4>
                                                <p className="text-sm text-green-700">Sync appointments with Google Calendar</p>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const res = await fetch(`/api/calendar/sync?business_id=${businessId}`, { method: 'POST' });
                                                        const data = await res.json();
                                                        alert(data.success ? `Synced! To Google: ${data.result.toGoogle.synced}, From Google: ${data.result.fromGoogle.synced}` : 'Sync failed');
                                                    } catch (e) {
                                                        alert('Sync error');
                                                    }
                                                }}
                                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                                            >
                                                Sync Now
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Aria — ElevenLabs ConvAI Agent */}
                                <AriaAgentPanel />

                                {/* ElevenLabs Voice */}
                                <ElevenLabsVoicePanel />

                                {/* Automation Engine Controls */}
                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                    <h4 className="font-semibold text-purple-900 mb-2">AI Automation Engine</h4>
                                    <p className="text-sm text-purple-700 mb-4">
                                        Automatically sends follow-ups, review requests, and reactivation messages
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const res = await fetch('/api/automations/process', { method: 'POST' });
                                                    const data = await res.json();
                                                    alert(data.success ? `Processed automations! Check results in console.` : 'Processing failed');
                                                    console.log('Automation results:', data);
                                                } catch (e) {
                                                    alert('Automation error');
                                                }
                                            }}
                                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                                        >
                                            Run Automations
                                        </button>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const res = await fetch('/api/automations/send', { method: 'POST' });
                                                    const data = await res.json();
                                                    alert(`Sent ${data.results.sms_sent} SMS, ${data.results.email_sent} emails`);
                                                } catch (e) {
                                                    alert('Send error');
                                                }
                                            }}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                                        >
                                            Send Pending Messages
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <h4 className="font-semibold text-blue-900 mb-2">API Key Management</h4>
                                    <p className="text-sm text-blue-800 mb-3">
                                        For advanced users: Manage API keys for custom integrations
                                    </p>
                                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                                        Manage API Keys
                                    </button>
                                </div>

                                <button
                                    onClick={saveIntegrationSettings}
                                    disabled={saving}
                                    className="flex items-center space-x-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                                >
                                    <Save className="w-5 h-5" />
                                    <span>{saving ? 'Saving...' : 'Save Integration Settings'}</span>
                                </button>
                            </div>
                        )}

                        {/* Knowledge Base Tab */}
                        {activeTab === 'knowledge' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xl font-semibold text-foreground">AI Knowledge Base</h2>
                                        <p className="text-sm text-muted-foreground mt-1">Train your AI with business-specific info. The AI uses this during calls to answer questions accurately.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={loadKnowledge}
                                            disabled={knowledgeLoading}
                                            className="px-3 py-2 text-sm border border-input rounded-lg hover:bg-muted/50 disabled:opacity-50"
                                        >
                                            {knowledgeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
                                        </button>
                                        <button
                                            onClick={syncAssistant}
                                            disabled={syncing}
                                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50"
                                        >
                                            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                            {syncing ? 'Syncing...' : 'Sync AI'}
                                        </button>
                                        <button
                                            onClick={() => { setEditingEntry({ category: 'service', title: '', content: '' }); setShowKnowledgeModal(true); }}
                                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium"
                                        >
                                            <Plus className="w-4 h-4" /> Add Entry
                                        </button>
                                    </div>
                                </div>

                                {/* Category quick-add buttons */}
                                <div className="flex flex-wrap gap-2">
                                    {['service', 'faq', 'pricing', 'hours', 'policy', 'staff', 'location', 'general'].map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => { setEditingEntry({ category: cat, title: '', content: '' }); setShowKnowledgeModal(true); }}
                                            className="px-3 py-1 text-xs border border-dashed border-input rounded-full text-muted-foreground hover:border-primary hover:text-primary capitalize"
                                        >
                                            + {cat}
                                        </button>
                                    ))}
                                </div>

                                {knowledgeLoading ? (
                                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                                ) : knowledgeEntries.length === 0 ? (
                                    <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
                                        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-muted-foreground font-medium">No knowledge entries yet</p>
                                        <p className="text-gray-400 text-sm mt-1">Add services, FAQs, pricing, and hours so your AI can answer caller questions accurately.</p>
                                        <button
                                            onClick={loadKnowledge}
                                            className="mt-4 text-sm text-primary hover:underline"
                                        >
                                            Load entries
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {(['service', 'pricing', 'hours', 'faq', 'policy', 'staff', 'location', 'general'] as const).map(cat => {
                                            const catEntries = knowledgeEntries.filter((e: any) => e.category === cat);
                                            if (catEntries.length === 0) return null;
                                            return (
                                                <div key={cat} className="border border-border rounded-lg overflow-hidden">
                                                    <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
                                                        <span className="text-sm font-semibold text-foreground capitalize">{cat} ({catEntries.length})</span>
                                                        <button
                                                            onClick={() => { setEditingEntry({ category: cat, title: '', content: '' }); setShowKnowledgeModal(true); }}
                                                            className="text-xs text-primary hover:underline"
                                                        >+ Add</button>
                                                    </div>
                                                    {catEntries.map((entry: any) => (
                                                        <div key={entry.id} className="px-4 py-3 border-t border-gray-100 flex items-start justify-between gap-4">
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-foreground">{entry.title}</p>
                                                                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{entry.content}</p>
                                                            </div>
                                                            <div className="flex gap-2 shrink-0">
                                                                <button
                                                                    onClick={() => { setEditingEntry(entry); setShowKnowledgeModal(true); }}
                                                                    className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded"
                                                                >
                                                                    <Edit className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => deleteKnowledgeEntry(entry.id)}
                                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Add/Edit Modal */}
                                {showKnowledgeModal && editingEntry && (
                                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                                        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
                                            <h3 className="text-lg font-semibold">{editingEntry.id ? 'Edit' : 'Add'} Knowledge Entry</h3>
                                            <div>
                                                <label className="block text-sm font-medium text-foreground mb-1">Category</label>
                                                <select
                                                    value={editingEntry.category}
                                                    onChange={e => setEditingEntry({ ...editingEntry, category: e.target.value })}
                                                    className="w-full px-3 py-2 border border-input rounded-lg text-sm"
                                                >
                                                    {['service', 'faq', 'pricing', 'hours', 'policy', 'staff', 'location', 'general'].map(c => (
                                                        <option key={c} value={c} className="capitalize">{c}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-foreground mb-1">Title</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Botox Treatment, Cancellation Policy"
                                                    value={editingEntry.title}
                                                    onChange={e => setEditingEntry({ ...editingEntry, title: e.target.value })}
                                                    className="w-full px-3 py-2 border border-input rounded-lg text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-foreground mb-1">Content</label>
                                                <textarea
                                                    rows={5}
                                                    placeholder="Describe this in natural language. The AI will use this to answer caller questions."
                                                    value={editingEntry.content}
                                                    onChange={e => setEditingEntry({ ...editingEntry, content: e.target.value })}
                                                    className="w-full px-3 py-2 border border-input rounded-lg text-sm resize-none"
                                                />
                                            </div>
                                            <div className="flex gap-3 pt-2">
                                                <button
                                                    onClick={() => { setShowKnowledgeModal(false); setEditingEntry(null); }}
                                                    className="flex-1 px-4 py-2 border border-input rounded-lg text-sm hover:bg-muted/50"
                                                >Cancel</button>
                                                <button
                                                    onClick={() => saveKnowledgeEntry(editingEntry)}
                                                    disabled={knowledgeSaving || !editingEntry.title || !editingEntry.content}
                                                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {knowledgeSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Entry'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Billing Tab */}
                        {activeTab === 'billing' && businessId && (
                            <BillingTab businessId={businessId} />
                        )}
                    </div>
                </div>
            </main>
        </>
    );

}

function AriaAgentPanel() {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [twilioSid, setTwilioSid] = useState('');
    const [twilioToken, setTwilioToken] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [connected, setConnected] = useState(false);
    const [connectedNumber, setConnectedNumber] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Check if already connected
        fetch('/api/elevenlabs/phone')
            .then(r => r.json())
            .then(data => {
                if (data.phone_numbers?.length > 0) {
                    setConnected(true);
                    setConnectedNumber(data.phone_numbers[0].phone_number);
                }
            })
            .catch(() => {});
    }, []);

    async function connectPhone() {
        setConnecting(true);
        setError('');
        try {
            const res = await fetch('/api/elevenlabs/phone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone_number: phoneNumber,
                    twilio_account_sid: twilioSid || undefined,
                    twilio_auth_token: twilioToken || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setConnected(true);
            setConnectedNumber(phoneNumber);
            setShowForm(false);
            toast.success(`${phoneNumber} connected — Aria will answer all calls`);
        } catch (e: any) {
            setError(e.message || 'Failed to connect phone number');
            toast.error('Failed to connect phone number');
        } finally {
            setConnecting(false);
        }
    }

    return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h4 className="font-semibold text-white mb-1">Aria — ElevenLabs Voice Agent</h4>
                    <p className="text-sm text-gray-400">Agent ID: agent_5101kjkx6dh8e3q8v6hxry0s0cyv</p>
                </div>
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-green-900/40 border border-green-700 rounded-full text-xs text-green-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                    Live
                </span>
            </div>

            {connected ? (
                <div className="flex items-center gap-2 mb-3 p-2 bg-green-900/20 border border-green-800 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                    <span className="text-sm text-green-300">Phone connected: <strong>{connectedNumber}</strong> — Aria answers all inbound calls</span>
                </div>
            ) : null}

            <div className="flex gap-2 flex-wrap">
                <a
                    href="/calls"
                    className="px-3 py-1.5 bg-[#6C47FF] text-white rounded-lg text-sm hover:opacity-90"
                >
                    Test Aria Live
                </a>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="px-3 py-1.5 bg-gray-700 text-gray-200 rounded-lg text-sm hover:bg-gray-600"
                >
                    {connected ? 'Change Phone Number' : 'Connect Phone Number'}
                </button>
            </div>

            {showForm && (
                <div className="mt-4 space-y-3">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Phone Number (E.164 format)</label>
                        <input
                            type="text"
                            placeholder="+15551234567"
                            value={phoneNumber}
                            onChange={e => setPhoneNumber(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg text-sm focus:ring-2 focus:ring-[#6C47FF] outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Twilio Account SID (optional if set in env)</label>
                        <input
                            type="text"
                            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            value={twilioSid}
                            onChange={e => setTwilioSid(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg text-sm focus:ring-2 focus:ring-[#6C47FF] outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Twilio Auth Token (optional if set in env)</label>
                        <input
                            type="password"
                            placeholder="••••••••••••••••••••••••••••••••"
                            value={twilioToken}
                            onChange={e => setTwilioToken(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg text-sm focus:ring-2 focus:ring-[#6C47FF] outline-none"
                        />
                    </div>
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <div className="flex gap-2">
                        <button
                            onClick={connectPhone}
                            disabled={connecting || !phoneNumber}
                            className="px-4 py-2 bg-[#6C47FF] text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
                        >
                            {connecting ? 'Connecting...' : 'Connect to Aria'}
                        </button>
                        <button
                            onClick={() => setShowForm(false)}
                            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function ElevenLabsVoicePanel() {
    const [voices, setVoices] = useState<{ voice_id: string; name: string; category: string; preview_url: string }[]>([]);
    const [currentVoiceId, setCurrentVoiceId] = useState('');
    const [selectedVoiceId, setSelectedVoiceId] = useState('');
    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState(false);
    const [error, setError] = useState('');

    async function loadVoices() {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/vapi/voice');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setVoices(data.voices || []);
            setCurrentVoiceId(data.current_voice_id || '');
            setSelectedVoiceId(data.current_voice_id || '');
        } catch (e: any) {
            setError(e.message || 'Failed to load voices');
        } finally {
            setLoading(false);
        }
    }

    async function applyVoice() {
        if (!selectedVoiceId) return;
        setApplying(true);
        setError('');
        try {
            const res = await fetch('/api/vapi/voice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ voice_id: selectedVoiceId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setCurrentVoiceId(selectedVoiceId);
            toast.success('Voice applied to AI receptionist');
        } catch (e: any) {
            setError(e.message || 'Failed to apply voice');
            toast.error('Failed to apply voice');
        } finally {
            setApplying(false);
        }
    }

    const selectedVoice = voices.find(v => v.voice_id === selectedVoiceId);

    return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h4 className="font-semibold text-white mb-1">ElevenLabs AI Voice</h4>
                    <p className="text-sm text-gray-400">Set the voice for your AI receptionist</p>
                </div>
                {voices.length === 0 && (
                    <button
                        onClick={loadVoices}
                        disabled={loading}
                        className="px-4 py-2 bg-[#6C47FF] text-white rounded-lg hover:opacity-90 text-sm font-medium disabled:opacity-50"
                    >
                        {loading ? 'Loading...' : 'Load Voices'}
                    </button>
                )}
            </div>

            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

            {voices.length > 0 && (
                <div className="space-y-3">
                    <select
                        value={selectedVoiceId}
                        onChange={(e) => setSelectedVoiceId(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg text-sm focus:ring-2 focus:ring-[#6C47FF] outline-none"
                    >
                        <option value="">Select a voice...</option>
                        {voices.map(v => (
                            <option key={v.voice_id} value={v.voice_id}>
                                {v.name} {v.category === 'cloned' ? '(Cloned)' : `(${v.category})`}
                            </option>
                        ))}
                    </select>

                    {selectedVoice?.preview_url && (
                        <audio controls src={selectedVoice.preview_url} className="w-full h-9" />
                    )}

                    <div className="flex items-center gap-3">
                        <button
                            onClick={applyVoice}
                            disabled={applying || !selectedVoiceId || selectedVoiceId === currentVoiceId}
                            className="px-4 py-2 bg-[#6C47FF] text-white rounded-lg hover:opacity-90 text-sm font-medium disabled:opacity-50"
                        >
                            {applying ? 'Applying...' : 'Apply Voice'}
                        </button>
                        {currentVoiceId && (
                            <span className="text-xs text-gray-400">
                                Active: {voices.find(v => v.voice_id === currentVoiceId)?.name || currentVoiceId}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────
// Billing Tab Component
// ─────────────────────────────────────────────
const PLAN_INFO = {
  starter: { name: 'Starter', price: 297, icon: Zap, color: 'text-blue-600', bg: 'bg-blue-50', features: ['50 AI calls/mo', '200 SMS/mo', '2 campaigns', '200 clients'] },
  growth: { name: 'Growth', price: 497, icon: Star, color: 'text-purple-600', bg: 'bg-purple-50', features: ['150 AI calls/mo', '500 SMS/mo', '5 campaigns', '500 clients'] },
  enterprise: { name: 'Enterprise', price: 997, icon: Crown, color: 'text-amber-600', bg: 'bg-amber-50', features: ['Unlimited calls', 'Unlimited SMS', 'Unlimited campaigns', 'Dedicated manager'] },
};

function BillingTab({ businessId }: { businessId: string }) {
  const [subData, setSubData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    const { createBrowserClient } = require('@supabase/ssr');
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    Promise.all([
      sb.from('businesses').select('subscription_plan, subscription_status, subscription_current_period_end, mrr, stripe_customer_id').eq('id', businessId).single(),
      sb.from('subscription_history').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(5),
    ]).then((results: any[]) => {
      setSubData(results[0].data);
      setHistory(results[1].data || []);
    }).finally(() => setLoading(false));
  }, [businessId]);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const plan = subData?.subscription_plan || 'starter';
  const status = subData?.subscription_status || 'active';
  const periodEnd = subData?.subscription_current_period_end;
  const planInfo = PLAN_INFO[plan as keyof typeof PLAN_INFO] || PLAN_INFO.starter;
  const PlanIcon = planInfo.icon;

  const statusColor = status === 'active' ? 'bg-green-100 text-green-800' :
                      status === 'past_due' ? 'bg-red-100 text-red-800' :
                      status === 'trial' ? 'bg-blue-100 text-blue-800' :
                      'bg-muted text-gray-800';

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <div className={`rounded-xl border-2 p-6 ${planInfo.bg} border-current/10`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${planInfo.bg} flex items-center justify-center`}>
              <PlanIcon className={`w-6 h-6 ${planInfo.color}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">{planInfo.name} Plan</h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor}`}>
                  {status}
                </span>
              </div>
              <p className="text-2xl font-bold mt-1">${planInfo.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
            </div>
          </div>

          {subData?.stripe_customer_id ? (
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Manage Billing
            </button>
          ) : (
            <a
              href="/pricing"
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
            >
              <TrendingUp className="h-4 w-4" />
              Upgrade Plan
            </a>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {planInfo.features.map(f => (
            <div key={f} className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
              <span>{f}</span>
            </div>
          ))}
        </div>

        {periodEnd && (
          <p className="mt-4 text-xs text-muted-foreground">
            Next billing date: {new Date(periodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>

      {/* Payment History */}
      {history.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Billing History</h4>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Event</th>
                  <th className="text-left p-3 font-medium">Plan</th>
                  <th className="text-right p-3 font-medium">Amount</th>
                  <th className="text-right p-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h: any) => (
                  <tr key={h.id} className="border-t">
                    <td className="p-3 capitalize">{h.event_type.replace('_', ' ')}</td>
                    <td className="p-3 capitalize">{h.to_plan || h.from_plan || '—'}</td>
                    <td className="p-3 text-right">{h.amount_cents ? `$${(h.amount_cents / 100).toFixed(2)}` : '—'}</td>
                    <td className="p-3 text-right text-muted-foreground">{new Date(h.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Need help */}
      <div className="rounded-lg bg-muted/50 p-4 flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground">
          <p>Questions about your plan? Contact your account manager or email <span className="font-medium text-foreground">support@scalewithjak.com</span></p>
        </div>
      </div>
    </div>
  );
}
