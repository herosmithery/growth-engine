'use client';

import { useEffect, useState, useCallback } from 'react';
import Script from 'next/script';
import {
  Phone, Clock, CheckCircle, PhoneCall, X, AlertCircle,
  Bot, Sparkles, Mic, RefreshCw, Calendar, User, ChevronLeft, ChevronRight,
  TrendingUp, PhoneOff, Info,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { PageLoading } from '@/components/ui/page-loading';
import { StatCard } from '@/components/dashboard/StatCard';

interface Call {
  id: string;
  caller_name: string | null;
  caller_phone: string;
  call_time: string;
  duration: number;
  outcome: 'booked' | 'callback_requested' | 'info_only' | 'dropped';
  transcript: any;
  summary: string | null;
  recording_url: string | null;
  vapi_call_id: string | null;
}

const OUTCOME_CONFIG = {
  booked:             { label: 'Booked',    icon: CheckCircle, bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  callback_requested: { label: 'Callback',  icon: PhoneCall,   bg: 'bg-amber-100 dark:bg-amber-900/30',   text: 'text-amber-700 dark:text-amber-400',   dot: 'bg-amber-500' },
  info_only:          { label: 'Info Only', icon: Info,        bg: 'bg-blue-100 dark:bg-blue-900/30',     text: 'text-blue-700 dark:text-blue-400',     dot: 'bg-blue-500' },
  dropped:            { label: 'Dropped',   icon: PhoneOff,    bg: 'bg-red-100 dark:bg-red-900/30',       text: 'text-red-700 dark:text-red-400',       dot: 'bg-red-400' },
};

function OutcomeBadge({ outcome }: { outcome: Call['outcome'] }) {
  const cfg = OUTCOME_CONFIG[outcome] || OUTCOME_CONFIG.info_only;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function formatDur(seconds: number) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const ITEMS = 20;

export default function CallsPage() {
  const { businessId, loading: authLoading } = useAuth();
  const [calls, setCalls]           = useState<Call[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected]     = useState<Call | null>(null);
  const [search, setSearch]         = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [page, setPage]             = useState(1);

  const loadCalls = useCallback(async (silent = false) => {
    if (!businessId) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res  = await fetch(`/api/dashboard/stats?business_id=${businessId}`);
      const json = await res.json();
      const raw  = json.allCalls || [];
      setCalls(raw.map((c: any): Call => ({
        id:           c.id,
        caller_name:  c.caller_name || null,
        caller_phone: c.caller_phone || 'Unknown',
        call_time:    c.created_at,
        duration:     c.duration_seconds || 0,
        outcome:      c.outcome || 'info_only',
        transcript:   c.transcript
          ? (typeof c.transcript === 'string' ? JSON.parse(c.transcript) : c.transcript)
          : [],
        summary:      c.summary || null,
        recording_url: c.recording_url || null,
        vapi_call_id: c.vapi_call_id || null,
      })));
    } catch (e) {
      console.error('loadCalls:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (!authLoading && businessId) loadCalls();
    else if (!authLoading && !businessId) setLoading(false);
  }, [businessId, authLoading, loadCalls]);

  // Auto-refresh every 30s to catch new calls
  useEffect(() => {
    if (!businessId) return;
    const t = setInterval(() => loadCalls(true), 30_000);
    return () => clearInterval(t);
  }, [businessId, loadCalls]);

  const filtered = calls.filter(c => {
    if (outcomeFilter !== 'all' && c.outcome !== outcomeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.caller_phone.includes(q) && !(c.caller_name?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS));
  const paged = filtered.slice((page - 1) * ITEMS, page * ITEMS);

  const stats = {
    total:    calls.length,
    booked:   calls.filter(c => c.outcome === 'booked').length,
    callback: calls.filter(c => c.outcome === 'callback_requested').length,
    avgDur:   calls.length ? Math.round(calls.reduce((a, c) => a + c.duration, 0) / calls.length) : 0,
  };

  if (authLoading || loading) return <PageLoading variant="skeleton" message="Loading AI call logs..." />;

  if (!businessId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-20 h-20 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-amber-500" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">AI Call Logs</h2>
          <p className="text-gray-500 dark:text-gray-400">Please sign in to view call logs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="AI Call Logs"
        description="Vapi AI agent — every call, booking, and transcript in real time"
        icon={Bot}
        badge={
          stats.booked > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              {stats.booked} booked
            </span>
          ) : null
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Calls"     value={stats.total}            icon={Phone}       variant="primary" />
        <StatCard title="Booked"          value={stats.booked}           icon={CheckCircle} variant="sage"    />
        <StatCard title="Callbacks"       value={stats.callback}         icon={PhoneCall}   variant="gold"    />
        <StatCard title="Avg Duration"    value={formatDur(stats.avgDur)} icon={Clock}      variant="lavender" />
      </div>

      {/* Vapi Agent Card */}
      <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-600/20 flex items-center justify-center shrink-0">
            <Mic className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-bold text-white">Vapi AI Agent — Aura</p>
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-sm text-gray-400">+1 (910) 370-8465 · Calls hang up automatically after booking</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => loadCalls(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-200 rounded-xl transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search name or phone…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent dark:text-white"
        />
        <select
          value={outcomeFilter}
          onChange={e => { setOutcomeFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-violet-500 dark:text-white"
        >
          <option value="all">All Outcomes</option>
          <option value="booked">Booked ✅</option>
          <option value="callback_requested">Callback</option>
          <option value="info_only">Info Only</option>
          <option value="dropped">Dropped</option>
        </select>
      </div>

      {/* Calls List */}
      {paged.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-16 text-center">
          <Phone className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">No calls yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Calls will appear here in real time as Vapi handles them</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {paged.map(call => (
              <div
                key={call.id}
                onClick={() => setSelected(call)}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer transition-colors"
              >
                {/* Outcome icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${OUTCOME_CONFIG[call.outcome]?.bg}`}>
                  {call.outcome === 'booked' ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : call.outcome === 'callback_requested' ? (
                    <PhoneCall className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  ) : call.outcome === 'dropped' ? (
                    <PhoneOff className="w-5 h-5 text-red-500" />
                  ) : (
                    <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  )}
                </div>

                {/* Caller info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                      {call.caller_name || call.caller_phone}
                    </span>
                    <OutcomeBadge outcome={call.outcome} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    {call.caller_name && <span>{call.caller_phone}</span>}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDur(call.duration)}
                    </span>
                    {call.summary && (
                      <span className="truncate max-w-xs hidden md:block">{call.summary.slice(0, 80)}…</span>
                    )}
                  </div>
                </div>

                {/* Time */}
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDistanceToNow(new Date(call.call_time), { addSuffix: true })}
                  </p>
                  <p className="text-xs text-gray-300 dark:text-gray-600 mt-0.5">
                    {format(new Date(call.call_time), 'MMM d')}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {filtered.length} calls · page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Call Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${OUTCOME_CONFIG[selected.outcome]?.bg}`}>
                  <OutcomeBadge outcome={selected.outcome} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    {selected.caller_name || selected.caller_phone}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {format(new Date(selected.call_time), 'MMMM d, yyyy · h:mm a')}
                    {' · '}{formatDur(selected.duration)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Booked banner */}
              {selected.outcome === 'booked' && (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl">
                  <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <p className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm">Appointment Booked</p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">AI booked & ended call · Synced to calendar</p>
                  </div>
                </div>
              )}

              {/* Summary */}
              {selected.summary && (
                <div className="p-4 bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/40 rounded-xl">
                  <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide mb-1.5">AI Summary</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200">{selected.summary}</p>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Phone', value: selected.caller_phone, icon: Phone },
                  { label: 'Duration', value: formatDur(selected.duration), icon: Clock },
                  { label: 'Outcome', value: OUTCOME_CONFIG[selected.outcome]?.label, icon: TrendingUp },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="w-3.5 h-3.5 text-gray-400" />
                      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
                  </div>
                ))}
              </div>

              {/* Transcript */}
              {selected.transcript && selected.transcript.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Transcript</p>
                  <div className="space-y-2.5">
                    {selected.transcript.map((msg: any, i: number) => {
                      const isAI = msg.role === 'ai' || msg.role === 'assistant' || msg.speaker === 'assistant';
                      return (
                        <div key={i} className={`flex gap-2.5 ${isAI ? '' : 'flex-row-reverse'}`}>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isAI ? 'bg-violet-100 dark:bg-violet-900/40' : 'bg-gray-100 dark:bg-gray-700'}`}>
                            {isAI ? (
                              <Bot className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                            ) : (
                              <User className="w-3.5 h-3.5 text-gray-500" />
                            )}
                          </div>
                          <div className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm ${
                            isAI
                              ? 'bg-violet-50 dark:bg-violet-900/20 text-gray-800 dark:text-gray-100 rounded-tl-sm'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-tr-sm'
                          }`}>
                            {msg.message || msg.text || msg.content || ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recording */}
              {selected.recording_url && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Recording</p>
                  <audio controls className="w-full rounded-lg">
                    <source src={selected.recording_url} type="audio/mpeg" />
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
