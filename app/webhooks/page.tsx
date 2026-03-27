'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { createBrowserClient } from '@supabase/ssr';
import {
  Webhook, Copy, Check, RefreshCw, Play, ExternalLink,
  CheckCircle2, XCircle, AlertCircle, Clock, Zap,
  Phone, CreditCard, Calendar, Bot, Activity, ChevronDown,
  Terminal, Link2, Settings2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface WebhookHealth {
  vapi: 'active' | 'degraded' | 'inactive' | 'unknown';
  stripe: 'active' | 'degraded' | 'inactive' | 'unknown';
  elevenlabs: 'active' | 'degraded' | 'inactive' | 'unknown';
  calendar: 'active' | 'degraded' | 'inactive' | 'unknown';
}

interface EventItem {
  id: string;
  source: string;
  event_type: string;
  summary: string;
  business: string;
  timestamp: string;
  status: 'success' | 'error' | 'warning' | 'info';
}

interface Counts {
  vapi_calls_24h: number;
  vapi_bookings_24h: number;
  stripe_events_24h: number;
  ai_bookings_7d: number;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function HealthBadge({ status }: { status: string }) {
  if (status === 'active') return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Active
    </span>
  );
  if (status === 'degraded') return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />Degraded
    </span>
  );
  if (status === 'inactive') return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Inactive
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />Unknown
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1.5 rounded hover:bg-muted transition-colors" title="Copy">
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
    </button>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
  if (status === 'error') return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
  if (status === 'warning') return <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0" />;
  return <Clock className="w-4 h-4 text-blue-400 shrink-0" />;
}

