'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/dashboard/StatCard';
import {
  Clock, CheckCircle, AlertTriangle,
  Phone, Calendar, RefreshCw, User, MessageSquare, Loader2
} from 'lucide-react';

interface Appointment {
  id: string;
  time: string;
  client: string;
  phone: string;
  service: string;
  provider: string;
  status: string;
  noShowRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  notes: string;
  duration: number;
  price: number;
}

const statusStyles: Record<string, string> = {
  confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  no_show: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const TREATMENT_FILTERS = ['All', 'Wellness', 'Vaccination', 'Surgery', 'Dental', 'Botox', 'Filler', 'Laser', 'Follow-up'];

const MOCK_SCHEDULE: Appointment[] = [
  {
    id: '1', time: '09:00', client: 'Sarah M.', phone: '+15551234567',
    service: 'Wellness Exam', provider: 'Dr. Johnson',
    status: 'confirmed', noShowRisk: 'LOW', notes: '', duration: 30, price: 185
  },
  {
    id: '2', time: '09:30', client: 'Tom R.', phone: '+15559876543',
    service: 'Vaccination', provider: 'Dr. Johnson',
    status: 'confirmed', noShowRisk: 'LOW', notes: '', duration: 30, price: 95
  },
  {
    id: '3', time: '10:00', client: 'Lisa K.', phone: '+15554567890',
    service: 'Surgery (Dental)', provider: 'Dr. Patel',
    status: 'scheduled', noShowRisk: 'HIGH', notes: '', duration: 90, price: 420
  },
  {
    id: '4', time: '11:00', client: 'Marcus W.', phone: '+15553210987',
    service: 'Follow-up', provider: 'Dr. Johnson',
    status: 'scheduled', noShowRisk: 'HIGH', notes: '', duration: 20, price: 65
  },
  {
    id: '5', time: '14:00', client: 'Amy C.', phone: '+15556543210',
    service: 'Wellness Exam', provider: 'Dr. Patel',
    status: 'scheduled', noShowRisk: 'LOW', notes: '', duration: 30, price: 185
  },
];

export default function DispatchPage() {
  const [schedule, setSchedule] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [smsSending, setSmsSending] = useState<string | null>(null);
  const [smsSuccess, setSmsSuccess] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [filter, setFilter] = useState('All');
  const [usingMock, setUsingMock] = useState(false);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dispatch/appointments');
      const data = await res.json();
      if (data.appointments && data.appointments.length > 0) {
        setSchedule(data.appointments);
        setUsingMock(false);
      } else {
        setSchedule(MOCK_SCHEDULE);
        setUsingMock(true);
      }
    } catch {
      setSchedule(MOCK_SCHEDULE);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  const handleSendSMS = async (
    appt: Appointment,
    type: 'confirmation' | 'followup' | 'noshow_recovery' = 'confirmation'
  ) => {
    setSmsSending(appt.id);
    try {
      await fetch('/api/dispatch/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: appt.id,
          phone: appt.phone,
          clientName: appt.client,
          service: appt.service,
          time: appt.time,
          type,
        }),
      });
      setSchedule(prev => prev.map(a =>
        a.id === appt.id ? { ...a, status: type === 'confirmation' ? 'confirmed' : a.status } : a
      ));
      setSmsSuccess(appt.id);
      setTimeout(() => setSmsSuccess(null), 2500);
    } finally {
      setSmsSending(null);
    }
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    setTimeout(() => {
      setSchedule(prev => prev.map(a => ({ ...a, status: 'confirmed' })));
      setOptimizing(false);
    }, 1800);
  };

  const filtered = filter === 'All'
    ? schedule
    : schedule.filter(a => a.service.toLowerCase().includes(filter.toLowerCase()));

  const confirmed = schedule.filter(a => a.status === 'confirmed').length;
  const highRisk = schedule.filter(a => a.noShowRisk === 'HIGH').length;
  const pending = schedule.filter(a => ['pending', 'scheduled'].includes(a.status)).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dispatch</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-optimized schedule — SMS confirmations sent automatically
          </p>
          {usingMock && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              ⚡ Demo mode — connect Supabase appointments for live data
            </p>
          )}
        </div>
        <Button onClick={handleOptimize} disabled={optimizing} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${optimizing ? 'animate-spin' : ''}`} />
          {optimizing ? 'Optimizing...' : 'Re-optimize Schedule'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Today" value={schedule.length} icon={Calendar} variant="info" />
        <StatCard title="Confirmed" value={confirmed} icon={CheckCircle} variant="success" />
        <StatCard title="High No-Show Risk" value={highRisk} icon={AlertTriangle} variant="warning" />
        <StatCard title="Pending Confirm" value={pending} icon={Clock} variant="danger" />
      </div>

      {/* Treatment Filter */}
      <div className="flex gap-2 flex-wrap">
        {TREATMENT_FILTERS.map(f => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
            className="h-8 text-xs"
          >
            {f}
          </Button>
        ))}
      </div>

      {/* Schedule */}
      <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl border-white/20 dark:border-gray-700/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Today&apos;s Schedule</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading schedule...
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((appt) => (
                <div
                  key={appt.id}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors"
                >
                  {/* Time */}
                  <div className="w-14 text-center">
                    <p className="text-sm font-semibold">{appt.time}</p>
                    {appt.duration > 0 && (
                      <p className="text-xs text-muted-foreground">{appt.duration}m</p>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{appt.client}</p>
                      {appt.phone && (
                        <>
                          <span className="text-muted-foreground text-xs">·</span>
                          <p className="text-xs text-muted-foreground">{appt.phone}</p>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{appt.service}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">{appt.provider}</p>
                      {appt.price > 0 && (
                        <>
                          <span className="text-muted-foreground mx-1">·</span>
                          <p className="text-xs font-medium text-emerald-600">${appt.price}</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Risk + Status */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {appt.noShowRisk === 'HIGH' && (
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs border-0">
                        ⚠ High Risk
                      </Badge>
                    )}
                    <Badge className={`text-xs border-0 ${statusStyles[appt.status] || statusStyles.pending}`}>
                      {smsSuccess === appt.id ? '✓ SMS Sent' :
                       appt.status === 'confirmed' ? '✓ Confirmed' :
                       appt.status === 'no_show' ? 'No Show' :
                       appt.status === 'completed' ? 'Completed' : 'Pending'}
                    </Badge>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-xs"
                      onClick={() => handleSendSMS(appt)}
                      disabled={smsSending === appt.id || appt.status === 'confirmed'}
                    >
                      {smsSending === appt.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Phone className="h-3 w-3" />
                      }
                      {appt.status === 'confirmed' ? 'Sent' : 'Confirm'}
                    </Button>

                    {appt.noShowRisk === 'HIGH' && appt.status !== 'confirmed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-xs text-amber-600 border-amber-300 hover:bg-amber-50"
                        onClick={() => handleSendSMS(appt, 'noshow_recovery')}
                        disabled={smsSending === appt.id}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Recovery
                      </Button>
                    )}

                    {appt.status === 'completed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-xs text-blue-600 border-blue-300 hover:bg-blue-50"
                        onClick={() => handleSendSMS(appt, 'followup')}
                        disabled={smsSending === appt.id}
                      >
                        <MessageSquare className="h-3 w-3" />
                        Follow-up
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {filtered.length === 0 && (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  No {filter !== 'All' ? filter : ''} appointments scheduled today.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk SMS Panel */}
      <Card className="bg-white/70 dark:bg-gray-800/50 backdrop-blur-xl border-white/20 dark:border-gray-700/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Bulk SMS Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              schedule.filter(a => a.status !== 'confirmed').forEach(a => handleSendSMS(a));
            }}
          >
            <Phone className="h-4 w-4" />
            Confirm All Unconfirmed ({schedule.filter(a => a.status !== 'confirmed').length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-amber-600 border-amber-300 hover:bg-amber-50"
            onClick={() => {
              schedule
                .filter(a => a.noShowRisk === 'HIGH' && a.status !== 'confirmed')
                .forEach(a => handleSendSMS(a, 'noshow_recovery'));
            }}
          >
            <AlertTriangle className="h-4 w-4" />
            Recovery Texts — High Risk ({schedule.filter(a => a.noShowRisk === 'HIGH' && a.status !== 'confirmed').length})
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={fetchAppointments}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
