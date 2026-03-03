'use client';

import { useEffect, useState } from 'react';
import { Bot, Globe, Mail, CheckCircle, DollarSign, Hammer, Star, Users, TrendingUp, ExternalLink, RefreshCw } from 'lucide-react';

interface Prospect {
  id: string;
  name: string;
  website: string;
  email: string;
  owner_first_name: string;
  specific_service: string;
  website_score: number;
  niche: string;
  city: string;
  status: string;
  preview_blurred_url: string;
  preview_full_url: string;
  created_at: string;
}

const STAGES = [
  { key: 'discovered',  label: 'Discovered',  icon: Globe,        color: 'bg-gray-100 dark:bg-gray-800',       dot: 'bg-gray-400' },
  { key: 'emailed',    label: 'Emailed',      icon: Mail,         color: 'bg-blue-50 dark:bg-blue-900/20',     dot: 'bg-blue-500' },
  { key: 'replied',    label: 'Replied',      icon: Users,        color: 'bg-purple-50 dark:bg-purple-900/20', dot: 'bg-purple-500' },
  { key: 'demo_sent',  label: 'Demo Sent',    icon: TrendingUp,   color: 'bg-amber-50 dark:bg-amber-900/20',   dot: 'bg-amber-500' },
  { key: 'invoiced',   label: 'Invoiced',     icon: DollarSign,   color: 'bg-orange-50 dark:bg-orange-900/20', dot: 'bg-orange-500' },
  { key: 'paid',       label: 'Paid',         icon: CheckCircle,  color: 'bg-green-50 dark:bg-green-900/20',   dot: 'bg-green-500' },
  { key: 'building',   label: 'Building',     icon: Hammer,       color: 'bg-indigo-50 dark:bg-indigo-900/20', dot: 'bg-indigo-500' },
  { key: 'delivered',  label: 'Delivered',    icon: Star,         color: 'bg-teal-50 dark:bg-teal-900/20',     dot: 'bg-teal-500' },
];

function ScoreBar({ score }: { score: number }) {
  const pct = ((10 - score) / 10) * 100; // worse score = more opportunity
  const color = score <= 4 ? 'bg-red-500' : score <= 6 ? 'bg-amber-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 w-6">{score}/10</span>
    </div>
  );
}

function ProspectCard({ p }: { p: Prospect }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">{p.name}</p>
        {p.website && (
          <a href={p.website} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-purple-500 flex-shrink-0">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
      {p.specific_service && (
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{p.specific_service}</p>
      )}
      {p.website_score && <ScoreBar score={p.website_score} />}
      {p.preview_blurred_url && (
        <div className="relative rounded overflow-hidden h-16">
          <img src={p.preview_blurred_url} alt="Preview" className="w-full h-full object-cover object-top" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span className="text-white text-[10px] font-semibold bg-black/60 px-2 py-0.5 rounded">Preview</span>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400">{p.city}</span>
        {p.email && <span className="text-[10px] text-gray-400 truncate max-w-[120px]">{p.email}</span>}
      </div>
    </div>
  );
}

export default function AgencyPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/agency/prospects');
    const data = await res.json();
    setProspects(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const byStage = (key: string) => prospects.filter(p => p.status === key);

  const stats = {
    total: prospects.length,
    replied: prospects.filter(p => ['replied','demo_sent','invoiced','paid','building','delivered'].includes(p.status)).length,
    paid: prospects.filter(p => ['paid','building','delivered'].includes(p.status)).length,
    delivered: prospects.filter(p => p.status === 'delivered').length,
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Agency Pipeline</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Scale With JAK Automations</p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Prospects', value: stats.total, icon: Globe, color: 'text-blue-500' },
          { label: 'Engaged', value: stats.replied, icon: Users, color: 'text-purple-500' },
          { label: 'Paid Clients', value: stats.paid, icon: DollarSign, color: 'text-green-500' },
          { label: 'Sites Delivered', value: stats.delivered, icon: Star, color: 'text-amber-500' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
            <s.icon className={`w-8 h-8 ${s.color}`} />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Kanban */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {STAGES.map(stage => {
            const cards = byStage(stage.key);
            const Icon = stage.icon;
            return (
              <div key={stage.key} className="w-56 flex-shrink-0">
                {/* Column header */}
                <div className={`${stage.color} rounded-t-lg px-3 py-2 flex items-center justify-between mb-2 border border-gray-200 dark:border-gray-700`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{stage.label}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 bg-white/60 dark:bg-black/30 px-1.5 py-0.5 rounded-full">
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {cards.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg h-16 flex items-center justify-center">
                      <span className="text-xs text-gray-400">Empty</span>
                    </div>
                  ) : (
                    cards.map(p => <ProspectCard key={p.id} p={p} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick commands */}
      <div className="bg-gray-900 rounded-xl p-5 text-white">
        <p className="text-sm font-semibold text-gray-300 mb-3">Run Pipeline Commands</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono text-gray-400">
          <div className="bg-black/40 rounded-lg p-3">
            <p className="text-purple-400 mb-1"># Find leads</p>
            <p>python agents/prospector.py \</p>
            <p className="ml-2">--niche "dentist" \</p>
            <p className="ml-2">--city "Austin, TX"</p>
          </div>
          <div className="bg-black/40 rounded-lg p-3">
            <p className="text-purple-400 mb-1"># Generate previews</p>
            <p>python agents/preview.py \</p>
            <p className="ml-2">--prospect-id &lt;uuid&gt;</p>
          </div>
          <div className="bg-black/40 rounded-lg p-3">
            <p className="text-purple-400 mb-1"># Run email sequences</p>
            <p>python agents/outreach.py \</p>
            <p className="ml-2">--run-sequences</p>
          </div>
        </div>
      </div>
    </div>
  );
}
