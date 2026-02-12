'use client';

import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Mail,
  Inbox,
  Users,
  BarChart3,
  Settings,
  Flame,
  LogOut,
} from 'lucide-react';
import { useExampleTheme } from './example-theme-context';

const navigation = [
  { name: 'Dashboard', icon: LayoutDashboard, active: true },
  { name: 'Campaigns', icon: Mail, active: false },
  { name: 'Inboxes', icon: Inbox, active: false },
  { name: 'Warm-up', icon: Flame, active: false },
  { name: 'Leads', icon: Users, active: false },
  { name: 'Unibox', icon: Inbox, active: false },
  { name: 'Analytics', icon: BarChart3, active: false },
  { name: 'Settings', icon: Settings, active: false },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

export default function ExampleSidebar() {
  const { theme } = useExampleTheme();
  const dark = theme === 'dark';

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r ${dark ? 'bg-[#0B0F1A] border-slate-800' : 'bg-white border-gray-200'}`}>
      {/* Logo */}
      <div className={`flex items-center h-16 px-6 border-b ${dark ? 'border-slate-800' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500">
            <span className="text-xs font-bold leading-none text-white">A</span>
          </div>
          <span className={`text-xl font-bold tracking-tight ${dark ? 'text-white' : 'text-gray-900'}`}>
            Aninda
          </span>
        </div>
      </div>

      {/* Navigation */}
      <motion.nav
        variants={container}
        initial="hidden"
        animate="show"
        className="flex-1 px-3 py-4 space-y-1 overflow-y-auto"
      >
        {navigation.map((navItem) => (
          <motion.div key={navItem.name} variants={item}>
            <div
              className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg cursor-default transition-colors ${
                navItem.active
                  ? dark
                    ? 'bg-indigo-500/10 text-white border-l-2 border-indigo-500'
                    : 'bg-indigo-50 text-gray-900 border-l-2 border-indigo-500'
                  : dark
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    : 'text-slate-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <navItem.icon className="w-5 h-5" />
              {navItem.name}
            </div>
          </motion.div>
        ))}
      </motion.nav>

      {/* User section */}
      <div className={`border-t p-4 ${dark ? 'border-slate-800' : 'border-gray-200'}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 p-[2px]">
            <div className={`w-full h-full rounded-full flex items-center justify-center ${dark ? 'bg-[#0B0F1A]' : 'bg-white'}`}>
              <span className="text-sm font-medium text-indigo-400">K</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${dark ? 'text-white' : 'text-gray-900'}`}>
              kaan@aninda.io
            </p>
            <span className={`inline-block mt-0.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${dark ? 'border-slate-700 text-slate-400' : 'border-gray-300 text-slate-600'}`}>
              Free Plan
            </span>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg cursor-default transition-colors ${dark ? 'text-slate-400 hover:bg-slate-800/50 hover:text-white' : 'text-slate-600 hover:bg-gray-100 hover:text-gray-900'}`}>
          <LogOut className="w-4 h-4" />
          Sign out
        </div>
      </div>
    </aside>
  );
}
