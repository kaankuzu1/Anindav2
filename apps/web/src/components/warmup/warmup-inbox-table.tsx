'use client';

import { useState } from 'react';
import {
  Mail,
  Play,
  Pause,
  Settings,
  BarChart3,
  RotateCcw,
  RefreshCw,
  X,
  WifiOff,
  Globe,
  Users,
  UserMinus,
  ShieldAlert,
} from 'lucide-react';
import { HistoryChart } from './history-chart';
import { AnimatedWarmupStatus } from './animated-warmup-status';

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

interface WarmupHistoryEntry {
  date: string;
  sent: number;
  received: number;
  replied: number;
}

interface WarmupSettings {
  ramp_speed: 'slow' | 'normal' | 'fast';
  target_daily_volume: number;
  reply_rate_target: number;
}

interface WarmupInboxTableProps {
  inboxes: InboxWithWarmup[];
  mode: 'pool' | 'network';
  onToggleWarmup: (inboxId: string, enable: boolean) => Promise<void>;
  onSaveSettings: (inboxId: string, settings: WarmupSettings) => Promise<void>;
  onResetWarmup: (inboxId: string) => Promise<void>;
  onFetchHistory: (inboxId: string) => Promise<WarmupHistoryEntry[]>;
  onRemoveFromMode?: (inboxId: string) => Promise<void>;
}