const SOURCE_COLORS: Record<string, string> = {
  vapi: 'bg-purple-100 text-purple-800',
  stripe: 'bg-blue-100 text-blue-800',
  elevenlabs: 'bg-orange-100 text-orange-800',
  calendar: 'bg-green-100 text-green-800',
};

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  vapi: <Phone className="w-3.5 h-3.5" />,
  stripe: <CreditCard className="w-3.5 h-3.5" />,
  elevenlabs: <Bot className="w-3.5 h-3.5" />,
  calendar: <Calendar className="w-3.5 h-3.5" />,
};

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function WebhooksPage() {
  const { businessId, isAdmin, loading: authLoading } = useAuth();
  const [health, setHealth] = useState<WebhookHealth>({ vapi: 'unknown', stripe: 'unknown', elevenlabs: 'unknown', calendar: 'unknown' });
  const [events, setEvents] = useState<EventItem[]>([]);
  const [counts, setCounts] = useState<Counts>({ vapi_calls_24h: 0, vapi_bookings_24h: 0, stripe_events_24h: 0, ai_bookings_7d: 0 });
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, any>>({});
  const [baseUrl, setBaseUrl] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('all');

  // Derive the app base URL
  useEffect(() => {
    const url = window.location.origin;
    setBaseUrl(url);
  }, []);

  const loadStatus = useCallback(async () => {
    if (!businessId && !isAdmin) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (businessId) params.set('business_id', businessId);
      if (isAdmin) params.set('admin', 'true');
      const res = await fetch(`/api/webhooks/status?${params}`);
      const data = await res.json();
      setHealth(data.health || {});
      setEvents(data.events || []);
      setCounts(data.counts || {});
    } catch (e) {
      console.error('Failed to load webhook status', e);
    } finally {
      setLoading(false);
    }
  }, [businessId, isAdmin]);

  useEffect(() => {
    if (!authLoading) loadStatus();
  }, [authLoading, loadStatus]);

  const runTest = async (type: string) => {
    setTesting(type);
    setTestResult(prev => ({ ...prev, [type]: null }));
    try {
      let res: Response;
      if (type === 'vapi') {
        res = await fetch('/api/vapi/test?scenario=booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      } else if (type === 'stripe') {
        res = await fetch('/api/stripe/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': 'test' }, body: '{}' });
      } else if (type === 'elevenlabs') {
        res = await fetch('/api/elevenlabs/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'tool-call', tool: 'checkAvailability', parameters: { date: new Date().toISOString() } }) });
      } else {
        res = await fetch(`/api/${type}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      }
      const data = await res.json().catch(() => ({ status: res.status }));
      setTestResult(prev => ({ ...prev, [type]: { ok: res.ok, status: res.status, data } }));
    } catch (e: any) {
      setTestResult(prev => ({ ...prev, [type]: { ok: false, error: e.message } }));
    } finally {
      setTesting(null);
      setTimeout(loadStatus, 1000);
    }
  };

  const filteredEvents = eventFilter === 'all' ? events : events.filter(e => e.source === eventFilter);

  // Webhook endpoint definitions
  const webhooks = [
    {
      id: 'vapi',
      name: 'Vapi AI Calls',
      icon: <Phone className="w-5 h-5 text-purple-600" />,
      color: 'border-purple-200 bg-purple-50/50',
      path: '/api/vapi/webhook',
      method: 'POST',
      health: health.vapi,
      events: ['call-start', 'call-end', 'end-of-call-report', 'function-call', 'transcript'],
      setup: [
        'Go to your Vapi Dashboard → Phone Numbers → select your number',
        'Under "Server URL" paste the webhook URL below',
        'Enable events: call-start, call-end, end-of-call-report, function-call',
        'Save and make a test call',
      ],
      docs: 'https://docs.vapi.ai/webhooks',
      counts: `${counts.vapi_calls_24h} calls / ${counts.vapi_bookings_24h} bookings (24h)`,
    },
    {
      id: 'stripe',
      name: 'Stripe Billing',
      icon: <CreditCard className="w-5 h-5 text-blue-600" />,
      color: 'border-blue-200 bg-blue-50/50',
      path: '/api/stripe/webhook',
      method: 'POST',
      health: health.stripe,
      events: ['checkout.session.completed', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.payment_succeeded', 'invoice.payment_failed'],
      setup: [
        'Go to Stripe Dashboard → Developers → Webhooks',
        'Click "Add endpoint" and paste the URL below',
        'Select events: checkout.session.completed, customer.subscription.*, invoice.payment_*',
        'Copy the Signing Secret and add it to .env.local as STRIPE_WEBHOOK_SECRET',
      ],
      docs: 'https://stripe.com/docs/webhooks',
      counts: `${counts.stripe_events_24h} events (24h)`,
    },
    {
      id: 'elevenlabs',
      name: 'ElevenLabs Voice',
      icon: <Bot className="w-5 h-5 text-orange-600" />,
      color: 'border-orange-200 bg-orange-50/50',
      path: '/api/elevenlabs/webhook',
      method: 'POST',
      health: health.elevenlabs,
      events: ['tool-call (checkAvailability)', 'tool-call (bookAppointment)'],
      setup: [
        'Go to ElevenLabs → Conversational AI → your Agent',
        'Under "Server URL" set the webhook URL below',
        'Add tools: checkAvailability, bookAppointment',
        'Set the server URL secret in your agent settings',
      ],
      docs: 'https://elevenlabs.io/docs/conversational-ai',
      counts: `${counts.ai_bookings_7d} AI bookings (7d)`,
    },
    {
      id: 'calendar',
      name: 'Google Calendar',
      icon: <Calendar className="w-5 h-5 text-green-600" />,
      color: 'border-green-200 bg-green-50/50',
      path: '/api/google-calendar/callback',
      method: 'GET (OAuth)',
      health: health.calendar,
      events: ['OAuth callback', 'Bidirectional sync via /api/calendar/sync'],
      setup: [
        'Go to Google Cloud Console → Credentials → OAuth 2.0',
        'Add Authorized redirect URI: {baseUrl}/api/google-calendar/callback',
        'Copy Client ID and Secret to .env.local',
        'Connect in Settings → Integrations → Google Calendar',
      ],
      docs: 'https://developers.google.com/calendar',
      counts: 'OAuth flow — connect in Settings',
      noTest: true,
    },
    {
      id: 'agency-reply',
      name: 'Agency Email Replies',
      icon: <Zap className="w-5 h-5 text-yellow-600" />,
      color: 'border-yellow-200 bg-yellow-50/50',
      path: '/api/agency/reply-webhook',
      method: 'POST',
      health: 'unknown' as const,
      events: ['email.reply (interested)', 'email.reply (objection)', 'email.reply (question)'],
      setup: [
        'In Resend Dashboard → Webhooks → add endpoint',
        'Paste the URL below',
        'Select event: email.replied',
        'Replies are auto-classified (interested/objection/question)',
      ],
      docs: 'https://resend.com/docs/webhooks',
      counts: 'Auto-classifies email intent',
      noTest: true,
    },
  ];

  return (
    <main className="container mx-auto p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Webhook Manager</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure, monitor, and test all your webhook integrations.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadStatus} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary health cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {webhooks.slice(0, 4).map(w => (
          <Card key={w.id} className="border">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                {w.icon}
                <HealthBadge status={w.id === 'calendar' ? health.calendar : health[w.id as keyof WebhookHealth] || 'unknown'} />
              </div>
              <p className="text-sm font-semibold">{w.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{w.counts}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="endpoints" className="space-y-4">
        <TabsList>
          <TabsTrigger value="endpoints"><Link2 className="w-3.5 h-3.5 mr-1.5" />Endpoints</TabsTrigger>
          <TabsTrigger value="events"><Activity className="w-3.5 h-3.5 mr-1.5" />Event Log</TabsTrigger>
          <TabsTrigger value="test"><Terminal className="w-3.5 h-3.5 mr-1.5" />Test</TabsTrigger>
        </TabsList>

        {/* ── Endpoints Tab ── */}
        <TabsContent value="endpoints" className="space-y-4">
          {/* Base URL info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Settings2 className="w-4 h-4" />Your Webhook Base URL</CardTitle>
              <CardDescription>Use this base URL when registering webhooks in external services. For production, deploy to Vercel and use your production domain.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted text-sm px-3 py-2 rounded-md font-mono truncate">{baseUrl || 'http://localhost:3000'}</code>
                <CopyButton value={baseUrl || 'http://localhost:3000'} />
              </div>
              {baseUrl.includes('localhost') && (
                <p className="text-xs text-yellow-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  You're on localhost. External services can't reach this URL. Use <strong className="font-mono mx-1">ngrok http 3000</strong> to expose it, or deploy to production.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Each webhook endpoint */}
          {webhooks.map(w => (
            <WebhookCard key={w.id} webhook={w} baseUrl={baseUrl} />
          ))}
        </TabsContent>

        {/* ── Event Log Tab ── */}
        <TabsContent value="events">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Recent Webhook Events</CardTitle>
                <CardDescription>Last 7 days across all integrations</CardDescription>
              </div>
              <div className="flex gap-1.5">
                {['all', 'vapi', 'stripe', 'elevenlabs'].map(f => (
                  <button
                    key={f}
                    onClick={() => setEventFilter(f)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${eventFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  >
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Webhook className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No events yet. Make a test call or send a test payment.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredEvents.map(ev => (
                    <div key={ev.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/40 transition-colors">
                      <StatusIcon status={ev.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${SOURCE_COLORS[ev.source] || 'bg-gray-100 text-gray-700'}`}>
                            {SOURCE_ICONS[ev.source]}
                            {ev.source}
                          </span>
                          <code className="text-xs text-muted-foreground font-mono">{ev.event_type}</code>
                        </div>
                        <p className="text-sm truncate mt-0.5">{ev.summary}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {ev.business !== '—' && <p className="text-xs text-muted-foreground">{ev.business}</p>}
                        <p className="text-xs text-muted-foreground">{new Date(ev.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Test Tab ── */}
        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Test Webhook Endpoints</CardTitle>
              <CardDescription>Fire test events to verify each integration is working end-to-end.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { id: 'vapi', name: 'Vapi — Booking Call', desc: 'Simulates a full AI call: check availability → book appointment → call end', icon: <Phone className="w-4 h-4" /> },
                { id: 'elevenlabs', name: 'ElevenLabs — Check Availability', desc: 'Sends a checkAvailability tool-call to the ElevenLabs webhook handler', icon: <Bot className="w-4 h-4" /> },
              ].map(t => (
                <div key={t.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                      {t.icon}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {testResult[t.id] && (
                      <span className={`text-xs font-medium ${testResult[t.id].ok ? 'text-green-600' : 'text-red-600'}`}>
                        {testResult[t.id].ok ? '✓ Passed' : `✗ ${testResult[t.id].status || 'Error'}`}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runTest(t.id)}
                      disabled={testing === t.id}
                    >
                      {testing === t.id
                        ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Running...</>
                        : <><Play className="w-3.5 h-3.5 mr-1.5" />Run Test</>
                      }
                    </Button>
                  </div>
                </div>
              ))}

              {/* Test results detail */}
              {Object.entries(testResult).some(([, v]) => v) && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Last Test Results</p>
                  {Object.entries(testResult).map(([key, val]) =>
                    val ? (
                      <details key={key} className="bg-muted/50 rounded-lg p-3 text-xs">
                        <summary className="cursor-pointer font-medium flex items-center gap-2">
                          {val.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-red-600" />}
                          {key} — HTTP {val.status}
                        </summary>
                        <pre className="mt-2 overflow-auto text-[11px] leading-relaxed">{JSON.stringify(val.data, null, 2)}</pre>
                      </details>
                    ) : null
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick webhook fire — raw POST */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Terminal className="w-4 h-4" />Direct Webhook Debug</CardTitle>
              <CardDescription>Copy these curl commands to test from your terminal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  label: 'Vapi — Booking end-of-call-report',
                  cmd: `curl -X POST ${baseUrl}/api/vapi/webhook \\
  -H "Content-Type: application/json" \\
  -d '{"message":{"type":"end-of-call-report","call":{"id":"debug-${Date.now()}","startedAt":"2026-01-01T10:00:00Z","endedAt":"2026-01-01T10:03:00Z"},"summary":"caller booked a botox appointment","endedReason":"hangup"},"customer":{"number":"+15551234567","name":"Test User"}}'`,
                },
                {
                  label: 'Vapi — Function call: bookAppointment',
                  cmd: `curl -X POST ${baseUrl}/api/vapi/webhook \\
  -H "Content-Type: application/json" \\
  -d '{"type":"function-call","call":{"id":"debug-fn-${Date.now()}"},"functionCall":{"name":"bookAppointment","parameters":{"customer_name":"Test User","customer_phone":"+15551234567","treatment_type":"Botox","datetime":"${new Date(Date.now() + 86400000).toISOString()}"}}}'`,
                },
              ].map(({ label, cmd }) => (
                <div key={label} className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <div className="relative bg-gray-950 rounded-lg p-3">
                    <code className="text-[11px] text-green-400 font-mono leading-relaxed whitespace-pre-wrap break-all">{cmd}</code>
                    <div className="absolute top-2 right-2">
                      <CopyButton value={cmd} />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}

// ─────────────────────────────────────────────
// Webhook Card Component
// ─────────────────────────────────────────────
function WebhookCard({ webhook, baseUrl }: { webhook: any; baseUrl: string }) {
  const [open, setOpen] = useState(false);
  const fullUrl = `${baseUrl}${webhook.path}`;

  return (
    <Card className={`border ${webhook.color}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-white border flex items-center justify-center shrink-0 shadow-sm">
              {webhook.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{webhook.name}</span>
                <HealthBadge status={webhook.health} />
                <Badge variant="outline" className="text-xs font-mono">{webhook.method}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{webhook.counts}</p>
              {/* URL row */}
              <div className="flex items-center gap-1.5 mt-2 bg-white border rounded-md px-3 py-1.5 max-w-lg">
                <code className="text-xs font-mono text-foreground flex-1 truncate">{fullUrl}</code>
                <CopyButton value={fullUrl} />
                {webhook.docs && (
                  <a href={webhook.docs} target="_blank" rel="noopener noreferrer" className="p-1 hover:text-primary transition-colors">
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  </a>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-1"
          >
            Setup guide
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Events list */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {webhook.events.map((ev: string) => (
            <span key={ev} className="text-[11px] font-mono bg-white border px-2 py-0.5 rounded text-muted-foreground">
              {ev}
            </span>
          ))}
        </div>

        {/* Setup guide (expandable) */}
        {open && (
          <div className="mt-4 pt-4 border-t space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Setup Instructions</p>
            {webhook.setup.map((step: string, i: number) => (
              <div key={i} className="flex gap-2.5 text-sm">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-muted-foreground text-xs leading-relaxed">{step.replace('{baseUrl}', baseUrl)}</p>
              </div>
            ))}
            {webhook.docs && (
              <a
                href={webhook.docs}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-2"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View official docs
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
