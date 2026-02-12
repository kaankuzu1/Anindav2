'use client';

import { useState, useMemo } from 'react';
import { Calendar, Globe } from 'lucide-react';
import { ScheduleCalendar } from './schedule-calendar';
import { WeekdaySelector } from './weekday-selector';
import { DayScheduleDrawer } from './day-schedule-drawer';
import type { DayKey, TimeInterval, ScheduleData } from './time-interval-slider';

// Re-export types for convenience
export type { DayKey, TimeInterval, ScheduleData };

// Day ordering for display
const DAY_ORDER: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// Common timezones for quick selection
const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Istanbul',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
];

interface CampaignSchedulerProps {
  value: ScheduleData;
  onChange: (v: ScheduleData) => void;
}

export function CampaignScheduler({ value, onChange }: CampaignSchedulerProps) {
  const selectedDays = useMemo(
    () => Object.keys(value.schedule).filter((k): k is DayKey => k in value.schedule && (value.schedule[k as DayKey]?.length ?? 0) > 0) as DayKey[],
    [value.schedule]
  );

  const sortedSelectedDays = useMemo(
    () => DAY_ORDER.filter(d => selectedDays.includes(d)),
    [selectedDays]
  );

  const handleToggleDay = (day: DayKey) => {
    const newSchedule = { ...value.schedule };
    if (newSchedule[day]) {
      delete newSchedule[day];
    } else {
      newSchedule[day] = [{ start: 9, end: 17 }];
    }
    onChange({ ...value, schedule: newSchedule });
  };

  const handleIntervalsChange = (day: DayKey, intervals: TimeInterval[]) => {
    onChange({
      ...value,
      schedule: { ...value.schedule, [day]: intervals },
    });
  };

  const handleTimezoneChange = (tz: string) => {
    onChange({ ...value, timezone: tz });
  };

  // Get day labels
  const dayLabels: Record<DayKey, string> = {
    mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
    fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
  };

  return (
    <div className="bg-card rounded-xl border border-border mb-6">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <Calendar className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Send Schedule</h2>
            <p className="text-sm text-muted-foreground">Choose when your campaign emails are sent</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Calendar Preview */}
          <ScheduleCalendar schedule={value.schedule} timezone={value.timezone} />

          {/* Right: Day Selection + Time Config */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">Send Days</label>
              <WeekdaySelector selectedDays={selectedDays} onToggleDay={handleToggleDay} />
            </div>

            {sortedSelectedDays.length > 0 && (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-foreground mb-2">Time Windows</label>
                {sortedSelectedDays.map(day => (
                  <DayScheduleDrawer
                    key={day}
                    day={day}
                    dayLabel={dayLabels[day]}
                    intervals={value.schedule[day] || [{ start: 9, end: 17 }]}
                    onIntervalsChange={(intervals) => handleIntervalsChange(day, intervals)}
                  />
                ))}
              </div>
            )}

            {/* Timezone Selector */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                <Globe className="w-4 h-4 inline mr-1" />
                Timezone
              </label>
              <select
                value={value.timezone}
                onChange={(e) => handleTimezoneChange(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
              >
                {COMMON_TIMEZONES.map(tz => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
