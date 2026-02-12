'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchNetworkUsers, type NetworkUserEnriched } from '@/lib/admin-api';
import {
  Users,
  Inbox,
  Activity,
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Link2,
  AlertCircle,
} from 'lucide-react';

type SortField = 'email' | 'warmup_day' | 'health_score' | 'sent_today';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'unassigned' | 'error';

const ITEMS_PER_PAGE = 10;

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<NetworkUserEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('warmup_day');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const loadUsers = useCallback(async (showRefreshState = false) => {
    try {
      if (showRefreshState) setRefreshing(true);
      const data = await fetchNetworkUsers();
      setUsers(data);
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
    loadUsers();
  }, [loadUsers]);

  // Filter and sort logic
  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(user =>
        user.email.toLowerCase().includes(query) ||
        user.assignments.some(a => a.admin_email?.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    switch (statusFilter) {
      case 'active':
        result = result.filter(user => user.status === 'active');
        break;
      case 'error':
        result = result.filter(user => user.status === 'error');
        break;
      case 'unassigned':
        result = result.filter(user => user.assignments.length === 0);
        break;
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'email':
          comparison = a.email.localeCompare(b.email);
          break;
        case 'warmup_day':
          comparison = a.warmup_day - b.warmup_day;
          break;
        case 'health_score':
          comparison = a.health_score - b.health_score;
          break;
        case 'sent_today':
          comparison = a.sent_today - b.sent_today;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [users, searchQuery, statusFilter, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedUsers, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  const getPhaseBadge = (phase: string) => {
    const styles: Record<string, string> = {
      ramp_up: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
      steady: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
      paused: 'bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400',
    };
    return (
      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${styles[phase] || styles.paused}`}>
        {phase.replace('_', ' ')}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
          Active
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">
        <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
        Error
      </span>
    );
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Network Users</h1>
          <p className="text-sm text-gray-500 dark:text-[#6b7280] mt-1">
            {users.length} users using Network Warmup mode
          </p>
        </div>
        <button
          onClick={() => loadUsers(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-[#9ca3b0] bg-white dark:bg-[#1a1d24] border border-gray-200 dark:border-[#2a2f3a] rounded-lg hover:bg-gray-50 dark:hover:bg-[#252a35] transition-colors disabled:opacity-50"
        >
          <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by email..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 dark:bg-[#0f1117] border border-gray-200 dark:border-[#2a2f3a] rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2 text-sm bg-gray-50 dark:bg-[#0f1117] border border-gray-200 dark:border-[#2a2f3a] rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="error">Error</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500 dark:text-[#6b7280]">
          Showing {paginatedUsers.length} of {filteredAndSortedUsers.length} users
          {searchQuery && ` matching "${searchQuery}"`}
        </p>
      </div>

      {/* Empty State */}
      {filteredAndSortedUsers.length === 0 ? (
        <div className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] p-12 text-center">
          <Users className="w-12 h-12 text-gray-400 dark:text-[#6b7280] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchQuery || statusFilter !== 'all' ? 'No users found' : 'No network users'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-[#6b7280]">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filters.'
              : 'No users have enabled Network Warmup mode yet.'}
          </p>
          {(searchQuery || statusFilter !== 'all') && (
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
              className="mt-4 text-sm text-orange-500 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-[#2a2f3a]">
                  <th className="text-left px-6 py-3">
                    <button
                      onClick={() => handleSort('email')}
                      className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-[#6b7280] uppercase hover:text-gray-700 dark:hover:text-white"
                    >
                      User Inbox
                      <SortIcon field="email" />
                    </button>
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-[#6b7280] uppercase">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-[#6b7280] uppercase">
                    Assigned Admin
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-[#6b7280] uppercase">
                    Phase
                  </th>
                  <th className="text-left px-6 py-3">
                    <button
                      onClick={() => handleSort('warmup_day')}
                      className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-[#6b7280] uppercase hover:text-gray-700 dark:hover:text-white"
                    >
                      Day
                      <SortIcon field="warmup_day" />
                    </button>
                  </th>
                  <th className="text-left px-6 py-3">
                    <button
                      onClick={() => handleSort('health_score')}
                      className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-[#6b7280] uppercase hover:text-gray-700 dark:hover:text-white"
                    >
                      Health
                      <SortIcon field="health_score" />
                    </button>
                  </th>
                  <th className="text-left px-6 py-3">
                    <button
                      onClick={() => handleSort('sent_today')}
                      className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-[#6b7280] uppercase hover:text-gray-700 dark:hover:text-white"
                    >
                      Sent Today
                      <SortIcon field="sent_today" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-[#2a2f3a]">
                {paginatedUsers.map((user) => (
                  <tr key={user.inbox_id} className="hover:bg-gray-50 dark:hover:bg-[#252a35]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Inbox className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(user.status)}
                    </td>
                    <td className="px-6 py-4">
                      {user.assignments.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <Link2 className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-sm text-gray-600 dark:text-[#9ca3b0]">
                            {user.assignments[0].admin_email || 'Unknown'}
                          </span>
                          {user.assignments.length > 1 && (
                            <span className="text-xs text-gray-400">
                              +{user.assignments.length - 1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-[#6b7280] italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">{getPhaseBadge(user.warmup_phase)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-[#9ca3b0]">{user.warmup_day}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${getHealthColor(user.health_score)}`}>
                        {user.health_score}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 dark:text-[#9ca3b0]">{user.sent_today}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500 dark:text-[#6b7280]">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 text-gray-500 dark:text-[#6b7280] hover:text-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 text-sm font-medium rounded-lg transition-colors ${
                        currentPage === pageNum
                          ? 'bg-orange-500 text-white'
                          : 'text-gray-600 dark:text-[#9ca3b0] hover:bg-gray-100 dark:hover:bg-[#252a35]'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 text-gray-500 dark:text-[#6b7280] hover:text-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
