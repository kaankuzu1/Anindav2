'use client';

import * as Slider from '@radix-ui/react-slider';

// Shared types
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface TimeInterval {
  start: number; // 0-24
  end: number;   // 0-24
}

export interface ScheduleData {
  schedule: Partial<Record<DayKey, TimeInterval[]>>;
  timezone: string;
}

// Component props
interface TimeIntervalSliderProps {
  value: TimeInterval;
  onChange: (v: TimeInterval) => void;
  min?: number;
  max?: number;
}

// Helper function to format hour to 12-hour format
export function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return '12:00 AM';
  if (hour === 12) return '12:00 PM';
  if (hour < 12) return `${hour}:00 AM`;
  return `${hour - 12}:00 PM`;
}

export function TimeIntervalSlider({
  value,
  onChange,
  min = 0,
  max = 24,
}: TimeIntervalSliderProps) {
  const handleValueChange = (values: number[]) => {
    onChange({ start: values[0], end: values[1] });
  };

  const tickPositions = [0, 6, 12, 18, 24];
  const tickLabels = ['12AM', '6AM', '12PM', '6PM', '12AM'];

  return (
    <div className="w-full space-y-4">
      {/* Current value display */}
      <div className="text-center text-sm font-medium">
        {formatHour(value.start)} - {formatHour(value.end)}
      </div>

      {/* Slider */}
      <div className="relative px-2">
        <Slider.Root
          className="relative flex items-center select-none touch-none w-full h-5"
          value={[value.start, value.end]}
          onValueChange={handleValueChange}
          min={min}
          max={max}
          step={1}
          minStepsBetweenThumbs={1}
        >
          <Slider.Track className="bg-muted h-2 rounded-full relative grow">
            <Slider.Range className="bg-primary absolute h-full rounded-full" />
          </Slider.Track>
          <Slider.Thumb
            className="block w-5 h-5 bg-white dark:bg-card border-2 border-primary rounded-full shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            aria-label="Start time"
          />
          <Slider.Thumb
            className="block w-5 h-5 bg-white dark:bg-card border-2 border-primary rounded-full shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            aria-label="End time"
          />
        </Slider.Root>

        {/* Hour tick labels */}
        <div className="relative w-full mt-2">
          {tickPositions.map((tick, idx) => (
            <div
              key={tick}
              className="absolute text-xs text-muted-foreground"
              style={{
                left: `${(tick / max) * 100}%`,
                transform: 'translateX(-50%)',
              }}
            >
              {tickLabels[idx]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
