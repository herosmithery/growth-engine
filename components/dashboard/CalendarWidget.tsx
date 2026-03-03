'use client';

import { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

interface CalendarWidgetProps {
    appointments: Array<any>;
}

export function CalendarWidget({ appointments }: CalendarWidgetProps) {
    const [events, setEvents] = useState<any[]>([]);

    useEffect(() => {
        // Map appointments to fullcalendar event format
        const mapped = appointments.map(appt => {
            // Guessing duration if not set
            const start = new Date(appt.appointment_date);
            const end = new Date(start.getTime() + (appt.duration_minutes || 60) * 60000);

            let color = '#3b82f6'; // default blue
            if (appt.status === 'scheduled') color = '#eab308'; // yellow
            if (appt.status === 'completed') color = '#22c55e'; // green
            if (appt.status === 'no_show') color = '#ef4444'; // red

            return {
                id: appt.id,
                title: `${appt.client_name || 'Client'} - ${appt.treatment_name}`,
                start,
                end,
                backgroundColor: color,
                borderColor: color,
                extendedProps: {
                    ...appt
                }
            };
        });

        setEvents(mapped);
    }, [appointments]);

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm w-full h-[700px] overflow-hidden">
            <style>{`
        .fc {
          --fc-border-color: #e5e7eb;
          --fc-button-text-color: #374151;
          --fc-button-bg-color: #ffffff;
          --fc-button-border-color: #d1d5db;
          --fc-button-hover-bg-color: #f3f4f6;
          --fc-button-hover-border-color: #d1d5db;
          --fc-button-active-bg-color: #e5e7eb;
          --fc-button-active-border-color: #d1d5db;
          --fc-event-text-color: white;
          --fc-event-border-color: transparent;
        }
        .fc-theme-standard .fc-scrollgrid { border-radius: 0.5rem; overflow: hidden; }
        .fc-toolbar-title { font-size: 1.25rem !important; font-weight: 600; color: #111827; }
        .fc-v-event { border-radius: 0.375rem; padding: 2px 4px; border: none !important;}
        .fc-daygrid-event { border-radius: 0.375rem; padding: 2px 4px; border: none !important;}
        .fc-event-title { font-weight: 500; font-size: 0.75rem; }
        .fc-event-time { font-size: 0.7rem; opacity: 0.9; }
      `}</style>
            <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay'
                }}
                events={events}
                height="100%"
                slotMinTime="08:00:00"
                slotMaxTime="20:00:00"
                allDaySlot={false}
                nowIndicator={true}
                eventClick={(info) => {
                    // Could open a modal or do something when clicked
                    console.log('Event clicked:', info.event.extendedProps);
                }}
            />
        </div>
    );
}
