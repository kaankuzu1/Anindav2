'use client';

import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Play } from 'lucide-react';
import { useEffect } from 'react';
import { useExampleTheme } from './example-theme-context';

function AnimatedCount({ target, color }: { target: number; color: string }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));

  useEffect(() => {
    const controls = animate(count, target, {
      duration: 1.2,
      ease: 'easeOut',
      delay: 0.6,
    });
    return controls.stop;
  }, [count, target]);

  return (
    <motion.span className={`text-4xl font-bold ${color}`}>
      {rounded}
    </motion.span>
  );
}

function ProgressRing({
  percentage,
  color,
  size = 80,
  strokeWidth = 6,
}: {
  percentage: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const { theme } = useExampleTheme();
  const dark = theme === 'dark';
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={dark ? "#1e293b" : "#e2e8f0"}
        strokeWidth={strokeWidth}
      />
      {/* Progress circle */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference - (circumference * percentage) / 100 }}
        transition={{ duration: 1.5, ease: 'easeOut', delay: 0.6 }}
      />
    </svg>
  );
}

function AnimatedBar({ width, color, delay }: { width: string; color: string; delay: number }) {
  const { theme } = useExampleTheme();
  const dark = theme === 'dark';
  return (
    <div className={`${dark ? 'bg-slate-800' : 'bg-gray-200'} rounded-full h-1.5 overflow-hidden`}>
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: '0%' }}
        animate={{ width }}
        transition={{ duration: 1.2, ease: 'easeOut', delay }}
      />
    </div>
  );
}

export default function ExampleInboxHealth() {
  const { theme } = useExampleTheme();
  const dark = theme === 'dark';
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut', delay: 0.6 }}
      className={`${dark ? 'bg-gray-900 border border-slate-800' : 'bg-white border border-gray-200'} rounded-lg p-6`}
    >
      {/* Section label */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex h-5 w-5 items-center justify-center bg-indigo-500">
          <Play className="h-2.5 w-2.5 fill-white text-white" />
        </div>
        <span className={`text-xs font-semibold tracking-widest uppercase ${dark ? 'text-white' : 'text-gray-900'}`}>
          Inbox Health
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Healthy */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3">
            <ProgressRing percentage={75} color="#34d399" />
            <div className="absolute inset-0 flex items-center justify-center">
              <AnimatedCount target={6} color="text-emerald-400" />
            </div>
          </div>
          <span className={`text-sm font-medium ${dark ? 'text-white' : 'text-gray-900'}`}>Healthy</span>
          <span className="text-xs text-slate-500 mt-1">Score 80+, ready for campaigns</span>
          <div className="w-full mt-3">
            <AnimatedBar width="75%" color="bg-emerald-400" delay={0.7} />
          </div>
        </div>

        {/* Warning */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3">
            <ProgressRing percentage={12.5} color="#fbbf24" />
            <div className="absolute inset-0 flex items-center justify-center">
              <AnimatedCount target={1} color="text-amber-400" />
            </div>
          </div>
          <span className={`text-sm font-medium ${dark ? 'text-white' : 'text-gray-900'}`}>Warning</span>
          <span className="text-xs text-slate-500 mt-1">Score 50-79, needs attention</span>
          <div className="w-full mt-3">
            <AnimatedBar width="12.5%" color="bg-amber-400" delay={0.8} />
          </div>
        </div>

        {/* Critical */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3">
            <ProgressRing percentage={12.5} color="#f87171" />
            <div className="absolute inset-0 flex items-center justify-center">
              <AnimatedCount target={1} color="text-red-400" />
            </div>
          </div>
          <span className={`text-sm font-medium ${dark ? 'text-white' : 'text-gray-900'}`}>Critical</span>
          <span className="text-xs text-slate-500 mt-1">Score &lt;50, paused from sending</span>
          <div className="w-full mt-3">
            <AnimatedBar width="12.5%" color="bg-red-400" delay={0.9} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
