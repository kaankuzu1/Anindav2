'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  fetchAdminInboxes,
  updateAdminInbox,
  deleteAdminInbox,
  checkAdminInboxConnection,
  type AdminInbox,
} from '@/lib/admin-api';
import {
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  WifiOff,
  Loader2,
  Settings,
  Mail,
  Eye,
  X,
  RotateCw,
} from 'lucide-react';

export default function AdminInboxesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [inboxes, setInboxes] = useState<AdminInbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCapacity, setEditCapacity] = useState<number>(10);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadInboxes = useCallback(async (showRefreshState = false) => {
    try {
      if (showRefreshState) setRefreshing(true);
      const data = await fetchAdminInboxes();
      setInboxes(data);
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
    loadInboxes();
  }, [loadInboxes]);

  // Handle OAuth callback notifications
  useEffect(() => {
    const success = searchParams.get('success');
    const errorParam = searchParams.get('error');
    const email = searchParams.get('email');

    if (success === 'true' && email) {
      setNotification({
        type: 'success',
        message: `Successfully connected ${decodeURIComponent(email)}`,
      });
      // Refresh list to show new inbox
      loadInboxes();
      // Clear URL params after showing notification
      window.history.replaceState({}, '', '/admin/inboxes');
    } else if (errorParam) {
      setNotification({
        type: 'error',
        message: decodeURIComponent(errorParam),
      });
      window.history.replaceState({}, '', '/admin/inboxes');
    }
  }, [searchParams, loadInboxes]);

  // Auto-dismiss notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleCheckConnection = async (id: string) => {
    setCheckingId(id);
    try {
      const result = await checkAdminInboxConnection(id);
      if (result.connected) {
        setNotification({ type: 'success', message: 'Connection verified successfully' });
        await loadInboxes();
      } else {
        setNotification({ type: 'error', message: result.message || 'Connection failed' });
        await loadInboxes();
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setCheckingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this admin inbox? All user assignments will be removed.')) return;
    setDeletingId(id);
    try {
      await deleteAdminInbox(id);
      setInboxes((prev) => prev.filter((i) => i.id !== id));
      setNotification({ type: 'success', message: 'Inbox deleted successfully' });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveCapacity = async (id: string) => {
    try {
      await updateAdminInbox(id, { max_capacity: editCapacity });
      setEditingId(null);
      setNotification({ type: 'success', message: 'Capacity updated' });
      await loadInboxes();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400">
            <CheckCircle className="w-3 h-3" /> Active
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">
            <WifiOff className="w-3 h-3" /> Disconnected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400">
            <AlertCircle className="w-3 h-3" /> {status}
          </span>
        );
    }
  };

  const getProviderLabel = (provider: string) => {
    switch (provider) {
      case 'google': return 'Gmail';
      case 'microsoft': return 'Outlook';
      case 'smtp': return 'SMTP';
      default: return provider;
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Inboxes</h1>
          <p className="text-sm text-gray-500 dark:text-[#6b7280] mt-1">
            Manage platform inboxes for Network Warmup
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadInboxes(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-[#9ca3b0] bg-white dark:bg-[#1a1d24] border border-gray-200 dark:border-[#2a2f3a] rounded-lg hover:bg-gray-50 dark:hover:bg-[#252a35] transition-colors disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/admin/inboxes/connect"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Connect Inbox
          </Link>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className={`flex items-center justify-between gap-3 p-4 rounded-lg mb-4 ${
          notification.type === 'success'
            ? 'bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30'
            : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30'
        }`}>
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            )}
            <p className={`text-sm ${
              notification.type === 'success' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
            }`}>
              {notification.message}
            </p>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error State */}
      {error && !notification && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-lg mb-4 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:underline text-xs">dismiss</button>
        </div>
      )}

      {/* Empty State */}
      {inboxes.length === 0 ? (
        <div className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] p-12 text-center">
          <Mail className="w-12 h-12 text-gray-400 dark:text-[#6b7280] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No admin inboxes</h3>
          <p className="text-sm text-gray-500 dark:text-[#6b7280] mb-4">
            Connect email accounts to power the Network Warmup feature.
          </p>
          <Link
            href="/admin/inboxes/connect"
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Connect First Inbox
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-[#2a2f3a]">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-[#6b7280] uppercase">Email</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-[#6b7280] uppercase">Provider</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-[#6b7280] uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-[#6b7280] uppercase">Health</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-[#6b7280] uppercase">Capacity</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-[#6b7280] uppercase">Sent Today</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 dark:text-[#6b7280] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-[#2a2f3a]">
              {inboxes.map((inbox) => {
                const loadPercent = inbox.max_capacity > 0
                  ? Math.round((inbox.current_load / inbox.max_capacity) * 100)
                  : 0;

                return (
                  <tr key={inbox.id} className="hover:bg-gray-50 dark:hover:bg-[#252a35]">
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/inboxes/${inbox.id}`}
                        className="text-sm font-medium text-gray-900 dark:text-white hover:text-orange-500 transition-colors"
                      >
                        {inbox.email}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 dark:text-[#9ca3b0]">{getProviderLabel(inbox.provider)}</span>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(inbox.status)}</td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${getHealthColor(inbox.health_score)}`}>
                        {inbox.health_score}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {editingId === inbox.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={editCapacity}
                            onChange={(e) => setEditCapacity(Number(e.target.value))}
                            className="w-16 px-2 py-1 text-sm bg-white dark:bg-[#0f1117] border border-gray-300 dark:border-[#2a2f3a] rounded text-gray-900 dark:text-white"
                          />
                          <button onClick={() => handleSaveCapacity(inbox.id)} className="text-xs text-orange-500 hover:underline">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:underline">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 dark:bg-[#2a2f3a] rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${loadPercent > 80 ? 'bg-red-500' : loadPercent > 50 ? 'bg-orange-500' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(loadPercent, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-[#6b7280]">
                            {inbox.current_load}/{inbox.max_capacity}
                          </span>
                          <button
                            onClick={() => { setEditingId(inbox.id); setEditCapacity(inbox.max_capacity); }}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
                          >
                            <Settings className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 dark:text-[#9ca3b0]">{inbox.sent_today}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/inboxes/${inbox.id}`}
                          className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleCheckConnection(inbox.id)}
                          disabled={checkingId === inbox.id}
                          className="p-1.5 text-gray-400 hover:text-green-500 transition-colors disabled:opacity-50"
                          title="Check connection"
                        >
                          {checkingId === inbox.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(inbox.id)}
                          disabled={deletingId === inbox.id}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                          title="Delete inbox"
                        >
                          {deletingId === inbox.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
