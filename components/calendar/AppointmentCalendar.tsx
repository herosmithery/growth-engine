'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { createBrowserClient } from '@supabase/ssr';
import { useAuth } from '@/lib/auth-context';
import {
  Clock,
  User,
  Phone,
  Sparkles,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import type { EventClickArg, DateSelectArg, EventContentArg } from '@fullcalendar/core';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: {
    clientName: string;
    clientPhone?: string;
    treatmentType: string;
    status: string;
    appointmentId: string;
    source?: string;
  };
}

interface AppointmentCalendarProps {
  onEventClick?: (appointmentId: string) => void;
  onDateSelect?: (start: Date, end: Date) => void;
  selectedDate?: Date;
}

// Modern status colors - soft, professional palette
const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; light: string }> = {
  scheduled: { bg: '#3B82F6', border: '#2563EB', text: '#FFFFFF', light: '#EFF6FF' },
  confirmed: { bg: '#10B981', border: '#059669', text: '#FFFFFF', light: '#ECFDF5' },
  completed: { bg: '#6B7280', border: '#4B5563', text: '#FFFFFF', light: '#F3F4F6' },
  cancelled: { bg: '#EF4444', border: '#DC2626', text: '#FFFFFF', light: '#FEF2F2' },
  no_show: { bg: '#F59E0B', border: '#D97706', text: '#FFFFFF', light: '#FFFBEB' },
  rescheduled: { bg: '#8B5CF6', border: '#7C3AED', text: '#FFFFFF', light: '#F5F3FF' },
  pending: { bg: '#9B7E6B', border: '#8A6E5B', text: '#FFFFFF', light: '#FAF8F6' },
};

