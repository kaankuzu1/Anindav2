'use client';

import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Send, Inbox, Users, MessageSquare } from 'lucide-react';
import { useEffect } from 'react';
import { useExampleTheme } from './example-theme-context';

interface StatCardProps {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
  suffix?: string;
  trend: string;
  trendUp: boolean;
  delay: number;
}

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const { theme } = useExampleTheme();
  const dark = theme === 'dark';
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) =>
    v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 1 : 1)}k` : Math.round(v).toLocaleString()
  );

  useEffect(() => {
    const controls = animate(count, value, {
      duration: 1.5,
      ease: 'easeOut',
    });
    return controls.stop;
  }, [count, value]);

  return (
    <motion.span className={`text-3xl font-bold tracking-tight ${dark ? 'text-white' : 'text-gray-900'}`}>
      {value >= 1000 ? (
        <motion.span>{rounded}</motion.span>
      ) : (
        <motion.span>{rounded}</motion.span>
      )}
      {suffix}
    </motion.span>
  );
}

const iconBgLightMap: Record<string, string> = {
  'bg-indigo-500/10': 'bg-indigo-50',
  'bg-violet-500/10': 'bg-violet-50',
  'bg-emerald-500/10': 'bg-emerald-50',
  'bg-amber-500/10': 'bg-amber-50',
};

function StatCard({ icon: Icon, iconBg, iconColor, label, value, suffix, trend, trendUp, delay }: StatCardProps) {
  const { theme } = useExampleTheme();
  const dark = theme === 'dark';
  const resolvedIconBg = dark ? iconBg : (iconBgLightMap[iconBg] || iconBg);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut', delay }}
      whileHover={{ y: -4, boxShadow: dark ? '0 8px 24px rgba(99,102,241,0.15)' : '0 8px 24px rgba(99,102,241,0.1)' }}
      className={`rounded-lg p-6 transition-shadow border ${dark ? 'bg-gray-900 border-slate-800' : 'bg-white border-gray-200'}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${resolvedIconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <span className={`text-xs font-medium ${trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
          {trendUp ? '↑' : '↓'} {trend}
        </span>
      </div>
      <AnimatedNumber value={value} suffix={suffix} />
      <p className={`text-sm mt-1 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>{label}</p>
    </motion.div>
  );
}

const stats = [
  {
    icon: Send,
    iconBg: 'bg-indigo-500/10',
    iconColor: 'text-indigo-400',
    label: 'Emails Sent',
    value: 2847,
    trend: '12%',
    trendUp: true,
  },
  {
    icon: Inbox,
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-400',
    label: 'Active Inboxes',
    value: 8,
    trend: '2',
    trendUp: true,
  },
  {
    icon: Users,
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    label: 'Total Leads',
    value: 12450,
    trend: '5%',
    trendUp: true,
  },
  {
    icon: MessageSquare,
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    label: 'Replies',
    value: 342,
    trend: '18%',
    trendUp: true,
  },
];

export default function ExampleStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <StatCard key={stat.label} {...stat} delay={0.2 + i * 0.1} />
      ))}
    </div>
  );
}
