'use client';

import {
  User,
  Building2,
  Users,
  CreditCard,
  Sparkles,
  Palette,
  Webhook,
  ShieldOff,
  Lock,
  Globe,
} from 'lucide-react';
import { SettingsFlipCard } from '@/components/settings/settings-flip-card';

const SETTINGS_CARDS = [
  {
    title: 'Profile',
    description: 'Your account info',
    icon: User,
    href: '/settings/profile',
    gradient: 'from-blue-500 to-cyan-500',
    bgClass: 'bg-blue-50 dark:bg-blue-950/30',
    iconColorClass: 'text-blue-500',
  },
  {
    title: 'Team',
    description: 'Team & company details',
    icon: Building2,
    href: '/settings/team',
    gradient: 'from-green-500 to-emerald-500',
    bgClass: 'bg-green-50 dark:bg-green-950/30',
    iconColorClass: 'text-green-500',
  },
  {
    title: 'Members',
    description: 'Invite & manage members',
    icon: Users,
    href: '/settings/members',
    gradient: 'from-purple-500 to-violet-500',
    bgClass: 'bg-purple-50 dark:bg-purple-950/30',
    iconColorClass: 'text-purple-500',
  },
  {
    title: 'Billing',
    description: 'Plan & usage limits',
    icon: CreditCard,
    href: '/settings/billing',
    gradient: 'from-amber-500 to-yellow-500',
    bgClass: 'bg-amber-50 dark:bg-amber-950/30',
    iconColorClass: 'text-amber-500',
  },
  {
    title: 'AI Features',
    description: 'AI assistant settings',
    icon: Sparkles,
    href: '/settings/ai',
    gradient: 'from-pink-500 to-rose-500',
    bgClass: 'bg-pink-50 dark:bg-pink-950/30',
    iconColorClass: 'text-pink-500',
  },
  {
    title: 'Appearance',
    description: 'Theme & display',
    icon: Palette,
    href: '/settings/appearance',
    gradient: 'from-teal-500 to-cyan-500',
    bgClass: 'bg-teal-50 dark:bg-teal-950/30',
    iconColorClass: 'text-teal-500',
  },
  {
    title: 'Webhooks',
    description: 'Event notifications',
    icon: Webhook,
    href: '/settings/webhooks',
    gradient: 'from-orange-500 to-amber-500',
    bgClass: 'bg-orange-50 dark:bg-orange-950/30',
    iconColorClass: 'text-orange-500',
  },
  {
    title: 'Suppression',
    description: 'Blocked email list',
    icon: ShieldOff,
    href: '/settings/suppression',
    gradient: 'from-red-500 to-rose-500',
    bgClass: 'bg-red-50 dark:bg-red-950/30',
    iconColorClass: 'text-red-500',
  },
  {
    title: 'Privacy',
    description: 'GDPR & data controls',
    icon: Lock,
    href: '/settings/privacy',
    gradient: 'from-gray-500 to-slate-600',
    bgClass: 'bg-slate-50 dark:bg-slate-800/30',
    iconColorClass: 'text-slate-500',
  },
  {
    title: 'Tracking Domain',
    description: 'Custom tracking setup',
    icon: Globe,
    href: '/settings/tracking-domain',
    gradient: 'from-indigo-500 to-blue-500',
    bgClass: 'bg-indigo-50 dark:bg-indigo-950/30',
    iconColorClass: 'text-indigo-500',
  },
];

export default function SettingsPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 stagger-children">
        {SETTINGS_CARDS.map((card) => (
          <SettingsFlipCard key={card.href} {...card} />
        ))}
      </div>
    </div>
  );
}
