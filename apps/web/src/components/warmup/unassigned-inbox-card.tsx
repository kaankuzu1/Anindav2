'use client';

import { Plus, Mail, CheckCircle, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Inbox {
  id: string;
  email: string;
  provider: string;
  status: string;
  status_reason?: string | null;
  health_score: number;
}

interface UnassignedInboxCardProps {
  inbox: Inbox;
  mode: 'pool' | 'network';
  onAssign: (inboxId: string) => void;
  disabled?: boolean;
}

export function UnassignedInboxCard({
  inbox,
  mode,
  onAssign,
  disabled = false,
}: UnassignedInboxCardProps) {
  const isDisconnected = inbox.status === 'error' && inbox.status_reason?.includes('disconnected');
  const isDisabled = disabled || isDisconnected;

  const modeConfig = {
    pool: {
      buttonClass: 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600',
      borderHoverClass: 'hover:border-blue-500/50',
    },
    network: {
      buttonClass: 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600',
      borderHoverClass: 'hover:border-purple-500/50',
    },
  };

  const config = modeConfig[mode];

  return (
    <div
      className={cn(
        'bg-card rounded-xl border border-border p-4 transition-all',
        !isDisabled && `hover:shadow-lg ${config.borderHoverClass}`,
        isDisabled && 'opacity-60'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            inbox.provider === 'google' ? 'bg-red-100 dark:bg-red-500/20' : 'bg-blue-100 dark:bg-blue-500/20'
          }`}>
            <Mail className={`w-5 h-5 ${
              inbox.provider === 'google' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
            }`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground truncate">{inbox.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{inbox.provider}</p>
          </div>
        </div>
      </div>

      {/* Status Badge */}
      <div className="mb-3">
        {isDisconnected ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-red-100 text-red-800 dark:bg-red-900/80 dark:text-red-200">
            <WifiOff className="w-2.5 h-2.5" />
            Disconnected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300">
            <CheckCircle className="w-2.5 h-2.5" />
            Connected
          </span>
        )}
      </div>

      {/* Health Score */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">Health Score</span>
          <span className="text-xs font-medium text-foreground">{inbox.health_score}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${
              inbox.health_score >= 80
                ? 'bg-green-500'
                : inbox.health_score >= 50
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${inbox.health_score}%` }}
          />
        </div>
      </div>

      {/* Add Button */}
      <button
        onClick={() => onAssign(inbox.id)}
        disabled={isDisabled}
        className={cn(
          'w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed',
          config.buttonClass
        )}
        title={isDisconnected ? 'Reconnect this inbox to add to warmup' : ''}
      >
        <Plus className="w-4 h-4" />
        Add to {mode === 'pool' ? 'Pool' : 'Network'}
      </button>
    </div>
  );
}
