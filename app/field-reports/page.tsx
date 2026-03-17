'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/dashboard/StatCard';
import {
  ClipboardList, DollarSign, TrendingUp,
  FileText, Mic, ExternalLink, CheckCircle,
  AlertCircle, ChevronDown, ChevronUp, Loader2, MessageSquare, RefreshCw
} from 'lucide-react';

interface FieldReport {
  id: string;
  reportId: string;
  client: string;
  pet?: string;
  service: string;
  provider: string;
  time: string;
  invoice: string;
  invoiceUrl: string;
  invoicePaid: boolean;
  hasUpsell: boolean;
  upsell: string | null;
  notes: string;
  followUp: boolean;
}

const MOCK_REPORTS: FieldReport[] = [
  {
    id: 'RPT-20250304-090012', reportId: 'RPT-20250304-090012',
    client: 'Sarah M.', pet: 'Bella (Lab)', service: 'Wellness Exam',
    provider: 'Dr. Johnson', time: '9:00 AM', invoice: '$185.00', invoiceUrl: '#',
    invoicePaid: true, hasUpsell: true,
    upsell: 'Joint supplement recommendation for aging Lab',
    notes: 'Weight 52 lbs — slightly overweight. Vaccines administered. Early tartar buildup noted — dental cleaning recommended within 6 months. All vitals normal.',
    followUp: false,
  },
  {
    id: 'RPT-20250304-100530', reportId: 'RPT-20250304-100530',
    client: 'Tom R.', pet: 'Max (Beagle)', service: 'Vaccination',
    provider: 'Dr. Johnson', time: '10:00 AM', invoice: '$95.00', invoiceUrl: '#',
    invoicePaid: false, hasUpsell: false, upsell: null,
    notes: 'Annual vaccines administered: Rabies, DHPP. No concerns noted. Client asked about heartworm prevention — recommended ProHeart.',
    followUp: false,
  },
  {
    id: 'RPT-20250304-110045', reportId: 'RPT-20250304-110045',
    client: 'Lisa K.', pet: 'Luna (Cat)', service: 'Dental Cleaning',
    provider: 'Dr. Patel', time: '11:00 AM', invoice: '$420.00', invoiceUrl: '#',
    invoicePaid: true, hasUpsell: true,
    upsell: 'Dental care home kit + follow-up cleaning in 6 months',
    notes: 'Full dental cleaning performed under anesthesia. Extracted 2 fractured premolars. Recovery excellent. Sent home with soft food instructions for 5 days.',
    followUp: true,
  },
];

