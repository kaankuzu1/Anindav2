'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  fetchDashboardStatsExtended,
  fetchAdminInboxes,
  type DashboardStatsExtended,
  type AdminInbox,
} from '@/lib/admin-api';
import {
  Inbox,
  CheckCircle,
  AlertCircle,
  Users,
  Server,
  Activity,
  RotateCw,
  WifiOff,
  TrendingUp,
  Send,
  Mail,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Pause,
  Play,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStatsExtended | null>(null);
  const [inboxes, setInboxes] = useState<AdminInbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = useCallback(async (showRefreshState = false) => {
    try {
      if (showRefreshState) setRefreshing(true);
      const [statsData, inboxesData] = await Promise.all([
        fetchDashboardStatsExtended(),
        fetchAdminInboxes(),
      ]);
      setStats(statsData);
      setInboxes(inboxesData);
      setLastUpdated(new Date());
      setError('');
    } catch (err: any) {
      // Redirect to login on auth errors
      if (err.message?.toLowerCase().includes('token') ||
          err.message?.toLowerCase().includes('authenticated') ||
          err.message?.toLowerCase().includes('unauthorized')) {
        localStorage.removeItem('admin_token');
        router.push('/admin/login');
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh every 30 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => loadData(), 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  // Get inboxes needing attention
  const inboxesNeedingAttention = inboxes.filter(inbox =>
    inbox.status === 'error' || inbox.health_score < 50
  );

  // Get inboxes with low capacity (>80% utilized)
  const highUtilizationInboxes = inboxes.filter(inbox => {
    const utilization = inbox.max_capacity > 0 ? (inbox.current_load / inbox.max_capacity) * 100 : 0;
    return utilization > 80 && inbox.status === 'active';
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
        <button
          onClick={() => loadData(true)}
          className="text-sm text-red-500 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const capacityPercent = stats.capacity.utilizationPercent;

  const statCards = [
    {
      label: 'Total Admin Inboxes',
      value: stats.adminInboxes.total,
      icon: Inbox,
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-500/10',
      link: '/admin/inboxes',
    },
    {
      label: 'Active Inboxes',
      value: stats.adminInboxes.active,
      icon: CheckCircle,
      color: 'text-green-500',
      bg: 'bg-green-50 dark:bg-green-500/10',
      link: '/admin/inboxes',
    },
    {
      label: 'Error Inboxes',
      value: stats.adminInboxes.error,
      icon: AlertCircle,
      color: 'text-red-500',
      bg: 'bg-red-50 dark:bg-red-500/10',
      link: '/admin/inboxes',
      alert: stats.adminInboxes.error > 0,
    },
    {
      label: 'Network Users',
      value: stats.networkUsers,
      icon: Users,
      color: 'text-purple-500',
      bg: 'bg-purple-50 dark:bg-purple-500/10',
      link: '/admin/users',
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-[#6b7280] mt-1">
            Network warmup infrastructure overview
            {lastUpdated && (
              <span className="ml-2 text-xs">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              autoRefresh
                ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400'
                : 'bg-white dark:bg-[#1a1d24] border-gray-200 dark:border-[#2a2f3a] text-gray-600 dark:text-[#9ca3b0] hover:bg-gray-50 dark:hover:bg-[#252a35]'
            }`}
          >
            {autoRefresh ? (
              <>
                <Pause className="w-4 h-4" />
                Auto-refresh ON
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Auto-refresh OFF
              </>
            )}
          </button>
          {/* Manual refresh */}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-[#9ca3b0] bg-white dark:bg-[#1a1d24] border border-gray-200 dark:border-[#2a2f3a] rounded-lg hover:bg-gray-50 dark:hover:bg-[#252a35] transition-colors disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Alert Banner for Critical Issues */}
      {(stats.adminInboxes.error > 0 || inboxesNeedingAttention.length > 0) && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-400">
                Attention Required
              </h3>
              <p className="text-sm text-red-600 dark:text-red-400/80 mt-1">
                {stats.adminInboxes.error > 0 && (
                  <span>{stats.adminInboxes.error} inbox(es) disconnected. </span>
                )}
                {inboxesNeedingAttention.filter(i => i.health_score < 50 && i.status !== 'error').length > 0 && (
                  <span>
                    {inboxesNeedingAttention.filter(i => i.health_score < 50 && i.status !== 'error').length} inbox(es) with low health score.
                  </span>
                )}
              </p>
              <Link
                href="/admin/inboxes"
                className="inline-flex items-center gap-1 mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
              >
                View inboxes <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.link}
            className={`bg-white dark:bg-[#1a1d24] rounded-xl border transition-colors hover:border-orange-300 dark:hover:border-orange-500/40 ${
              card.alert
                ? 'border-red-300 dark:border-red-500/40'
                : 'border-gray-200 dark:border-[#2a2f3a]'
            } p-5`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <span className="text-sm text-gray-500 dark:text-[#6b7280]">{card.label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
          </Link>
        ))}
      </div>

      {/* Capacity & Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Capacity Overview */}
        <div className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-500/10">
              <Server className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Capacity Overview</h2>
              <p className="text-sm text-gray-500 dark:text-[#6b7280]">
                {stats.capacity.used} of {stats.capacity.total} slots used
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative w-full h-6 bg-gray-200 dark:bg-[#2a2f3a] rounded-full overflow-hidden mb-4">
            <div
              className={`h-full rounded-full transition-all ${
                capacityPercent > 90 ? 'bg-red-500' :
                capacityPercent > 75 ? 'bg-orange-500' :
                capacityPercent > 50 ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(capacityPercent, 100)}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-medium text-gray-700 dark:text-white drop-shadow">
                {capacityPercent}% utilized
              </span>
            </div>
          </div>

          {/* Capacity Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 dark:bg-[#0f1117] rounded-lg">
              <p className="text-xs text-gray-500 dark:text-[#6b7280] mb-1">Total</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.capacity.total}</p>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-[#0f1117] rounded-lg">
              <p className="text-xs text-gray-500 dark:text-[#6b7280] mb-1">Used</p>
              <p className="text-lg font-bold text-orange-500">{stats.capacity.used}</p>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-[#0f1117] rounded-lg">
              <p className="text-xs text-gray-500 dark:text-[#6b7280] mb-1">Available</p>
              <p className="text-lg font-bold text-green-500">{stats.capacity.available}</p>
            </div>
          </div>
        </div>

        {/* Today's Activity */}
        <div className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-500/10">
              <Activity className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Today's Activity</h2>
              <p className="text-sm text-gray-500 dark:text-[#6b7280]">Email volume across all admin inboxes</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-500/10 dark:to-green-500/5 rounded-xl">
              <Send className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.today.sent}</p>
              <p className="text-sm text-green-700 dark:text-green-500">Emails Sent</p>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-500/10 dark:to-blue-500/5 rounded-xl">
              <Mail className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.today.received}</p>
              <p className="text-sm text-blue-700 dark:text-blue-500">Emails Received</p>
            </div>
          </div>
        </div>
      </div>

      {/* Inboxes Needing Attention */}
      {inboxesNeedingAttention.length > 0 && (
        <div className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Inboxes Needing Attention</h2>
                <p className="text-sm text-gray-500 dark:text-[#6b7280]">
                  Disconnected or low health score inboxes
                </p>
              </div>
            </div>
            <Link
              href="/admin/inboxes"
              className="text-sm text-orange-500 hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="space-y-2">
            {inboxesNeedingAttention.slice(0, 5).map((inbox) => (
              <Link
                key={inbox.id}
                href={`/admin/inboxes/${inbox.id}`}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#0f1117] hover:bg-gray-100 dark:hover:bg-[#252a35] rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  {inbox.status === 'error' ? (
                    <WifiOff className="w-4 h-4 text-red-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{inbox.email}</p>
                    <p className="text-xs text-gray-500 dark:text-[#6b7280]">
                      {inbox.status === 'error' ? 'Disconnected' : `Health: ${inbox.health_score}`}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* High Utilization Warning */}
      {highUtilizationInboxes.length > 0 && (
        <div className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-50 dark:bg-yellow-500/10">
                <TrendingUp className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">High Utilization Inboxes</h2>
                <p className="text-sm text-gray-500 dark:text-[#6b7280]">
                  Inboxes with more than 80% capacity used
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {highUtilizationInboxes.slice(0, 5).map((inbox) => {
              const utilization = Math.round((inbox.current_load / inbox.max_capacity) * 100);
              return (
                <Link
                  key={inbox.id}
                  href={`/admin/inboxes/${inbox.id}`}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#0f1117] hover:bg-gray-100 dark:hover:bg-[#252a35] rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400">{utilization}%</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{inbox.email}</p>
                      <p className="text-xs text-gray-500 dark:text-[#6b7280]">
                        {inbox.current_load}/{inbox.max_capacity} slots used
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
