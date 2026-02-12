'use client';

import type { DayKey } from './time-interval-slider';

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

interface WeekdaySelectorProps {
  selectedDays: DayKey[];
  onToggleDay: (day: DayKey) => void;
}

export function WeekdaySelector({ selectedDays, onToggleDay }: WeekdaySelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {DAYS.map((day) => {
        const isSelected = selectedDays.includes(day.key);
        return (
          <button
            key={day.key}
            type="button"
            onClick={() => onToggleDay(day.key)}
            aria-pressed={isSelected}
            className={`
              w-12 h-12 rounded-lg text-sm transition-all duration-150
              ${
                isSelected
                  ? 'border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary'
                  : 'border border-border bg-card text-muted-foreground hover:border-primary/50'
              }
            `}
          >
            {day.label}
          </button>
        );
      })}
    </div>
  );
}