export default function FieldReportsPage() {
  const [reports, setReports] = useState<FieldReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [voiceNote, setVoiceNote] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [followupSending, setFollowupSending] = useState<string | null>(null);
  const [followupSent, setFollowupSent] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/field-reports');
      const data = await res.json();
      if (data.reports && data.reports.length > 0) {
        setReports(data.reports);
        setUsingMock(false);
      } else {
        setReports(MOCK_REPORTS);
        setUsingMock(true);
      }
    } catch {
      setReports(MOCK_REPORTS);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const totalRevenue = reports.reduce(
    (sum, r) => sum + parseFloat(r.invoice.replace('$', '').replace(',', '')), 0
  );
  const paid = reports.filter(r => r.invoicePaid).length;
  const withUpsell = reports.filter(r => r.hasUpsell).length;

  const handleSubmit = async () => {
    if (!voiceNote.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/field-reports/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceNote }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.report) {
          const newReport: FieldReport = {
            id: data.report.id,
            reportId: data.report.reportId,
            client: 'New Client',
            service: data.report.service,
            provider: data.report.provider || '',
            time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            invoice: data.report.invoice,
            invoiceUrl: data.report.invoiceUrl || '#',
            invoicePaid: false,
            hasUpsell: data.report.hasUpsell,
            upsell: data.report.upsell || null,
            notes: data.report.notes,
            followUp: data.report.followUp,
          };
          setReports(prev => [newReport, ...prev]);
        }
        setSubmitSuccess(true);
        setVoiceNote('');
        setTimeout(() => setSubmitSuccess(false), 3000);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendFollowup = async (report: FieldReport) => {
    setFollowupSending(report.id);
    try {
      await fetch('/api/field-reports/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: report.id,
          clientName: report.client,
          service: report.service,
          sendNow: true,
        }),
      });
      setFollowupSent(report.id);
      setReports(prev => prev.map(r => r.id === report.id ? { ...r, followUp: false } : r));
      setTimeout(() => setFollowupSent(null), 3000);
    } finally {
      setFollowupSending(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Field Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Voice notes → AI service reports → Stripe invoices, automated
          </p>
          {usingMock && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              ⚡ Demo mode — run migration 008 in Supabase for live reports
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={fetchReports} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Reports Today" value={reports.length} icon={ClipboardList} variant="info" />
        <StatCard title="Revenue Generated" value={`$${totalRevenue.toLocaleString()}`} icon={DollarSign} variant="success" />
        <StatCard title="Invoices Paid" value={`${paid}/${reports.length}`} icon={CheckCircle} variant="primary" />
        <StatCard title="Upsells Identified" value={withUpsell} icon={TrendingUp} variant="warning" />
      </div>

      {/* Quick Submit */}
      <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl border-white/20 dark:border-gray-700/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Mic className="h-4 w-4 text-primary" />
            Submit Field Note
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="w-full h-24 text-sm bg-muted/50 border border-border rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            placeholder="Paste voice transcription or type notes... e.g. 'Completed wellness exam on Bella, administered rabies and DHPP vaccines, noted early tartar buildup...'"
            value={voiceNote}
            onChange={(e) => setVoiceNote(e.target.value)}
          />
          <div className="flex gap-3 items-center">
            <Button
              onClick={handleSubmit}
              disabled={submitting || !voiceNote.trim()}
              className="gap-2"
            >
              {submitting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <FileText className="h-4 w-4" />
              }
              {submitting ? 'Generating report + invoice...' : 'Generate Report & Invoice'}
            </Button>
            {submitSuccess && (
              <span className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" /> Report created!
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl border-white/20 dark:border-gray-700/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Today&apos;s Reports</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading reports...
            </div>
          ) : (
            <div className="divide-y divide-border">
              {reports.map((report) => (
                <div key={report.id} className="px-6 py-4">
                  {/* Report Row */}
                  <div
                    className="flex items-center gap-4 cursor-pointer"
                    onClick={() => setExpanded(expanded === report.id ? null : report.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{report.client}</p>
                        {report.pet && (
                          <>
                            <span className="text-muted-foreground text-xs">·</span>
                            <p className="text-xs text-muted-foreground">{report.pet}</p>
                          </>
                        )}
                        <span className="text-muted-foreground text-xs">·</span>
                        <p className="text-xs text-muted-foreground">{report.time}</p>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {report.service}{report.provider ? ` — ${report.provider}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {report.hasUpsell && (
                        <Badge className="text-xs border-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          Upsell
                        </Badge>
                      )}
                      {report.followUp && (
                        <Badge className="text-xs border-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          Follow-up
                        </Badge>
                      )}
                      <Badge className={`text-xs border-0 ${
                        report.invoicePaid
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {report.invoicePaid ? '✓ Paid' : 'Unpaid'}
                      </Badge>
                      <span className="text-sm font-semibold">{report.invoice}</span>
                      {expanded === report.id
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      }
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {expanded === report.id && (
                    <div className="mt-4 space-y-3 pl-0">
                      <div className="bg-muted/40 rounded-lg p-4 text-sm text-muted-foreground leading-relaxed">
                        {report.notes}
                      </div>

                      {report.hasUpsell && (
                        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-lg p-3">
                          <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Upsell Opportunity</p>
                            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">{report.upsell}</p>
                          </div>
                        </div>
                      )}

                      {report.followUp && (
                        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            <span className="text-xs text-blue-600 dark:text-blue-400">Follow-up appointment required</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-xs text-blue-600 border-blue-300 hover:bg-blue-50"
                            onClick={(e) => { e.stopPropagation(); handleSendFollowup(report); }}
                            disabled={followupSending === report.id}
                          >
                            {followupSending === report.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <MessageSquare className="h-3 w-3" />
                            }
                            {followupSent === report.id ? 'SMS Sent!' : 'Send Follow-up SMS'}
                          </Button>
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" className="gap-1 text-xs h-8" asChild>
                          <a href={report.invoiceUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3 w-3" />
                            {report.invoicePaid ? 'View Invoice' : 'Send Invoice'}
                          </a>
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-xs h-8">
                          <FileText className="h-3 w-3" />
                          Download Report
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Report ID: {report.reportId}</p>
                    </div>
                  )}
                </div>
              ))}

              {reports.length === 0 && (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  No reports today. Submit a field note above to generate one.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
