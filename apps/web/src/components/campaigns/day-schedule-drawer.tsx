'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import type { DayKey, TimeInterval } from './time-interval-slider';
import { TimeIntervalSlider, formatHour } from './time-interval-slider';

const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

interface DayScheduleDrawerProps {
  day: DayKey;
  dayLabel: string;
  intervals: TimeInterval[];
  onIntervalsChange: (intervals: TimeInterval[]) => void;
}

export function DayScheduleDrawer({
  day,
  dayLabel,
  intervals,
  onIntervalsChange,
}: DayScheduleDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const fullDayName = DAY_LABELS[day];

  // Generate summary text (e.g., "9:00 AM - 5:00 PM" or "9:00 AM - 12:00 PM, 2:00 PM - 6:00 PM")
  const summary = intervals
    .map((iv) => `${formatHour(iv.start)} - ${formatHour(iv.end)}`)
    .join(', ');

  const handleAddInterval = () => {
    if (intervals.length >= 2) return;
    const firstInterval = intervals[0];
    const newInterval: TimeInterval = {
      start: Math.min(firstInterval.end + 1, 23),
      end: Math.min(firstInterval.end + 4, 24),
    };
    onIntervalsChange([...intervals, newInterval]);
  };

  const handleRemoveInterval = () => {
    if (intervals.length > 1) {
      onIntervalsChange([intervals[0]]);
    }
  };

  const handleIntervalChange = (idx: number, newVal: TimeInterval) => {
    onIntervalsChange(intervals.map((iv, i) => (i === idx ? newVal : iv)));
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{fullDayName}</div>
            <div className="text-muted-foreground text-sm">{summary}</div>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-4">
              {/* First interval */}
              <TimeIntervalSlider
                value={intervals[0]}
                onChange={(val) => handleIntervalChange(0, val)}
              />

              {/* Second interval (if exists) */}
              {intervals.length === 2 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Second window</span>
                    <button
                      type="button"
                      onClick={handleRemoveInterval}
                      className="text-sm text-destructive hover:text-destructive/80 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      Remove
                    </button>
                  </div>
                  <TimeIntervalSlider
                    value={intervals[1]}
                    onChange={(val) => handleIntervalChange(1, val)}
                    min={intervals[0].end}
                  />
                </div>
              )}

              {/* Add interval button (only show if 1 interval and room for more) */}
              {intervals.length === 1 && intervals[0].end < 23 && (
                <button
                  type="button"
                  onClick={handleAddInterval}
                  disabled={intervals[0].end >= 23}
                  className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Add time window
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
