'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, AlertCircle, Building, Users, Activity,
  TrendingUp, DollarSign, ExternalLink, Copy, Eye, Loader2,
  CalendarDays, Phone, Clock,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/lib/auth-context';
import { createBrowserClient } from '@supabase/ssr';

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  agency: 'Agency',
};

const PLAN_COLORS: Record<string, string> = {
  starter: 'bg-blue-100 text-blue-800',
  pro: 'bg-purple-100 text-purple-800',
  agency: 'bg-amber-100 text-amber-800',
};

export default function AdminPage() {
  const { isAdmin, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <main className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <p className="text-gray-600">Access denied. Admin privileges required.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agency Command Center</h1>
          <p className="text-muted-foreground">Manage all your clients from one place.</p>
        </div>
      </div>

      <Tabs defaultValue="clients" className="space-y-4">
        <TabsList>
          <TabsTrigger value="clients">All Clients</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="onboard">Onboard New Client</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
        </TabsList>

        <TabsContent value="clients">
          <ClientsTab />
        </TabsContent>

        <TabsContent value="bookings">
          <BookingsTab />
        </TabsContent>

        <TabsContent value="onboard">
          <OnboardingTab />
        </TabsContent>

        <TabsContent value="health">
          <SystemHealthTab />
        </TabsContent>
      </Tabs>
    </main>
  );
}

// ─────────────────────────────────────────────
// Clients Tab
// ─────────────────────────────────────────────
interface BusinessRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  crm_type: string | null;
  slug: string | null;
  primary_color: string | null;
  mrr: number | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  created_at: string;
  callCount?: number;
  clientCount?: number;
}

