import { Paper } from '@mui/material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateClickArg, EventClickArg } from '@fullcalendar/interaction';
import React from 'react';

export type ScheduleCalendarEvent = {
  id: string;
  start: string;
  allDay: boolean;
  title: string;
};

export interface BusinessRentalsScheduleCalendarProps {
  scheduleEvents: ScheduleCalendarEvent[];
  selectedScheduleDay: string;
  onDateClick: (info: DateClickArg) => void;
  onEventClick: (info: EventClickArg) => void;
}

const BusinessRentalsScheduleCalendar: React.FC<
  BusinessRentalsScheduleCalendarProps
> = ({
  scheduleEvents,
  selectedScheduleDay,
  onDateClick,
  onEventClick,
}) => (
  <Paper
    elevation={0}
    sx={{
      p: 1.5,
      borderRadius: 2,
      border: 1,
      borderColor: 'divider',
      flex: { xs: '1 1 auto', md: '0 0 58%' },
      minWidth: 0,
      '& .fc-daygrid-day.fc-day-selected': {
        backgroundColor: 'action.selected',
      },
      '& .fc-daygrid-day-number': {
        cursor: 'pointer',
      },
      '& .fc-daygrid-event': {
        cursor: 'pointer',
      },
    }}
  >
    <FullCalendar
      plugins={[dayGridPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      height="auto"
      events={scheduleEvents}
      eventDisplay="block"
      dateClick={onDateClick}
      eventClick={onEventClick}
      dayCellClassNames={(arg) =>
        arg.dateStr === selectedScheduleDay ? ['fc-day-selected'] : []
      }
    />
  </Paper>
);

export default BusinessRentalsScheduleCalendar;
