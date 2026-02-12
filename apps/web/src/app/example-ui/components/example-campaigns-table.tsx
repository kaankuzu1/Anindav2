'use client';

import { motion } from 'framer-motion';
import { Play, ArrowRight } from 'lucide-react';
import { useExampleTheme } from './example-theme-context';

interface Campaign {
  name: string;
  status: 'Active' | 'Paused' | 'Draft';
  sent: number;
  opened: number;
  replied: number;
  replyRate: number;
}

const campaigns: Campaign[] = [
  { name: 'Q1 Product Launch', status: 'Active', sent: 1245, opened: 847, replied: 156, replyRate: 12.5 },
  { name: 'Enterprise Decision Makers', status: 'Active', sent: 890, opened: 612, replied: 89, replyRate: 10.0 },
  { name: 'Follow-up Sequence B', status: 'Paused', sent: 432, opened: 298, replied: 52, replyRate: 12.0 },
  { name: 'SaaS Founders Outreach', status: 'Active', sent: 280, opened: 196, replied: 45, replyRate: 16.1 },
  { name: 'New Market Test', status: 'Draft', sent: 0, opened: 0, replied: 0, replyRate: 0 },
];

function StatusBadge({ status }: { status: Campaign['status'] }) {
  const { theme } = useExampleTheme();
  const dark = theme === 'dark';
  const styles = {
    Active: 'bg-indigo-500 text-white',
    Paused: dark ? 'border border-slate-600 text-slate-400 bg-transparent' : 'border border-gray-400 text-gray-600 bg-transparent',
    Draft: dark ? 'bg-slate-800 text-slate-400' : 'bg-gray-200 text-gray-600',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.4 },
  },
};

const row = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

export default function ExampleCampaignsTable() {
  const { theme } = useExampleTheme();
  const dark = theme === 'dark';
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut', delay: 0.5 }}
      className={`${dark ? 'bg-gray-900 border border-slate-800' : 'bg-white border border-gray-200'} rounded-lg overflow-hidden`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center bg-indigo-500">
            <Play className="h-2.5 w-2.5 fill-white text-white" />
          </div>
          <span className={`text-xs font-semibold tracking-widest uppercase ${dark ? 'text-white' : 'text-gray-900'}`}>
            Recent Campaigns
          </span>
        </div>
        <button className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={dark ? 'bg-slate-800/50' : 'bg-gray-100'}>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Campaign
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Sent
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Opened
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Replied
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Reply Rate
              </th>
            </tr>
          </thead>
          <motion.tbody variants={container} initial="hidden" animate="show">
            {campaigns.map((campaign) => (
              <motion.tr
                key={campaign.name}
                variants={row}
                className={`${dark ? 'border-b border-slate-800/50 hover:bg-slate-800/30' : 'border-b border-gray-100 hover:bg-gray-50'} transition-colors`}
              >
                <td className={`px-6 py-4 text-sm ${dark ? 'text-white' : 'text-gray-900'} font-medium`}>
                  {campaign.name}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={campaign.status} />
                </td>
                <td className={`px-6 py-4 text-sm ${dark ? 'text-slate-300' : 'text-slate-700'} text-right`}>
                  {campaign.sent.toLocaleString()}
                </td>
                <td className={`px-6 py-4 text-sm ${dark ? 'text-slate-300' : 'text-slate-700'} text-right`}>
                  {campaign.opened.toLocaleString()}
                </td>
                <td className={`px-6 py-4 text-sm ${dark ? 'text-slate-300' : 'text-slate-700'} text-right`}>
                  {campaign.replied.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-right">
                  <span className={campaign.replyRate > 5 ? 'gradient-text font-semibold' : (dark ? 'text-slate-300' : 'text-slate-700')}>
                    {campaign.replyRate > 0 ? `${campaign.replyRate}%` : '—'}
                  </span>
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>
    </motion.div>
  );
}
