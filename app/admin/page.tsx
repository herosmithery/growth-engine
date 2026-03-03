'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, AlertCircle, Building, Users, Activity } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/lib/auth-context';
import { createBrowserClient } from '@supabase/ssr';

export default function AdminPage() {
    const { isAdmin, loading: authLoading } = useAuth();

    if (authLoading) {
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

    if (!isAdmin) {
        return (
            <>
                <main className="container mx-auto p-6">
                    <div className="flex flex-col items-center justify-center h-64 space-y-4">
                        <AlertCircle className="w-12 h-12 text-red-500" />
                        <p className="text-gray-600">Access denied. Admin privileges required.</p>
                    </div>
                </main>
            </>
        );
    }

    return (
        <>
            <main className="container mx-auto p-6 space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Super Admin Dashboard</h1>
                        <p className="text-muted-foreground">Manage all your clients from one place.</p>
                    </div>
                </div>

                <Tabs defaultValue="clients" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="clients">All Clients</TabsTrigger>
                        <TabsTrigger value="onboard">Onboard New Client</TabsTrigger>
                        <TabsTrigger value="health">System Health</TabsTrigger>
                    </TabsList>

                    <TabsContent value="clients">
                        <ClientsTab />
                    </TabsContent>

                    <TabsContent value="onboard">
                        <OnboardingTab />
                    </TabsContent>

                    <TabsContent value="health">
                        <SystemHealthTab />
                    </TabsContent>
                </Tabs>
            </main>
        </>
    );
}

interface Business {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    status: string | null;
    crm_type: string | null;
    created_at: string;
}

function ClientsTab() {
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        async function fetchBusinesses() {
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('businesses')
                    .select('id, name, phone, email, status, crm_type, created_at')
                    .order('created_at', { ascending: false });

                if (error) {
                    throw error;
                }

                setBusinesses(data || []);
            } catch (err) {
                console.error('Error fetching businesses:', err);
                setError(err instanceof Error ? err.message : 'Failed to load businesses');
            } finally {
                setLoading(false);
            }
        }

        fetchBusinesses();
    }, []);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Client Overview</CardTitle>
                    <CardDescription>View and manage all active businesses.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Client Overview</CardTitle>
                    <CardDescription>View and manage all active businesses.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Client Overview</CardTitle>
                <CardDescription>View and manage all active businesses.</CardDescription>
            </CardHeader>
            <CardContent>
                {businesses.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        No businesses found. Use the "Onboard New Client" tab to add your first client.
                    </div>
                ) : (
                    <div className="rounded-md border">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="p-4 font-medium">Business Name</th>
                                    <th className="p-4 font-medium">Status</th>
                                    <th className="p-4 font-medium">CRM</th>
                                    <th className="p-4 font-medium">Email</th>
                                    <th className="p-4 font-medium">Phone</th>
                                    <th className="p-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {businesses.map((business) => (
                                    <tr key={business.id} className="border-t hover:bg-muted/50">
                                        <td className="p-4 font-medium">{business.name}</td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${business.status === 'active'
                                                    ? 'bg-green-100 text-green-800'
                                                    : business.status === 'setup'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                {business.status || 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-muted-foreground">{business.crm_type || 'N/A'}</td>
                                        <td className="p-4 text-muted-foreground">{business.email || 'N/A'}</td>
                                        <td className="p-4 text-muted-foreground">{business.phone || 'N/A'}</td>
                                        <td className="p-4 text-right">
                                            <Button variant="outline" size="sm" className="mr-2">Manage</Button>
                                            <Button size="sm">Impersonate</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function OnboardingTab() {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        businessName: '',
        ownerEmail: '',
        ownerPhone: '',
        crmType: 'manual',
        timezone: 'America/New_York',
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState<any>(null);

    const handleSubmit = async () => {
        setLoading(true);
        // Simulate API call
        setTimeout(() => {
            setLoading(false);
            setSuccess({
                businessId: 'new-biz-uuid',
                tempPassword: 'random-password-123',
                webhookUrl: 'https://api.scalewithjak.com/api/webhooks/new-biz-uuid'
            });
            setStep(4);
        }, 2000);
    };

    if (success) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-green-600 flex items-center gap-2">
                        <CheckCircle2 className="h-6 w-6" />
                        Client Onboarded Successfully!
                    </CardTitle>
                    <CardDescription>Share these credentials with the client.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="p-4 bg-muted rounded-lg space-y-2">
                            <Label>Admin Login</Label>
                            <div className="font-mono text-sm">Email: {formData.ownerEmail}</div>
                            <div className="font-mono text-sm">Password: {success.tempPassword}</div>
                        </div>
                        <div className="p-4 bg-muted rounded-lg space-y-2">
                            <Label>Webhook URL</Label>
                            <div className="font-mono text-sm break-all">{success.webhookUrl}</div>
                        </div>
                    </div>
                    <Button onClick={() => { setSuccess(null); setStep(1); setFormData({ ...formData, businessName: '' }); }}>
                        Onboard Another Client
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className={`flex items-center ${s < 3 ? 'flex-1' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                }`}>
                                {s}
                            </div>
                            {s < 3 && <div className={`h-1 flex-1 mx-2 ${step > s ? 'bg-primary' : 'bg-muted'}`} />}
                        </div>
                    ))}
                </div>
                <div className="flex justify-between text-sm font-medium text-muted-foreground">
                    <span>Business Details</span>
                    <span>Owner Info & CRM</span>
                    <span>Review & Launch</span>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>
                        {step === 1 && 'Business Details'}
                        {step === 2 && 'Owner Info & Configuration'}
                        {step === 3 && 'Review Details'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {step === 1 && (
                        <>
                            <div className="space-y-2">
                                <Label>Business Name</Label>
                                <Input
                                    value={formData.businessName}
                                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                                    placeholder="e.g. Glow Med Spa"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Timezone</Label>
                                <Select
                                    value={formData.timezone}
                                    onValueChange={(v) => setFormData({ ...formData, timezone: v })}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="America/New_York">Eastern Time</SelectItem>
                                        <SelectItem value="America/Chicago">Central Time</SelectItem>
                                        <SelectItem value="America/Denver">Mountain Time</SelectItem>
                                        <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Owner Email</Label>
                                    <Input
                                        type="email"
                                        value={formData.ownerEmail}
                                        onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Owner Phone</Label>
                                    <Input
                                        value={formData.ownerPhone}
                                        onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>CRM System</Label>
                                <Select
                                    value={formData.crmType}
                                    onValueChange={(v) => setFormData({ ...formData, crmType: v })}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="gohighlevel">GoHighLevel</SelectItem>
                                        <SelectItem value="zenoti">Zenoti</SelectItem>
                                        <SelectItem value="mindbody">Mindbody</SelectItem>
                                        <SelectItem value="manual">Manual / Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    )}

                    {step === 3 && (
                        <div className="space-y-4">
                            <div className="bg-muted p-4 rounded-lg space-y-2">
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <span className="text-muted-foreground">Business:</span>
                                    <span className="font-medium">{formData.businessName}</span>
                                    <span className="text-muted-foreground">Owner:</span>
                                    <span className="font-medium">{formData.ownerEmail}</span>
                                    <span className="text-muted-foreground">CRM:</span>
                                    <span className="font-medium capitalize">{formData.crmType}</span>
                                </div>
                            </div>
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Ready to Launch</AlertTitle>
                                <AlertDescription>
                                    This will create the business, provision a phone number ($1.15), and send a welcome email.
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}

                    <div className="flex justify-between pt-4">
                        <Button variant="outline" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}>
                            Back
                        </Button>
                        {step < 3 ? (
                            <Button onClick={() => setStep(s => Math.min(3, s + 1))}>Continue</Button>
                        ) : (
                            <Button onClick={handleSubmit} disabled={loading}>
                                {loading ? 'Onboarding...' : 'Launch Client'}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function SystemHealthTab() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard title="Active Clients" value="3" icon={Building} />
            <StatsCard title="Total Users" value="12" icon={Users} />
            <StatsCard title="API Health" value="99.9%" icon={Activity} className="text-green-600" />
            <StatsCard title="Pending Tasks" value="0" icon={AlertCircle} />

            <Card className="col-span-full">
                <CardHeader>
                    <CardTitle>Recent Alerts</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-muted-foreground text-center py-8">
                        No active alerts. All systems operational.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function StatsCard({ title, value, icon: Icon, className }: any) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className={`h-4 w-4 text-muted-foreground ${className}`} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    );
}
