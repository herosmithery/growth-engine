'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { PageLoading } from '@/components/ui/page-loading';
import { AppointmentCalendar } from '@/components/calendar/AppointmentCalendar';
import {
  CalendarDays,
  Plus,
  X,
  Clock,
  User,
  Phone,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Mail,
  Sparkles,
} from 'lucide-react';

interface Appointment {
  id: string;
  treatment_type: string;
  start_time: string;
  status: string;
  notes?: string;
  client_id?: string;
  source?: string;
  clients?: {
    first_name: string;
    last_name?: string;
    phone?: string;
    email?: string;
  };
}

export default function CalendarPage() {
  const { businessId, loading: authLoading } = useAuth();
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState<{ start: Date; end: Date } | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Load appointment details when clicked
  const handleEventClick = async (appointmentId: string) => {
    const { data } = await supabase
      .from('appointments')
      .select(`
        *,
        clients (
          first_name,
          last_name,
          phone,
          email
        )
      `)
      .eq('id', appointmentId)
      .single();

    if (data) {
      setSelectedAppointment(data);
    }
  };

  // Handle date selection for new appointment
  const handleDateSelect = (start: Date, end: Date) => {
    setSelectedDateRange({ start, end });
    setShowNewModal(true);
  };

  // Update appointment status
  const updateStatus = async (status: string) => {
    if (!selectedAppointment) return;

    await supabase
      .from('appointments')
      .update({ status })
      .eq('id', selectedAppointment.id);

    setSelectedAppointment({ ...selectedAppointment, status });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const isAIBooked = selectedAppointment?.source === 'ai_phone' || selectedAppointment?.source === 'ai-agent';

  if (authLoading) {
    return <PageLoading message="Loading calendar..." />;
  }

  if (!businessId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-20 h-20 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-amber-500" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Welcome to Calendar</h2>
          <p className="text-gray-500 dark:text-gray-400">Please sign in to view your appointments.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Calendar"
        description="Manage your appointments and schedule"
        icon={CalendarDays}
        action={
          <button
            onClick={() => {
              setSelectedDateRange({ start: new Date(), end: new Date() });
              setShowNewModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--primary)] hover:opacity-90 text-white rounded-md font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Appointment
          </button>
        }
      />

      {/* Calendar */}
      <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] overflow-hidden">
        <AppointmentCalendar
          onEventClick={handleEventClick}
          onDateSelect={handleDateSelect}
        />
      </div>

      {/* Appointment Detail Sidebar */}
      {selectedAppointment && (
        <div className="fixed inset-y-0 right-0 w-[420px] bg-[var(--background)] shadow-2xl border-l border-[var(--border)] z-50 overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Appointment Details
              </h2>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="p-2 hover:bg-[var(--background-hover)] rounded-md transition-colors"
              >
                <X className="w-5 h-5 text-[var(--foreground-muted)]" />
              </button>
            </div>

            {/* Status & Source Badges */}
            <div className="flex items-center gap-2 mb-6">
              <span className={`
                inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium
                ${selectedAppointment.status === 'confirmed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  selectedAppointment.status === 'completed' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
                    selectedAppointment.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      selectedAppointment.status === 'no_show' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}
              `}>
                {selectedAppointment.status === 'no_show' ? 'No Show' :
                  selectedAppointment.status.charAt(0).toUpperCase() + selectedAppointment.status.slice(1)}
              </span>
              {isAIBooked && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Booked
                </span>
              )}
            </div>

            {/* Treatment */}
            <div className="mb-6 p-4 bg-[#f6f8fa] dark:bg-[#161b22] rounded-md border border-[var(--border)]">
              <h3 className="text-xl font-semibold text-[var(--foreground)] mb-3">
                {selectedAppointment.treatment_type || 'Appointment'}
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-[var(--foreground-muted)]">
                  <div className="w-8 h-8 rounded-md bg-[var(--background)] flex items-center justify-center border border-[var(--border)]">
                    <CalendarDays className="w-4 h-4 text-[var(--foreground-muted)]" />
                  </div>
                  <span className="text-sm font-medium">{formatDate(selectedAppointment.start_time)}</span>
                </div>
                <div className="flex items-center gap-3 text-[var(--foreground-muted)]">
                  <div className="w-8 h-8 rounded-md bg-[var(--background)] flex items-center justify-center border border-[var(--border)]">
                    <Clock className="w-4 h-4 text-[var(--foreground-muted)]" />
                  </div>
                  <span className="text-sm font-medium">{formatTime(selectedAppointment.start_time)}</span>
                </div>
              </div>
            </div>

            {/* Client Info */}
            {selectedAppointment.clients && (
              <div className="mb-6 p-4 bg-[var(--background)] rounded-md border border-[var(--border)]">
                <h4 className="text-sm font-medium text-[var(--foreground-muted)] mb-4 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Client Information
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#f6f8fa] dark:bg-[#161b22] border border-[var(--border)] flex items-center justify-center">
                      <span className="text-[var(--foreground)] font-semibold">
                        {selectedAppointment.clients.first_name?.charAt(0) || '?'}
                      </span>
                    </div>
                    <span className="text-[var(--foreground)] font-medium">
                      {selectedAppointment.clients.first_name} {selectedAppointment.clients.last_name}
                    </span>
                  </div>
                  {selectedAppointment.clients.phone && (
                    <div className="flex items-center gap-3 pl-1">
                      <Phone className="w-4 h-4 text-[var(--foreground-muted)]" />
                      <a
                        href={`tel:${selectedAppointment.clients.phone}`}
                        className="text-[var(--primary)] hover:underline"
                      >
                        {selectedAppointment.clients.phone}
                      </a>
                    </div>
                  )}
                  {selectedAppointment.clients.email && (
                    <div className="flex items-center gap-3 pl-1">
                      <Mail className="w-4 h-4 text-[var(--foreground-muted)]" />
                      <a
                        href={`mailto:${selectedAppointment.clients.email}`}
                        className="text-[var(--primary)] hover:underline text-sm"
                      >
                        {selectedAppointment.clients.email}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {selectedAppointment.notes && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-[var(--foreground-muted)] mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Notes
                </h4>
                <p className="text-[var(--foreground)] text-sm bg-[var(--background-hover)] p-3 rounded-md border border-[var(--border)]">
                  {selectedAppointment.notes}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-[var(--foreground-muted)]">
                Quick Actions
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => updateStatus('confirmed')}
                  disabled={selectedAppointment.status === 'confirmed'}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#f6f8fa] dark:bg-[#161b22] hover:bg-[var(--background-hover)] border border-[var(--border)] text-[var(--foreground)] rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4 text-blue-500" />
                  Confirm
                </button>
                <button
                  onClick={() => updateStatus('completed')}
                  disabled={selectedAppointment.status === 'completed'}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#f6f8fa] dark:bg-[#161b22] hover:bg-[var(--background-hover)] border border-[var(--border)] text-[var(--foreground)] rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4 text-[var(--success)]" />
                  Complete
                </button>
                <button
                  onClick={() => updateStatus('no_show')}
                  disabled={selectedAppointment.status === 'no_show'}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#f6f8fa] dark:bg-[#161b22] hover:bg-[var(--background-hover)] border border-[var(--border)] text-[var(--foreground)] rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <AlertCircle className="w-4 h-4 text-[var(--destructive)]" />
                  No Show
                </button>
                <button
                  onClick={() => updateStatus('cancelled')}
                  disabled={selectedAppointment.status === 'cancelled'}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#f6f8fa] dark:bg-[#161b22] hover:bg-[var(--background-hover)] border border-[var(--border)] text-[var(--foreground)] rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle className="w-4 h-4 text-[var(--destructive)]" />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overlay when sidebar is open */}
      {selectedAppointment && (
        <div
          className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setSelectedAppointment(null)}
        />
      )}
    </div>
  );
}