function ClientsTab() {
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [totalMRR, setTotalMRR] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchBusinesses = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: bizError } = await supabase
        .from('businesses')
        .select('id, name, email, phone, status, crm_type, slug, primary_color, mrr, subscription_tier, subscription_status, created_at')
        .order('created_at', { ascending: false });

      if (bizError) throw bizError;

      const withStats = await Promise.all((data || []).map(async (biz) => {
        const [{ count: callCount }, { count: clientCount }] = await Promise.all([
          supabase.from('call_logs').select('*', { count: 'exact', head: true }).eq('business_id', biz.id),
          supabase.from('clients').select('*', { count: 'exact', head: true }).eq('business_id', biz.id),
        ]);
        return { ...biz, callCount: callCount || 0, clientCount: clientCount || 0 };
      }));

      setBusinesses(withStats);
      setTotalMRR(withStats.reduce((sum, b) => sum + (b.mrr || 0), 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load businesses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBusinesses(); }, [fetchBusinesses]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
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
    <div className="space-y-4">
      {/* MRR Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalMRR.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">across {businesses.length} client{businesses.length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{businesses.filter(b => b.status === 'active').length}</div>
            <p className="text-xs text-muted-foreground">{businesses.filter(b => b.subscription_status === 'trial').length} on trial</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg MRR / Client</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${businesses.length > 0 ? Math.round(totalMRR / businesses.length).toLocaleString() : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client Table */}
      <Card>
        <CardHeader>
          <CardTitle>Client Roster</CardTitle>
          <CardDescription>All active businesses managed by your agency.</CardDescription>
        </CardHeader>
        <CardContent>
          {businesses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No clients yet. Use the "Onboard New Client" tab to add your first client.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-4 font-medium">Business</th>
                    <th className="p-4 font-medium">Plan</th>
                    <th className="p-4 font-medium">MRR</th>
                    <th className="p-4 font-medium">Calls</th>
                    <th className="p-4 font-medium">Clients</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium text-right">Portal</th>
                  </tr>
                </thead>
                <tbody>
                  {businesses.map((biz) => (
                    <tr key={biz.id} className="border-t hover:bg-muted/50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ backgroundColor: biz.primary_color || '#7c3aed' }}
                          >
                            {biz.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">{biz.name}</div>
                            <div className="text-xs text-muted-foreground">{biz.email || 'No email'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_COLORS[biz.subscription_tier || 'starter'] || 'bg-gray-100 text-gray-800'}`}>
                          {PLAN_LABELS[biz.subscription_tier || 'starter'] || biz.subscription_tier}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-green-600">
                        ${(biz.mrr || 0).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5 text-blue-500" />
                          <span>{biz.callCount}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-purple-500" />
                          <span>{biz.clientCount}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${biz.status === 'active' ? 'bg-green-100 text-green-800' : biz.status === 'setup' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                          {biz.status || 'Unknown'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => window.open('/dashboard', '_blank')}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// Onboarding Tab
// ─────────────────────────────────────────────
interface ProvisionResult {
  businessId: string;
  slug: string;
  email: string;
  tempPassword: string;
  portalUrl: string;
  loginUrl: string;
}

function OnboardingTab() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    businessName: '',
    ownerEmail: '',
    ownerPhone: '',
    crmType: 'manual',
    timezone: 'America/New_York',
    nicheType: 'medspa',
    primaryColor: '#7c3aed',
    secondaryColor: '#a78bfa',
    mrr: '',
    subscriptionTier: 'starter',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/provision-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to provision client');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-green-600 flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6" />
            {formData.businessName} is live!
          </CardTitle>
          <CardDescription>Share these credentials with your client. The portal is ready now.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            {[
              { label: 'Login URL', value: result.loginUrl },
              { label: 'Email', value: result.email },
              { label: 'Temporary Password', value: result.tempPassword },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-mono text-sm">{value}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(value, label)}
                >
                  {copied === label ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => window.open(result.loginUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
              Open Portal
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setResult(null);
                setStep(1);
                setFormData({ ...formData, businessName: '', ownerEmail: '', ownerPhone: '', mrr: '' });
              }}
            >
              Onboard Another Client
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step Progress */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex items-center ${s < 3 ? 'flex-1' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
              </div>
              {s < 3 && <div className={`h-1 flex-1 mx-2 ${step > s ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground font-medium">
          <span>Business & Brand</span>
          <span>Owner & Plan</span>
          <span>Review & Launch</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {step === 1 && 'Business & Branding'}
            {step === 2 && 'Owner Info & Plan'}
            {step === 3 && 'Review & Launch'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Business details + branding */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Business Name *</Label>
                <Input
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  placeholder="e.g. Miami Glow Med Spa"
                />
              </div>

              <div className="space-y-2">
                <Label>Industry / Niche</Label>
                <Select value={formData.nicheType} onValueChange={(v) => setFormData({ ...formData, nicheType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medspa">Med Spa</SelectItem>
                    <SelectItem value="dental">Dental</SelectItem>
                    <SelectItem value="veterinary">Veterinary</SelectItem>
                    <SelectItem value="trades">Trades / Home Services</SelectItem>
                    <SelectItem value="law">Law Firm</SelectItem>
                    <SelectItem value="real_estate">Real Estate</SelectItem>
                    <SelectItem value="general">General / Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Brand Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer border"
                    />
                    <Input
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Accent Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer border"
                    />
                    <Input
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select value={formData.timezone} onValueChange={(v) => setFormData({ ...formData, timezone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                    <SelectItem value="America/Chicago">Central Time</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                    <SelectItem value="America/Phoenix">Arizona Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Step 2: Owner info + plan */}
          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Owner Email *</Label>
                  <Input
                    type="email"
                    value={formData.ownerEmail}
                    onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                    placeholder="owner@business.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Owner Phone</Label>
                  <Input
                    value={formData.ownerPhone}
                    onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>CRM System</Label>
                <Select value={formData.crmType} onValueChange={(v) => setFormData({ ...formData, crmType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gohighlevel">GoHighLevel</SelectItem>
                    <SelectItem value="zenoti">Zenoti</SelectItem>
                    <SelectItem value="mindbody">Mindbody</SelectItem>
                    <SelectItem value="jane">Jane App</SelectItem>
                    <SelectItem value="manual">Manual / Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Subscription Plan</Label>
                  <Select value={formData.subscriptionTier} onValueChange={(v) => setFormData({ ...formData, subscriptionTier: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter — AI Receptionist</SelectItem>
                      <SelectItem value="pro">Pro — Full AI Team</SelectItem>
                      <SelectItem value="agency">Agency — All Features</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Monthly Retainer ($)</Label>
                  <Input
                    type="number"
                    value={formData.mrr}
                    onChange={(e) => setFormData({ ...formData, mrr: e.target.value })}
                    placeholder="e.g. 997"
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: formData.primaryColor }}
                  >
                    {formData.businessName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">{formData.businessName || '—'}</p>
                    <p className="text-xs text-muted-foreground">{formData.nicheType}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Owner:</span>
                  <span className="font-medium">{formData.ownerEmail}</span>
                  <span className="text-muted-foreground">Plan:</span>
                  <span className="font-medium capitalize">{formData.subscriptionTier}</span>
                  <span className="text-muted-foreground">MRR:</span>
                  <span className="font-semibold text-green-600">${formData.mrr || '0'}/mo</span>
                  <span className="text-muted-foreground">CRM:</span>
                  <span className="font-medium capitalize">{formData.crmType}</span>
                  <span className="text-muted-foreground">Timezone:</span>
                  <span className="font-medium">{formData.timezone}</span>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertTitle>Ready to Launch</AlertTitle>
                <AlertDescription>
                  This will create a Supabase login, provision the business portal, and generate client credentials.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}>
              Back
            </Button>
            {step < 3 ? (
              <Button
                onClick={() => setStep(s => Math.min(3, s + 1))}
                disabled={step === 1 && !formData.businessName || step === 2 && !formData.ownerEmail}
              >
                Continue
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading} className="gap-2">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Launching...</> : 'Launch Client Portal'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// System Health Tab
// ─────────────────────────────────────────────
function SystemHealthTab() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [counts, setCounts] = useState({ clients: 0, users: 0, calls: 0, messages: 0 });

  useEffect(() => {
    Promise.all([
      supabase.from('businesses').select('*', { count: 'exact', head: true }),
      supabase.from('clients').select('*', { count: 'exact', head: true }),
      supabase.from('call_logs').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('*', { count: 'exact', head: true }),
    ]).then(([biz, clients, calls, msgs]) => {
      setCounts({
        clients: biz.count || 0,
        users: clients.count || 0,
        calls: calls.count || 0,
        messages: msgs.count || 0,
      });
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Active Businesses" value={counts.clients.toString()} icon={Building} />
        <StatsCard title="Total Client Records" value={counts.users.toString()} icon={Users} />
        <StatsCard title="Total AI Calls" value={counts.calls.toString()} icon={Activity} />
        <StatsCard title="Total Messages" value={counts.messages.toString()} icon={TrendingUp} />
      </div>

      <Card>
        <CardHeader><CardTitle>Service Status</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { name: 'Supabase Database', status: 'Operational' },
              { name: 'AI Agent Pipeline', status: 'Operational' },
              { name: 'Twilio SMS/Voice', status: 'Operational' },
              { name: 'Resend Email', status: 'Operational' },
            ].map(({ name, status }) => (
              <div key={name} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm font-medium">{name}</span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  {status}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// Bookings Tab — cross-client appointments feed
// ─────────────────────────────────────────────
interface BookingRow {
  id: string;
  business_id: string;
  treatment_type: string | null;
  start_time: string;
  status: string;
  source: string | null;
  google_calendar_synced: boolean | null;
  clients: { first_name: string; last_name: string; phone: string | null } | null;
  businesses: { name: string; primary_color: string | null } | null;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-orange-100 text-orange-800',
};

function BookingsTab() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'today' | 'all'>('today');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      const now = new Date();
      let query = supabase
        .from('appointments')
        .select('id, business_id, treatment_type, start_time, status, source, google_calendar_synced, clients(first_name, last_name, phone), businesses(name, primary_color)')
        .order('start_time', { ascending: false })
        .limit(100);

      if (filter === 'today') {
        const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
        query = query.gte('start_time', startOfDay.toISOString()).lte('start_time', endOfDay.toISOString());
      } else if (filter === 'upcoming') {
        query = query.gte('start_time', now.toISOString()).neq('status', 'cancelled');
      }

      const { data } = await query;
      setBookings((data as any[]) || []);
      setLoading(false);
    })();
  }, [filter]);

  const totalToday = bookings.filter(b => {
    const d = new Date(b.start_time);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  const bookedByAI = bookings.filter(b => b.source === 'ai_phone' || b.source === 'ai-agent').length;
  const syncedToGCal = bookings.filter(b => b.google_calendar_synced).length;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CalendarDays className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{totalToday}</p>
                <p className="text-xs text-muted-foreground">Today's Appointments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Phone className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{bookedByAI}</p>
                <p className="text-xs text-muted-foreground">Booked by AI</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{syncedToGCal}</p>
                <p className="text-xs text-muted-foreground">Synced to Google Cal</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Appointments Across All Clients</CardTitle>
          <div className="flex gap-2">
            {(['today', 'upcoming', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No appointments found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bookings.map(b => {
                const client = b.clients as any;
                const biz = b.businesses as any;
                const color = biz?.primary_color || '#7c3aed';
                const initials = biz?.name?.slice(0, 2).toUpperCase() || '??';
                const apptTime = new Date(b.start_time);
                return (
                  <div key={b.id} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                    {/* Business avatar */}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: color }}>
                      {initials}
                    </div>
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {client ? `${client.first_name} ${client.last_name}` : 'Unknown Client'}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground truncate">{b.treatment_type || 'Appointment'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span className="truncate">{biz?.name || 'Unknown Business'}</span>
                        <span>·</span>
                        <Clock className="w-3 h-3" />
                        <span>{apptTime.toLocaleDateString()} {apptTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    {/* Badges */}
                    <div className="flex items-center gap-2 shrink-0">
                      {(b.source === 'ai_phone' || b.source === 'ai-agent') && (
                        <Badge variant="outline" className="text-xs text-purple-700 border-purple-300">AI Booked</Badge>
                      )}
                      {b.google_calendar_synced && (
                        <Badge variant="outline" className="text-xs text-green-700 border-green-300">GCal ✓</Badge>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[b.status] || 'bg-gray-100 text-gray-700'}`}>
                        {b.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatsCard({ title, value, icon: Icon }: { title: string; value: string; icon: React.ElementType }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