export function AppointmentCalendar({ onEventClick, onDateSelect, selectedDate }: AppointmentCalendarProps) {
  const { businessId } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredEvent, setHoveredEvent] = useState<CalendarEvent | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const calendarRef = useRef<FullCalendar>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const loadAppointments = useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          treatment_type,
          start_time,
          end_time,
          status,
          source,
          notes,
          client_id,
          clients (
            first_name,
            last_name,
            phone
          )
        `)
        .eq('business_id', businessId)
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error loading appointments:', error);
        return;
      }

      const calendarEvents: CalendarEvent[] = (data || []).map((apt: any) => {
        // Try client record first, fall back to name/phone stored in notes by AI sync
        let clientName = 'Guest';
        let clientPhone: string | undefined;
        if (apt.clients) {
          clientName = `${apt.clients.first_name || ''} ${apt.clients.last_name || ''}`.trim() || 'Guest';
          clientPhone = apt.clients.phone;
        } else if (apt.notes) {
          const nameMatch = apt.notes.match(/Caller:\s*([^\n|]+)/i);
          const phoneMatch = apt.notes.match(/Phone:\s*([^\n|]+)/i);
          if (nameMatch) clientName = nameMatch[1].trim();
          if (phoneMatch) clientPhone = phoneMatch[1].trim();
        }
        const colors = STATUS_COLORS[apt.status] || STATUS_COLORS.scheduled;
        const startTime = apt.start_time ? new Date(apt.start_time) : new Date();
        const endTime = apt.end_time
          ? new Date(apt.end_time)
          : new Date(startTime.getTime() + 60 * 60 * 1000);

        return {
          id: apt.id,
          title: apt.treatment_type || 'Appointment',
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          backgroundColor: colors.bg,
          borderColor: colors.border,
          textColor: colors.text,
          extendedProps: {
            clientName,
            clientPhone,
            treatmentType: apt.treatment_type || 'Appointment',
            status: apt.status,
            appointmentId: apt.id,
            source: apt.source,
          },
        };
      });

      setEvents(calendarEvents);
    } catch (err) {
      console.error('Error loading appointments:', err);
    } finally {
      setLoading(false);
    }
  }, [businessId, supabase]);

  useEffect(() => {
    loadAppointments();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('appointments-calendar')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          loadAppointments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, loadAppointments, supabase]);

  const handleEventClick = (info: EventClickArg) => {
    const appointmentId = info.event.extendedProps.appointmentId;
    if (onEventClick) {
      onEventClick(appointmentId);
    }
  };

  const handleDateSelect = (info: DateSelectArg) => {
    if (onDateSelect) {
      onDateSelect(info.start, info.end);
    }
  };

  const handleEventMouseEnter = (info: any) => {
    const rect = info.el.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
    setHoveredEvent({
      ...info.event,
      extendedProps: info.event.extendedProps,
    });
  };

  const handleEventMouseLeave = () => {
    setHoveredEvent(null);
  };

  // Custom event content renderer
  const renderEventContent = (eventInfo: EventContentArg) => {
    const { extendedProps } = eventInfo.event;
    const isAiBooked = extendedProps.source === 'ai_phone' || extendedProps.source === 'ai-agent';
    const isTimeGrid = eventInfo.view.type.includes('timeGrid');

    if (isTimeGrid) {
      return (
        <div className="p-1.5 h-full overflow-hidden">
          <div className="flex items-center gap-1 mb-0.5">
            {isAiBooked && <Sparkles className="w-3 h-3 text-white/90 flex-shrink-0" />}
            <span className="font-semibold text-xs truncate">
              {eventInfo.event.title}
            </span>
          </div>
          <div className="text-[10px] text-white/80 truncate">
            {extendedProps.clientName}
          </div>
          <div className="text-[10px] text-white/70">
            {eventInfo.timeText}
          </div>
        </div>
      );
    }

    // Month view - compact
    return (
      <div className="flex items-center gap-1 px-1 truncate">
        {isAiBooked && <Sparkles className="w-2.5 h-2.5 flex-shrink-0" />}
        <span className="truncate text-[11px]">
          {eventInfo.timeText} {extendedProps.clientName}
        </span>
      </div>
    );
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="h-[700px] flex items-center justify-center bg-[var(--background)] rounded-lg border border-[var(--border)] shadow-sm">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--foreground-muted)]">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Main Calendar Container */}
      <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] shadow-sm overflow-hidden">
        {/* Custom Styles for Google Calendar look */}
        <style jsx global>{`
          /* Base calendar styling */
          .fc {
            --fc-border-color: var(--border);
            --fc-button-bg-color: transparent;
            --fc-button-border-color: var(--border);
            --fc-button-text-color: var(--foreground);
            --fc-button-hover-bg-color: var(--background-hover);
            --fc-button-hover-border-color: var(--border);
            --fc-button-active-bg-color: var(--border);
            --fc-button-active-border-color: var(--border);
            --fc-today-bg-color: rgba(155, 126, 107, 0.1);
            --fc-neutral-bg-color: var(--background-hover);
            --fc-page-bg-color: transparent;
            --fc-event-border-color: transparent;
            font-family: inherit;
          }

          .dark .fc {
            --fc-border-color: var(--border);
            --fc-button-border-color: var(--border);
            --fc-button-text-color: var(--foreground);
            --fc-button-hover-bg-color: var(--background-hover);
            --fc-button-hover-border-color: var(--border);
            --fc-button-active-bg-color: var(--border);
            --fc-page-bg-color: transparent;
            --fc-neutral-bg-color: var(--background-hover);
            --fc-today-bg-color: rgba(155, 126, 107, 0.15);
          }

          /* Toolbar styling */
          .fc .fc-toolbar {
            padding: 1rem 1.5rem;
            margin-bottom: 0;
            border-bottom: 1px solid var(--border);
            gap: 1rem;
          }

          .fc .fc-toolbar-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--foreground);
          }

          .dark .fc .fc-toolbar-title {
            color: var(--foreground);
          }

          /* Button group styling */
          .fc .fc-button-group {
            gap: 0;
            border-radius: 0.5rem;
            overflow: hidden;
            border: 1px solid var(--border);
          }

          .fc .fc-button-group .fc-button {
            border-radius: 0;
            border: none;
            margin: 0;
            border-right: 1px solid var(--border);
          }

          .fc .fc-button-group .fc-button:last-child {
            border-right: none;
          }

          .fc .fc-button {
            font-weight: 500;
            font-size: 0.875rem;
            padding: 0.5rem 1rem;
            text-transform: capitalize;
            box-shadow: none !important;
            transition: all 0.15s ease;
          }

          .fc .fc-button-primary:not(:disabled).fc-button-active,
          .fc .fc-button-primary:not(:disabled):active {
            background-color: var(--primary) !important;
            border-color: var(--primary) !important;
            color: white !important;
          }

          /* Today button special styling */
          .fc .fc-today-button {
            background-color: var(--primary) !important;
            border-color: var(--primary) !important;
            color: white !important;
            border-radius: 0.5rem !important;
          }

          .fc .fc-today-button:hover {
            background-color: var(--primary-dark) !important;
            border-color: var(--primary-dark) !important;
          }

          .fc .fc-today-button:disabled {
            opacity: 0.5;
          }

          /* Navigation buttons */
          .fc .fc-prev-button,
          .fc .fc-next-button {
            background: transparent;
            border: 1px solid var(--border);
            border-radius: 0.5rem;
            padding: 0.5rem;
          }

          .fc .fc-prev-button:hover,
          .fc .fc-next-button:hover {
            background: var(--background-hover);
          }

          .dark .fc .fc-prev-button:hover,
          .dark .fc .fc-next-button:hover {
            background: var(--background-hover);
          }

          /* Header cells */
          .fc .fc-col-header-cell {
            padding: 0.75rem 0;
            font-weight: 600;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--foreground-muted);
            background: var(--background);
            border-bottom: 1px solid var(--border);
          }

          .dark .fc .fc-col-header-cell {
            background: var(--background);
            color: var(--foreground-muted);
          }

          .fc .fc-col-header-cell-cushion {
            padding: 0.5rem;
          }

          /* Day cells */
          .fc .fc-daygrid-day {
            transition: background 0.15s ease;
          }

          .fc .fc-daygrid-day:hover {
            background: var(--background-hover);
          }

          .dark .fc .fc-daygrid-day:hover {
            background: var(--background-hover);
          }

          .fc .fc-daygrid-day-number {
            font-size: 0.875rem;
            font-weight: 500;
            padding: 0.5rem;
            color: var(--foreground-muted);
          }

          .dark .fc .fc-daygrid-day-number {
            color: var(--foreground-muted);
          }

          .fc .fc-day-today .fc-daygrid-day-number {
            background: var(--primary);
            color: white;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0.25rem;
          }

          /* Time grid styling */
          .fc .fc-timegrid-slot {
            height: 3.5rem;
            border-bottom: 1px solid var(--border);
          }

          .dark .fc .fc-timegrid-slot {
            border-bottom-color: var(--border);
          }

          .fc .fc-timegrid-slot-minor {
            border-bottom-style: dotted;
            border-bottom-color: var(--border);
          }

          .dark .fc .fc-timegrid-slot-minor {
            border-bottom-color: var(--border);
          }

          .fc .fc-timegrid-slot-label {
            font-size: 0.75rem;
            color: var(--foreground-muted);
            font-weight: 500;
          }

          .dark .fc .fc-timegrid-slot-label {
            color: var(--foreground-muted);
          }

          /* Events styling */
          .fc .fc-event {
            border-radius: 0.375rem;
            border-left-width: 3px;
            border-left-style: solid;
            cursor: pointer;
            transition: transform 0.1s ease, box-shadow 0.1s ease;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          }

          .fc .fc-event:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            z-index: 10 !important;
          }

          .fc .fc-timegrid-event {
            border-radius: 0.5rem;
          }

          .fc .fc-daygrid-event {
            margin: 1px 2px;
            padding: 2px 4px;
          }

          .fc .fc-event-main {
            padding: 0;
          }

          /* Now indicator */
          .fc .fc-timegrid-now-indicator-line {
            border-color: var(--destructive);
            border-width: 2px;
          }

          .fc .fc-timegrid-now-indicator-arrow {
            border-color: var(--destructive);
            border-top-color: transparent;
            border-bottom-color: transparent;
          }

          /* Scrollbar styling */
          .fc .fc-scroller::-webkit-scrollbar {
            width: 8px;
          }

          .fc .fc-scroller::-webkit-scrollbar-track {
            background: var(--background);
          }

          .fc .fc-scroller::-webkit-scrollbar-thumb {
            background: var(--border);
            border-radius: 4px;
          }

          .fc .fc-scroller::-webkit-scrollbar-thumb:hover {
            background: var(--foreground-muted);
          }

          /* List view styling */
          .fc .fc-list {
            border: none;
          }

          .fc .fc-list-day-cushion {
            background: var(--background);
            padding: 0.75rem 1rem;
          }

          .dark .fc .fc-list-day-cushion {
            background: var(--background);
          }

          .fc .fc-list-event:hover td {
            background: var(--background-hover);
          }

          .dark .fc .fc-list-event:hover td {
            background: var(--background-hover);
          }

          /* Selection styling */
          .fc .fc-highlight {
            background: rgba(155, 126, 107, 0.15);
          }

          /* More link */
          .fc .fc-daygrid-more-link {
            font-size: 0.75rem;
            font-weight: 600;
            color: #9B7E6B;
            padding: 2px 4px;
          }

          .fc .fc-daygrid-more-link:hover {
            background: rgba(155, 126, 107, 0.1);
            border-radius: 4px;
          }
        `}</style>

        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="dayGridMonth"
          initialDate={selectedDate}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
          }}
          buttonText={{
            today: 'Today',
            month: 'Month',
            week: 'Week',
            day: 'Day',
            list: 'List',
          }}
          events={events}
          eventContent={renderEventContent}
          eventClick={handleEventClick}
          eventMouseEnter={handleEventMouseEnter}
          eventMouseLeave={handleEventMouseLeave}
          select={handleDateSelect}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={3}
          moreLinkContent={(args) => `+${args.num} more`}
          weekends={true}
          nowIndicator={true}
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          allDaySlot={false}
          height={700}
          stickyHeaderDates={true}
          eventTimeFormat={{
            hour: 'numeric',
            minute: '2-digit',
            meridiem: 'short',
          }}
          slotLabelFormat={{
            hour: 'numeric',
            minute: '2-digit',
            meridiem: 'short',
          }}
          dayHeaderFormat={{
            weekday: 'short',
            day: 'numeric',
          }}
          views={{
            timeGridWeek: {
              titleFormat: { year: 'numeric', month: 'long' },
            },
            dayGridMonth: {
              titleFormat: { year: 'numeric', month: 'long' },
            },
          }}
        />

        {/* Legend */}
        <div className="px-6 py-4 border-t border-[var(--border)] bg-[#f6f8fa] dark:bg-[#161b22]">
          <div className="flex flex-wrap items-center gap-6">
            <span className="text-[11px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
              Status:
            </span>
            {Object.entries(STATUS_COLORS).slice(0, 5).map(([status, colors]) => (
              <div key={status} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm shadow-sm"
                  style={{ backgroundColor: colors.bg }}
                />
                <span className="text-xs text-[var(--foreground-muted)] capitalize font-medium">
                  {status.replace('_', ' ')}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2 ml-auto">
              <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span className="text-xs text-[var(--foreground-muted)] font-medium">
                AI Booked
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Event Tooltip */}
      {hoveredEvent && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-[var(--background)] rounded-md shadow-xl border border-[var(--border)] p-4 min-w-[250px] max-w-[300px]">
            {/* Arrow */}
            <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-full">
              <div className="w-3 h-3 bg-[var(--background)] border-r border-b border-[var(--border)] transform rotate-45 -translate-y-1.5" />
            </div>

            {/* Content */}
            <div className="space-y-3">
              {/* Status badge */}
              <div className="flex items-center justify-between">
                <span
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-transparent capitalize tracking-wide"
                  style={{
                    backgroundColor: STATUS_COLORS[hoveredEvent.extendedProps?.status]?.light || '#F3F4F6',
                    color: STATUS_COLORS[hoveredEvent.extendedProps?.status]?.bg || '#6B7280',
                  }}
                >
                  {hoveredEvent.extendedProps?.status?.replace('_', ' ')}
                </span>
                {(hoveredEvent.extendedProps?.source === 'ai_phone' || hoveredEvent.extendedProps?.source === 'ai-agent') && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-md text-[11px] font-semibold tracking-wide">
                    <Sparkles className="w-3 h-3" />
                    AI Booked
                  </span>
                )}
              </div>

              {/* Treatment */}
              <div>
                <h4 className="font-semibold text-[var(--foreground)]">
                  {hoveredEvent.extendedProps?.treatmentType}
                </h4>
              </div>

              {/* Client info */}
              <div className="flex items-center gap-2 text-[var(--foreground-muted)]">
                <User className="w-4 h-4" />
                <span className="text-sm">{hoveredEvent.extendedProps?.clientName}</span>
              </div>

              {/* Phone */}
              {hoveredEvent.extendedProps?.clientPhone && (
                <div className="flex items-center gap-2 text-[var(--foreground-muted)]">
                  <Phone className="w-4 h-4" />
                  <span className="text-sm">{hoveredEvent.extendedProps.clientPhone}</span>
                </div>
              )}

              {/* Time */}
              <div className="flex items-center gap-2 text-[var(--foreground-muted)]">
                <Clock className="w-4 h-4" />
                <span className="text-sm">
                  {hoveredEvent.start && formatTime(new Date(hoveredEvent.start as string))} -
                  {hoveredEvent.end && formatTime(new Date(hoveredEvent.end as string))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
