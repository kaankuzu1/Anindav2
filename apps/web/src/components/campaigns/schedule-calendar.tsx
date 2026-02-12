'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  getDay,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns';
import type { DayKey, TimeInterval } from './time-interval-slider';

interface ScheduleCalendarProps {
  schedule: Partial<Record<DayKey, TimeInterval[]>>;
  timezone: string;
}

function formatIntervals(intervals: TimeInterval[]): string {
  return intervals.map((i) => `${i.start}-${i.end}`).join(', ');
}

const DAY_KEY_MAP: Record<number, DayKey> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

export function ScheduleCalendar({ schedule, timezone }: ScheduleCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  return (
    <div className="p-4 border border-border rounded-xl bg-card">
      {/* Header with month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-1.5 hover:bg-accent rounded-lg transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-base font-semibold">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <button
          onClick={handleNextMonth}
          className="p-1.5 hover:bg-accent rounded-lg transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div
            key={day}
            className="text-xs font-medium text-muted-foreground text-center p-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayOfWeek = getDay(day);
          const dayKey = DAY_KEY_MAP[dayOfWeek];
          const intervals = schedule[dayKey];
          const isScheduled = intervals && intervals.length > 0;
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isTodayDate = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={`
                p-1.5 rounded-lg text-center text-sm cursor-default min-h-14
                ${isScheduled ? 'bg-primary/10 dark:bg-primary/20' : ''}
                ${!isCurrentMonth ? 'opacity-30' : ''}
                ${isTodayDate ? 'ring-2 ring-primary ring-inset' : ''}
              `}
            >
              <div
                className={`
                  ${
                    isScheduled
                      ? 'text-primary font-semibold'
                      : 'text-muted-foreground'
                  }
                `}
              >
                {format(day, 'd')}
              </div>
              {isScheduled && intervals && (
                <div className="text-[10px] text-primary/70 mt-0.5 leading-tight">
                  {formatIntervals(intervals)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
