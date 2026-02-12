'use client';

import { Check, Users, Globe, Bell } from 'lucide-react';
import { IconBackground } from '@/components/ui/icon-background';
import { cn } from '@/lib/utils';

interface WarmupModeCardProps {
  mode: 'pool' | 'network';
  disabled?: boolean;
  onSelect: () => void;
}

const modeConfig = {
  pool: {
    icon: Users,
    title: 'Pool Warmup',
    subtitle: 'Your inboxes warm up together',
    features: [
      'Peer-to-peer email exchange between your inboxes',
      'Natural conversation patterns with full control',
      'Build sender reputation organically',
      'Requires 2+ connected inboxes to start',
    ],
    gradient: 'from-blue-50 via-sky-50 to-cyan-50 dark:from-blue-950/20 dark:via-sky-950/20 dark:to-cyan-950/20',
    border: 'border-blue-200 dark:border-blue-800',
    iconColor: 'blue' as const,
    buttonClass: 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600',
  },
  network: {
    icon: Globe,
    title: 'Network Warmup',
    subtitle: 'Platform-managed warmup partners',
    features: [
      'Works with just 1 inbox - perfect for getting started',
      'Professionally managed warmup inbox network',
      'Optimized send patterns and timing',
      'Zero coordination or setup needed',
    ],
    gradient: 'from-purple-50 via-violet-50 to-indigo-50 dark:from-purple-950/20 dark:via-violet-950/20 dark:to-indigo-950/20',
    border: 'border-purple-200 dark:border-purple-800',
    iconColor: 'purple' as const,
    buttonClass: 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600',
  },
};

export function WarmupModeCard({ mode, disabled = false, onSelect }: WarmupModeCardProps) {
  const config = modeConfig[mode];
  const Icon = config.icon;

  return (
    <div className="relative group animate-fade-in-up">
      <div
        className={cn(
          'bg-gradient-to-br rounded-2xl border-2 p-8 transition-all duration-300',
          config.gradient,
          config.border,
          !disabled && 'hover:-translate-y-2 hover:shadow-2xl cursor-pointer',
          disabled && 'opacity-90'
        )}
        onClick={!disabled ? onSelect : undefined}
      >
        {/* Coming Soon Banner (for disabled Network) */}
        {disabled && mode === 'network' && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <div className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full shadow-lg animate-pulse">
              <Bell className="w-3.5 h-3.5 text-yellow-900" />
              <span className="text-xs font-semibold text-yellow-900">Coming Soon</span>
            </div>
          </div>
        )}

        {/* Icon */}
        <div className="mb-6">
          <IconBackground color={config.iconColor} size="xl">
            <Icon className="w-10 h-10" />
          </IconBackground>
        </div>

        {/* Title & Subtitle */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">{config.title}</h2>
          <p className="text-muted-foreground">{config.subtitle}</p>
        </div>

        {/* Features */}
        <ul className="space-y-3 mb-8">
          {config.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                <div className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center',
                  mode === 'pool' ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-purple-100 dark:bg-purple-500/20'
                )}>
                  <Check className={cn(
                    'w-3 h-3',
                    mode === 'pool' ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'
                  )} />
                </div>
              </div>
              <span className="text-sm text-foreground/90 leading-tight">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA Button */}
        <button
          className={cn(
            'w-full py-3 px-6 rounded-xl text-white font-semibold transition-all shadow-md hover:shadow-xl',
            config.buttonClass,
            disabled && 'opacity-70 cursor-not-allowed'
          )}
          disabled={disabled}
        >
          Choose {config.title}
        </button>
      </div>
    </div>
  );
}
