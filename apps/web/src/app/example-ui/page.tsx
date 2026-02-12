'use client';

import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import ExampleSidebar from './components/example-sidebar';
import ExampleAISummary from './components/example-ai-summary';
import ExampleStats from './components/example-stats';
import ExampleQuickActions from './components/example-quick-actions';
import ExampleCampaignsTable from './components/example-campaigns-table';
import ExampleInboxHealth from './components/example-inbox-health';
import { useExampleTheme } from './components/example-theme-context';

const fadeInUp = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: 'easeOut' as const, delay },
});

export default function ExampleUIPage() {
  const { theme, toggleTheme } = useExampleTheme();
  const dark = theme === 'dark';

  return (
    <div className={`flex min-h-screen ${dark ? 'bg-[#0B0F1A] bg-crosshatch' : 'bg-gray-50'}`}>
      {/* Sidebar */}
      <ExampleSidebar />

      {/* Main content */}
      <main className="ml-64 flex-1 min-h-screen">
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          {/* Page header */}
          <motion.div
            {...fadeInUp(0)}
            className="flex items-center justify-between mb-8"
          >
            <div>
              <h1 className={`font-serif text-3xl ${dark ? 'text-white' : 'text-gray-900'}`}>Dashboard</h1>
              <p className={`text-base mt-1 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
                Welcome back. Here&apos;s what&apos;s happening with your outreach.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className={`flex items-center justify-center h-8 w-8 rounded-full border transition-colors ${
                  dark
                    ? 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
                    : 'border-gray-300 text-gray-500 hover:text-gray-900 hover:border-gray-400'
                }`}
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 ${dark ? 'border-slate-700' : 'border-gray-300'}`}>
                <span className="rounded-full bg-indigo-500 px-2.5 py-0.5 text-xs font-semibold text-white">
                  LIVE
                </span>
                <span className={`text-xs font-medium tracking-widest uppercase ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Real-time sync
                </span>
              </div>
            </div>
          </motion.div>

          {/* AI Summary */}
          <div className="mb-6">
            <ExampleAISummary />
          </div>

          {/* Stats */}
          <div className="mb-6">
            <ExampleStats />
          </div>

          {/* Section divider */}
          <div className={`border-t border-dashed my-8 ${dark ? 'border-slate-800' : 'border-gray-300'}`} />

          {/* Quick Actions */}
          <motion.div {...fadeInUp(0.25)} className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className={`font-serif text-xl ${dark ? 'text-white' : 'text-gray-900'}`}>Quick Actions</h2>
            </div>
            <ExampleQuickActions />
          </motion.div>

          {/* Section divider */}
          <div className={`border-t border-dashed my-8 ${dark ? 'border-slate-800' : 'border-gray-300'}`} />

          {/* Campaigns Table + Inbox Health side by side on lg */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ExampleCampaignsTable />
            </div>
            <div className="lg:col-span-1">
              <ExampleInboxHealth />
            </div>
          </div>

          {/* Bottom spacing */}
          <div className="h-12" />
        </div>
      </main>
    </div>
  );
}
