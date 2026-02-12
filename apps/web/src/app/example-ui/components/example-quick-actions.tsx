'use client';

import { motion } from 'framer-motion';
import { Mail, Users, Flame, ArrowRight } from 'lucide-react';
import { useExampleTheme } from './example-theme-context';

const actions = [
  {
    icon: Mail,
    gradient: 'from-indigo-500 to-indigo-600',
    title: 'Create Campaign',
    description: 'Launch a new cold email campaign with AI-powered sequences.',
    delay: 0.3,
  },
  {
    icon: Users,
    gradient: 'from-violet-500 to-violet-600',
    title: 'Import Leads',
    description: 'Upload a CSV or connect to your lead source to build lists.',
    delay: 0.45,
  },
  {
    icon: Flame,
    gradient: 'from-emerald-500 to-emerald-600',
    title: 'Start Warm-up',
    description: 'Warm up new inboxes to improve deliverability scores.',
    delay: 0.6,
  },
];

export default function ExampleQuickActions() {
  const { theme } = useExampleTheme();
  const dark = theme === 'dark';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {actions.map((action) => (
        <motion.div
          key={action.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: action.delay }}
          whileHover={{
            y: -4,
            boxShadow: dark ? '0 8px 24px rgba(99,102,241,0.15)' : '0 8px 24px rgba(99,102,241,0.1)',
          }}
          className={`group ${dark ? 'bg-gray-900 border border-dashed border-slate-700' : 'bg-white border border-dashed border-gray-300'} rounded-lg p-6 cursor-pointer transition-all hover:border-solid hover:border-indigo-500/50`}
        >
          <div className="flex items-start justify-between">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${action.gradient}`}
            >
              <action.icon className="h-5 w-5 text-white" />
            </div>
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            >
              <ArrowRight className="h-5 w-5 text-indigo-400" />
            </motion.div>
          </div>
          <h3 className={`${dark ? 'text-white' : 'text-gray-900'} font-medium mt-4`}>{action.title}</h3>
          <p className="text-slate-500 text-sm mt-1">{action.description}</p>
        </motion.div>
      ))}
    </div>
  );
}
