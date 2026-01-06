import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Plus, Mail, Settings, Flame, AlertCircle, CheckCircle } from 'lucide-react';

export default async function InboxesPage({
  searchParams,
}: {
  searchParams: { success?: string; error?: string };
}) {
  const supabase = createClient();
  const success = searchParams.success;
  const error = searchParams.error;

  // Get user and team
  const { data: { user } } = await supabase.auth.getUser();
  let teamId: string | null = null;

  if (user) {
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .limit(1) as { data: { team_id: string }[] | null };

    if (teamMembers && teamMembers.length > 0) {
      teamId = teamMembers[0].team_id;
    }
  }

  // Fetch inboxes from database
  const { data: inboxes } = await supabase
    .from('inboxes')
    .select('*, inbox_settings(*), warmup_state(*)')
    .eq('team_id', teamId ?? '')
    .order('created_at', { ascending: false });

  // Use real data
  const displayInboxes = inboxes ?? [];

  return (
    <div className="space-y-6">
      {/* Success/Error messages */}
      {success && (
        <div className="p-4 bg-green-500/10 dark:bg-green-500/20 border border-green-500/30 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-green-800 dark:text-green-300">
            {success === 'connected' && 'Email account connected successfully!'}
            {success === 'reconnected' && 'Email account reconnected successfully!'}
          </p>
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-500/10 dark:bg-red-500/20 border border-red-500/30 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-red-800 dark:text-red-300">Failed to connect: {error}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inboxes</h1>
          <p className="text-muted-foreground">Manage your connected email accounts</p>
        </div>
        <Link
          href="/inboxes/connect"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Connect Inbox
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/10 dark:bg-green-500/20 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {displayInboxes.filter((i: any) => i.status === 'active').length}
              </p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/10 dark:bg-orange-500/20 rounded-lg flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {displayInboxes.filter((i: any) => i.warmup_state?.enabled).length}
              </p>
              <p className="text-sm text-muted-foreground">Warming Up</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {displayInboxes.reduce((acc: number, i: any) => acc + (i.sent_today || 0), 0)}
              </p>
              <p className="text-sm text-muted-foreground">Sent Today</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/10 dark:bg-purple-500/20 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {displayInboxes.length > 0 ? Math.round(displayInboxes.reduce((acc: number, i: any) => acc + (i.health_score || 0), 0) / displayInboxes.length) : 0}
              </p>
              <p className="text-sm text-muted-foreground">Avg Health</p>
            </div>
          </div>
        </div>
      </div>

      {/* Inboxes List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Inbox
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Health
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Warm-up
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Sent Today
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayInboxes.map((inbox: any) => (
              <tr key={inbox.id} className="hover:bg-muted/30">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      inbox.provider === 'google' ? 'bg-red-500/10 dark:bg-red-500/20' : 'bg-blue-500/10 dark:bg-blue-500/20'
                    }`}>
                      <Mail className={`w-5 h-5 ${
                        inbox.provider === 'google' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{inbox.email}</p>
                      <p className="text-sm text-muted-foreground capitalize">{inbox.provider}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    inbox.status === 'active'
                      ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300'
                      : inbox.status === 'warming_up'
                      ? 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300'
                      : inbox.status === 'paused'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300'
                  }`}>
                    {inbox.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          inbox.health_score >= 80
                            ? 'bg-green-500'
                            : inbox.health_score >= 50
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${inbox.health_score}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">{inbox.health_score}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {inbox.warmup_state?.enabled ? (
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                      <span className="text-sm text-muted-foreground">
                        Day {inbox.warmup_state.current_day}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground/60">Disabled</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className="text-muted-foreground">
                    {inbox.sent_today} / {inbox.inbox_settings?.daily_send_limit ?? 50}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/inboxes/${inbox.id}`}
                    className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent inline-block"
                  >
                    <Settings className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {displayInboxes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No inboxes connected yet</p>
            <Link
              href="/inboxes/connect"
              className="inline-flex items-center gap-2 mt-4 text-primary hover:text-primary/80"
            >
              <Plus className="w-5 h-5" />
              Connect your first inbox
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
