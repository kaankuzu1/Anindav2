'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  fetchAdminInbox,
  updateAdminInbox,
  checkAdminInboxConnection,
  deleteAdminInbox,
  fetchNetworkUsers,
  type AdminInbox,
  type NetworkUserEnriched,
  type InboxAssignment,
} from '@/lib/admin-api';
import {
  ArrowLeft,
  Mail,
  CheckCircle,
  AlertCircle,
  WifiOff,
  Loader2,
  RefreshCw,
  Trash2,
  Settings,
  Users,
  Activity,
  Calendar,
  Server,
  BarChart3,
  Plus,
  X,
  Link2,
  Unlink,
} from 'lucide-react';

interface AdminInboxDetail extends AdminInbox {
  assignments: InboxAssignment[];
}

export default function AdminInboxDetailPage() {
  const params = useParams();
  const router = useRouter();
  const inboxId = params.id as string;

  const [inbox, setInbox] = useState<AdminInboxDetail | null>(null);
  const [networkUsers, setNetworkUsers] = useState<NetworkUserEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [checking, setChecking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [editCapacity, setEditCapacity] = useState<number>(20);
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [inboxData, usersData] = await Promise.all([
        fetchAdminInbox(inboxId),
        fetchNetworkUsers(),
      ]);
      setInbox(inboxData as AdminInboxDetail);
      setNetworkUsers(usersData);
      setEditCapacity(inboxData.max_capacity);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [inboxId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-dismiss notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleCheckConnection = async () => {
    setChecking(true);
    try {
      const result = await checkAdminInboxConnection(inboxId);
      if (result.connected) {
        setNotification({ type: 'success', message: 'Connection verified successfully' });
        await loadData();
      } else {
        setNotification({ type: 'error', message: result.message || 'Connection failed' });
        await loadData();
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setChecking(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this admin inbox? All user assignments will be removed.')) return;
    setDeleting(true);
    try {
      await deleteAdminInbox(inboxId);
      router.push('/admin/inboxes?deleted=true');
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
      setDeleting(false);
    }
  };

  const handleSaveCapacity = async () => {
    setSavingCapacity(true);
    try {
      await updateAdminInbox(inboxId, { max_capacity: editCapacity });
      setEditingCapacity(false);
      setNotification({ type: 'success', message: 'Capacity updated' });
      await loadData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setSavingCapacity(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400">
            <CheckCircle className="w-4 h-4" /> Active
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">
            <WifiOff className="w-4 h-4" /> Disconnected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-full bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400">
            <AlertCircle className="w-4 h-4" /> {status}
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

  const getHealthBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-50 dark:bg-green-500/10';
    if (score >= 50) return 'bg-yellow-50 dark:bg-yellow-500/10';
    return 'bg-red-50 dark:bg-red-500/10';
  };

  // Get users assigned to this admin inbox
  const assignedUsers = networkUsers.filter(user =>
    user.assignments.some(a => a.admin_inbox_id === inboxId)
  );

  // Get users not assigned to this inbox (for the assign modal)
  const availableUsers = networkUsers.filter(user =>
    !user.assignments.some(a => a.admin_inbox_id === inboxId)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !inbox) {
    return (
      <div>
        <Link
          href="/admin/inboxes"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-[#6b7280] hover:text-gray-700 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Inboxes
        </Link>
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
          {error || 'Inbox not found'}
        </div>
      </div>
    );
  }

  const loadPercent = inbox.max_capacity > 0
    ? Math.round((inbox.current_load / inbox.max_capacity) * 100)
    : 0;

  return (
    <div>
      {/* Back Link */}
      <Link
        href="/admin/inboxes"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-[#6b7280] hover:text-gray-700 dark:hover:text-white mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Inboxes
      </Link>

      {/* Notification */}
      {notification && (
        <div className={`flex items-center justify-between gap-3 p-4 rounded-lg mb-6 ${
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

      {/* Disconnected Warning Banner */}
      {inbox.status === 'error' && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <WifiOff className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-400">
                Connection Lost
              </h3>
              <p className="text-sm text-red-600 dark:text-red-400/80 mt-1">
                {inbox.status_reason || 'This inbox is disconnected. Please reconnect to resume warmup operations.'}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleCheckConnection}
                  disabled={checking}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {checking ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Check Connection
                </button>
                <Link
                  href="/admin/inboxes/connect"
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-[#1a1d24] text-red-600 dark:text-red-400 border border-red-300 dark:border-red-500/30 text-xs font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Reconnect
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-orange-50 dark:bg-orange-500/10 rounded-xl flex items-center justify-center">
            <Mail className="w-7 h-7 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{inbox.email}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-gray-500 dark:text-[#6b7280]">{getProviderLabel(inbox.provider)}</span>
              {getStatusBadge(inbox.status)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCheckConnection}
            disabled={checking}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-[#9ca3b0] bg-white dark:bg-[#1a1d24] border border-gray-200 dark:border-[#2a2f3a] rounded-lg hover:bg-gray-50 dark:hover:bg-[#252a35] transition-colors disabled:opacity-50"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Check Connection
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-[#1a1d24] border border-red-200 dark:border-red-500/30 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Health Score */}
        <div className={`rounded-xl border border-gray-200 dark:border-[#2a2f3a] p-5 ${getHealthBgColor(inbox.health_score)}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-white/50 dark:bg-black/20">
              <Activity className={`w-5 h-5 ${getHealthColor(inbox.health_score)}`} />
            </div>
            <span className="text-sm text-gray-500 dark:text-[#6b7280]">Health Score</span>
          </div>
          <p className={`text-3xl font-bold ${getHealthColor(inbox.health_score)}`}>{inbox.health_score}</p>
        </div>

        {/* Capacity */}
        <div className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10">
                <Server className="w-5 h-5 text-blue-500" />
              </div>
              <span className="text-sm text-gray-500 dark:text-[#6b7280]">Capacity</span>
            </div>
            <button
              onClick={() => setEditingCapacity(!editingCapacity)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
          {editingCapacity ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={50}
                value={editCapacity}
                onChange={(e) => setEditCapacity(Number(e.target.value))}
                className="w-20 px-2 py-1 text-lg font-bold bg-white dark:bg-[#0f1117] border border-gray-300 dark:border-[#2a2f3a] rounded text-gray-900 dark:text-white"
              />
              <button
                onClick={handleSaveCapacity}
                disabled={savingCapacity}
                className="text-xs text-orange-500 hover:underline"
              >
                {savingCapacity ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => { setEditingCapacity(false); setEditCapacity(inbox.max_capacity); }}
                className="text-xs text-gray-500 hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {inbox.current_load}<span className="text-lg text-gray-400 dark:text-[#6b7280]">/{inbox.max_capacity}</span>
              </p>
              <div className="mt-2 w-full bg-gray-200 dark:bg-[#2a2f3a] rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${loadPercent > 80 ? 'bg-red-500' : loadPercent > 50 ? 'bg-orange-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(loadPercent, 100)}%` }}
                />
              </div>
            </>
          )}
        </div>

        {/* Sent Today */}
        <div className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-500/10">
              <BarChart3 className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-sm text-gray-500 dark:text-[#6b7280]">Sent Today</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{inbox.sent_today}</p>
        </div>

        {/* Received Today */}
        <div className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-500/10">
              <Mail className="w-5 h-5 text-purple-500" />
            </div>
            <span className="text-sm text-gray-500 dark:text-[#6b7280]">Received Today</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{inbox.received_today}</p>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Inbox Details */}
        <div className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Inbox Details</h2>
          <dl className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-[#2a2f3a]">
              <dt className="text-sm text-gray-500 dark:text-[#6b7280]">Email Address</dt>
              <dd className="text-sm font-medium text-gray-900 dark:text-white">{inbox.email}</dd>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-[#2a2f3a]">
              <dt className="text-sm text-gray-500 dark:text-[#6b7280]">Provider</dt>
              <dd className="text-sm font-medium text-gray-900 dark:text-white">{getProviderLabel(inbox.provider)}</dd>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-[#2a2f3a]">
              <dt className="text-sm text-gray-500 dark:text-[#6b7280]">Status</dt>
              <dd>{getStatusBadge(inbox.status)}</dd>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-[#2a2f3a]">
              <dt className="text-sm text-gray-500 dark:text-[#6b7280]">Total Sent</dt>
              <dd className="text-sm font-medium text-gray-900 dark:text-white">{inbox.sent_total}</dd>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-[#2a2f3a]">
              <dt className="text-sm text-gray-500 dark:text-[#6b7280]">Created</dt>
              <dd className="text-sm font-medium text-gray-900 dark:text-white">
                {new Date(inbox.created_at).toLocaleDateString()}
              </dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-sm text-gray-500 dark:text-[#6b7280]">Last Updated</dt>
              <dd className="text-sm font-medium text-gray-900 dark:text-white">
                {new Date(inbox.updated_at).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </div>

        {/* Assigned Users */}
        <div className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Assigned User Inboxes ({assignedUsers.length})
            </h2>
            {availableUsers.length > 0 && (
              <button
                onClick={() => setShowAssignModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add Assignment
              </button>
            )}
          </div>

          {assignedUsers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-[#6b7280]">No users assigned to this inbox</p>
              {availableUsers.length > 0 && (
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add First Assignment
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {assignedUsers.map((user) => (
                <div
                  key={user.inbox_id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#0f1117] rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${user.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{user.email}</p>
                      <p className="text-xs text-gray-500 dark:text-[#6b7280]">
                        Day {user.warmup_day} - {user.warmup_phase.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${getHealthColor(user.health_score)}`}>
                      {user.health_score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAssignModal(false)}
          />
          <div className="relative bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[#2a2f3a]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Assign User Inbox
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {availableUsers.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-[#6b7280] text-center py-4">
                  No available users to assign
                </p>
              ) : (
                <div className="space-y-2">
                  {availableUsers.map((user) => (
                    <button
                      key={user.inbox_id}
                      onClick={async () => {
                        // Note: Assignment API would need to be implemented on backend
                        // For now, show that this is where the assignment logic would go
                        setNotification({ type: 'info' as any, message: 'Assignment feature coming soon' });
                        setShowAssignModal(false);
                      }}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-[#0f1117] hover:bg-gray-100 dark:hover:bg-[#252a35] rounded-lg transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${user.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{user.email}</p>
                          <p className="text-xs text-gray-500 dark:text-[#6b7280]">
                            Day {user.warmup_day} - {user.warmup_phase.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                      <Link2 className="w-4 h-4 text-gray-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
