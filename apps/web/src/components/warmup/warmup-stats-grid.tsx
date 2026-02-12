'use client';

import { StatCard } from '@/components/ui/stat-card';
import { Flame, Mail, MessageSquare, TrendingUp, ShieldAlert } from 'lucide-react';

interface InboxWithWarmup {
  id: string;
  email: string;
  provider: string;
  status: string;
  status_reason?: string | null;
  health_score: number;
  warmup_state: {
    id: string;
    enabled: boolean;
    phase: string;
    current_day: number;
    ramp_speed: string;
    target_daily_volume: number;
    reply_rate_target: number;
    sent_today: number;
    received_today: number;
    replied_today: number;
    sent_total: number;
    received_total: number;
    replied_total: number;
    spam_today: number;
    spam_total: number;
    warmup_mode: 'pool' | 'network' | null;
  } | null;
}

interface WarmupStatsGridProps {
  inboxes: InboxWithWarmup[];
  mode?: 'pool' | 'network' | null;
}

export function WarmupStatsGrid({ inboxes, mode }: WarmupStatsGridProps) {
  // Filter by mode if specified
  const filteredInboxes = mode
    ? inboxes.filter(i => i.warmup_state?.warmup_mode === mode)
    : inboxes;

  // Calculate stats
  let activeCount = 0;
  let sentToday = 0;
  let receivedToday = 0;
  let repliedToday = 0;
  let totalSent = 0;
  let totalReplied = 0;
  let spamToday = 0;

  for (const inbox of filteredInboxes) {
    const ws = inbox.warmup_state;
    if (ws?.enabled) activeCount++;
    sentToday += ws?.sent_today ?? 0;
    receivedToday += ws?.received_today ?? 0;
    repliedToday += ws?.replied_today ?? 0;
    totalSent += ws?.sent_total ?? 0;
    totalReplied += ws?.replied_total ?? 0;
    spamToday += ws?.spam_today ?? 0;
  }

  const avgReplyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;

  // Determine color based on mode
  const statColor = mode === 'network' ? 'purple' : mode === 'pool' ? 'blue' : 'blue';

  return (
    <div className={`grid grid-cols-1 gap-4 ${spamToday > 0 ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
      <StatCard
        label="Active Warmups"
        value={activeCount}
        icon={<Flame className="w-6 h-6" />}
        color="orange"
      />
      <StatCard
        label="Sent Today"
        value={sentToday}
        icon={<Mail className="w-6 h-6" />}
        color={statColor}
      />
      <StatCard
        label="Received Today"
        value={receivedToday}
        icon={<MessageSquare className="w-6 h-6" />}
        color="green"
      />
      <StatCard
        label="Avg Reply Rate"
        value={`${avgReplyRate}%`}
        icon={<TrendingUp className="w-6 h-6" />}
        color={statColor}
      />
      {spamToday > 0 && (
        <StatCard
          label="Spam Detected"
          value={spamToday}
          icon={<ShieldAlert className="w-6 h-6" />}
          color="pink"
        />
      )}
    </div>
  );
}
