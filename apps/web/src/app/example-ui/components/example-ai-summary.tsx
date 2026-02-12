'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useExampleTheme } from './example-theme-context';

const fadeInUp = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: 'easeOut' as const, delay },
});

const metrics = [
  { label: 'Open Rate', value: '68%' },
  { label: 'Reply Rate', value: '12%' },
  { label: 'Meetings', value: '3' },
  { label: 'Bounced', value: '0.4%' },
];

const highlights = [
  'Campaign "Q1 Product Launch" is performing 23% above average — consider scaling send volume.',
  '2 inboxes are warming up ahead of schedule and will be ready for campaigns in 3 days.',
  'Reply sentiment is trending positive this week — 78% interested or question intents.',
  'Lead list "Enterprise CTOs" has the highest engagement. Consider importing similar profiles.',
];

export default function ExampleAISummary() {
  const { theme } = useExampleTheme();
  const dark = theme === 'dark';

  return (
    <motion.div
      {...fadeInUp(0.1)}
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(99,102,241,0.1)' }}
      className={`${dark ? 'bg-gray-900 border border-slate-800' : 'bg-white border border-gray-200'} rounded-lg overflow-hidden transition-shadow`}
    >
      {/* Gradient top bar */}
      <div className="h-[2px] bg-gradient-to-r from-indigo-500 to-violet-500" />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${dark ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
            <Sparkles className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h3 className={`text-base font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>Today&apos;s Summary</h3>
            <p className="text-xs text-slate-500">AI-generated daily overview</p>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {metrics.map((metric) => (
            <div key={metric.label} className="text-center">
              <div className="text-2xl font-bold gradient-text">{metric.value}</div>
              <div className="text-xs text-slate-500 mt-1">{metric.label}</div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className={`border-t border-dashed ${dark ? 'border-slate-800' : 'border-gray-300'} mb-4`} />

        {/* Highlights */}
        <ul className="space-y-2.5">
          {highlights.map((highlight, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
              <span className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>{highlight}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