export function WarmupInboxTable({
  inboxes,
  mode,
  onToggleWarmup,
  onSaveSettings,
  onResetWarmup,
  onFetchHistory,
  onRemoveFromMode,
}: WarmupInboxTableProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedInbox, setSelectedInbox] = useState<InboxWithWarmup | null>(null);
  const [settingsForm, setSettingsForm] = useState<WarmupSettings>({
    ramp_speed: 'normal',
    target_daily_volume: 40,
    reply_rate_target: 30,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyInbox, setHistoryInbox] = useState<InboxWithWarmup | null>(null);
  const [historyData, setHistoryData] = useState<WarmupHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const handleToggle = async (inboxId: string, enable: boolean) => {
    setActionLoading(inboxId);
    try {
      await onToggleWarmup(inboxId, enable);
    } finally {
      setActionLoading(null);
    }
  };

  const openSettingsModal = (inbox: InboxWithWarmup) => {
    setSelectedInbox(inbox);
    if (inbox.warmup_state) {
      setSettingsForm({
        ramp_speed: inbox.warmup_state.ramp_speed as 'slow' | 'normal' | 'fast',
        target_daily_volume: inbox.warmup_state.target_daily_volume,
        reply_rate_target: inbox.warmup_state.reply_rate_target ?? 30,
      });
    }
    setShowSettingsModal(true);
  };

  const handleSaveSettings = async () => {
    if (!selectedInbox) return;
    setSavingSettings(true);
    try {
      await onSaveSettings(selectedInbox.id, settingsForm);
      setShowSettingsModal(false);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetWarmup = async () => {
    if (!selectedInbox) return;
    if (!confirm(`Are you sure you want to reset warmup progress for ${selectedInbox.email}? This will start the warmup from day 1.`)) return;
    setResetting(true);
    try {
      await onResetWarmup(selectedInbox.id);
      setShowSettingsModal(false);
    } catch (err) {
      console.error('Failed to reset warmup:', err);
    } finally {
      setResetting(false);
    }
  };

  const openHistoryModal = async (inbox: InboxWithWarmup) => {
    setHistoryInbox(inbox);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const data = await onFetchHistory(inbox.id);
      setHistoryData(data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'ramping':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300';
      case 'maintaining':
        return 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300';
      case 'paused':
        return 'bg-muted text-muted-foreground';
      case 'completed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getModeColor = (warmupMode: string) => {
    if (warmupMode === 'network') {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300';
    }
    return 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300';
  };

  if (inboxes.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <Mail className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">No inboxes assigned to {mode} warmup yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Add an inbox from the "Available Inboxes" section below
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase">Inbox</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-muted-foreground uppercase">Day</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-muted-foreground uppercase">Today</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-muted-foreground uppercase">Total</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-muted-foreground uppercase">Spam</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-muted-foreground uppercase">Health</th>
              <th className="px-6 py-4 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {inboxes.map((inbox) => {
              const ws = inbox.warmup_state;
              const replyRate = ws && ws.sent_total > 0
                ? Math.round((ws.replied_total / ws.sent_total) * 100)
                : 0;

              return (
                <tr key={inbox.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        inbox.provider === 'google' ? 'bg-red-100 dark:bg-red-500/20' : 'bg-blue-100 dark:bg-blue-500/20'
                      }`}>
                        <Mail className={`w-5 h-5 ${
                          inbox.provider === 'google' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{inbox.email}</p>
                          {inbox.status === 'error' && inbox.status_reason?.includes('disconnected') && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-900 text-white dark:bg-red-900/80 dark:text-red-200">
                              <WifiOff className="w-2.5 h-2.5" />
                              DISCONNECTED
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground capitalize">{inbox.provider}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-1.5">
                      {ws?.enabled ? (
                        <AnimatedWarmupStatus size="sm" />
                      ) : (
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                          Disabled
                        </span>
                      )}
                      <div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${getModeColor(mode)}`}>
                          {mode === 'network' ? <Globe className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                          {mode === 'network' ? 'Network' : 'Pool'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-5 text-muted-foreground">
                    {ws?.enabled ? `Day ${ws.current_day}` : '-'}
                  </td>
                  <td className="px-4 py-5">
                    <div className="text-sm">
                      <p className="text-foreground">{ws?.sent_today ?? 0} sent</p>
                      <p className="text-muted-foreground">{ws?.replied_today ?? 0} replied</p>
                    </div>
                  </td>
                  <td className="px-4 py-5">
                    <div className="text-sm">
                      <p className="text-foreground">{ws?.sent_total ?? 0} sent</p>
                      <p className="text-muted-foreground">{replyRate}% reply rate</p>
                    </div>
                  </td>
                  <td className="px-4 py-5">
                    <div className="text-sm">
                      <p className={`${(ws?.spam_today ?? 0) > 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-foreground'}`}>
                        {ws?.spam_today ?? 0} today
                      </p>
                      <p className="text-muted-foreground">{ws?.spam_total ?? 0} total</p>
                    </div>
                  </td>
                  <td className="px-4 py-5">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
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
                  <td className="px-6 py-5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      {inbox.status === 'error' && inbox.status_reason?.includes('disconnected') ? (
                        <span className="text-xs text-muted-foreground italic" title="Reconnect this inbox to enable warmup">
                          Reconnect to enable
                        </span>
                      ) : ws?.enabled ? (
                        <button
                          onClick={() => handleToggle(inbox.id, false)}
                          disabled={actionLoading === inbox.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-500/30 disabled:opacity-50"
                        >
                          <Pause className="w-4 h-4" />
                          Pause
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggle(inbox.id, true)}
                          disabled={actionLoading === inbox.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-500/30 disabled:opacity-50"
                        >
                          <Play className="w-4 h-4" />
                          Start
                        </button>
                      )}
                      <button
                        onClick={() => openHistoryModal(inbox)}
                        disabled={!ws || ws.current_day < 1}
                        className="p-1.5 text-muted-foreground hover:text-purple-600 dark:hover:text-purple-400 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="View history"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openSettingsModal(inbox)}
                        className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
                        title="Warmup settings"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      {onRemoveFromMode && (
                        <button
                          onClick={async () => {
                            if (confirm(`Remove ${inbox.email} from ${mode} warmup?`)) {
                              setActionLoading(inbox.id);
                              try {
                                await onRemoveFromMode(inbox.id);
                              } finally {
                                setActionLoading(null);
                              }
                            }
                          }}
                          disabled={actionLoading === inbox.id}
                          className="p-1.5 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50"
                          title={`Remove from ${mode} warmup`}
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && selectedInbox && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl max-w-md w-full border border-border">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Warmup Settings</h2>
                <p className="text-sm text-muted-foreground">{selectedInbox.email}</p>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Ramp Speed */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Ramp Speed
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  How quickly to increase sending volume
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'slow', label: 'Slow', desc: '45+ days' },
                    { value: 'normal', label: 'Normal', desc: '30 days' },
                    { value: 'fast', label: 'Fast', desc: '14 days' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSettingsForm({ ...settingsForm, ramp_speed: option.value as WarmupSettings['ramp_speed'] })}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        settingsForm.ramp_speed === option.value
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:border-muted-foreground/50'
                      }`}
                    >
                      <p className="font-medium text-foreground">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Daily Volume */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Target Daily Volume
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  Maximum emails per day after warmup is complete
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={settingsForm.target_daily_volume}
                    onChange={(e) => setSettingsForm({ ...settingsForm, target_daily_volume: parseInt(e.target.value) })}
                    className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <span className="w-12 text-center font-medium text-foreground">
                    {settingsForm.target_daily_volume}
                  </span>
                </div>
              </div>

              {/* Reply Rate Target */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Reply Rate Target
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  Target reply percentage for healthy warmup
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="10"
                    max="50"
                    step="5"
                    value={settingsForm.reply_rate_target}
                    onChange={(e) => setSettingsForm({ ...settingsForm, reply_rate_target: parseInt(e.target.value) })}
                    className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <span className="w-12 text-center font-medium text-foreground">
                    {settingsForm.reply_rate_target}%
                  </span>
                </div>
              </div>

              {/* Current Status */}
              {selectedInbox.warmup_state && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium text-foreground mb-2">Current Progress</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Day</p>
                      <p className="font-medium text-foreground">{selectedInbox.warmup_state.current_day}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Phase</p>
                      <p className="font-medium text-foreground capitalize">{selectedInbox.warmup_state.phase}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Sent</p>
                      <p className="font-medium text-foreground">{selectedInbox.warmup_state.sent_total}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Replied</p>
                      <p className="font-medium text-foreground">{selectedInbox.warmup_state.replied_total}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Reset Button */}
              <div className="pt-2 border-t border-border">
                <button
                  onClick={handleResetWarmup}
                  disabled={resetting}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                >
                  {resetting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  Reset Warmup Progress
                </button>
                <p className="text-xs text-muted-foreground mt-1">
                  This will reset warmup to day 1 and clear all progress
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-border flex justify-end gap-3">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && historyInbox && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl max-w-2xl w-full border border-border">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Warmup History</h2>
                <p className="text-sm text-muted-foreground">{historyInbox.email} - Last 30 days</p>
              </div>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setHistoryData([]);
                }}
                className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">No history data available yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    History will appear after warmup has been running for a few days
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <HistoryChart data={historyData} />

                  {/* Summary Stats */}
                  <div className="grid grid-cols-4 gap-4 pt-4 border-t border-border">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">
                        {historyData.reduce((sum, d) => sum + d.sent, 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">Total Sent</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">
                        {historyData.reduce((sum, d) => sum + d.received, 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">Total Received</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">
                        {historyData.reduce((sum, d) => sum + d.replied, 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">Total Replied</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">
                        {historyData.reduce((sum, d) => sum + d.sent, 0) > 0
                          ? Math.round((historyData.reduce((sum, d) => sum + d.replied, 0) / historyData.reduce((sum, d) => sum + d.sent, 0)) * 100)
                          : 0}%
                      </p>
                      <p className="text-sm text-muted-foreground">Reply Rate</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
