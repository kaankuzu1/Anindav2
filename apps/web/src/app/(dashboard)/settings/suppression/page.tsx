'use client';

import { useEffect, useState } from 'react';
import {
  Ban,
  Plus,
  Search,
  Trash2,
  Upload,
  Download,
} from 'lucide-react';
import { useSettingsAuth } from '@/hooks/use-settings-auth';
import { SettingsSubPageLayout } from '@/components/settings/settings-sub-page-layout';

interface SuppressionEntry {
  id: string;
  email: string;
  reason: string;
  created_at: string;
}

export default function SuppressionSettingsPage() {
  const { team, accessToken, loading } = useSettingsAuth();

  const [suppressionList, setSuppressionList] = useState<SuppressionEntry[]>([]);
  const [suppressionLoading, setSuppressionLoading] = useState(false);
  const [suppressionSearch, setSuppressionSearch] = useState('');
  const [showAddSuppressionModal, setShowAddSuppressionModal] = useState(false);
  const [newSuppressionEmail, setNewSuppressionEmail] = useState('');
  const [newSuppressionReason, setNewSuppressionReason] = useState('manual');
  const [addingSuppression, setAddingSuppression] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkEmails, setBulkEmails] = useState('');
  const [bulkReason, setBulkReason] = useState('bulk_import');
  const [bulkImporting, setBulkImporting] = useState(false);

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

  const fetchSuppressionList = async () => {
    if (!team || !accessToken) return;
    setSuppressionLoading(true);
    try {
      const res = await fetch(`${apiUrl}/leads/suppression?team_id=${team.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSuppressionList(data);
      }
    } catch (err) {
      console.error('Failed to fetch suppression list:', err);
    } finally {
      setSuppressionLoading(false);
    }
  };

  useEffect(() => {
    if (team && accessToken) {
      fetchSuppressionList();
    }
  }, [team, accessToken]);

  const handleAddSuppression = async () => {
    if (!team || !accessToken || !newSuppressionEmail) return;
    setAddingSuppression(true);

    try {
      const res = await fetch(`${apiUrl}/leads/suppression?team_id=${team.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ email: newSuppressionEmail, reason: newSuppressionReason }),
      });
      if (res.ok) {
        const created = await res.json();
        setSuppressionList([created, ...suppressionList]);
        setShowAddSuppressionModal(false);
        setNewSuppressionEmail('');
        setNewSuppressionReason('manual');
      } else {
        const error = await res.text();
        alert(`Failed to add email: ${error}`);
      }
    } catch (err) {
      console.error('Failed to add suppression:', err);
    } finally {
      setAddingSuppression(false);
    }
  };

  const handleRemoveSuppression = async (email: string) => {
    if (!team || !accessToken) return;
    if (!confirm(`Are you sure you want to remove ${email} from the suppression list?`)) return;

    try {
      const res = await fetch(`${apiUrl}/leads/suppression/${encodeURIComponent(email)}?team_id=${team.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        setSuppressionList(suppressionList.filter((s) => s.email !== email));
      }
    } catch (err) {
      console.error('Failed to remove suppression:', err);
    }
  };

  const handleBulkImport = async () => {
    if (!team || !accessToken || !bulkEmails.trim()) return;
    setBulkImporting(true);

    const emails = bulkEmails
      .split(/[\n,;]/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && e.includes('@'));

    let added = 0;
    let failed = 0;

    for (const email of emails) {
      try {
        const res = await fetch(`${apiUrl}/leads/suppression?team_id=${team.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ email, reason: bulkReason }),
        });
        if (res.ok) {
          added++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    alert(`Import complete: ${added} added, ${failed} failed or already exist`);
    setShowBulkImportModal(false);
    setBulkEmails('');
    setBulkReason('bulk_import');
    setBulkImporting(false);
    fetchSuppressionList();
  };

  const exportSuppressionList = () => {
    if (suppressionList.length === 0) return;
    const csv = ['email,reason,created_at', ...suppressionList.map((s) => `${s.email},${s.reason},${s.created_at}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suppression-list-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredSuppressionList = suppressionList.filter(
    (s) =>
      s.email.toLowerCase().includes(suppressionSearch.toLowerCase()) ||
      s.reason.toLowerCase().includes(suppressionSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SettingsSubPageLayout title="Suppression List" description="Emails that will never receive campaigns">
      {/* Header */}
      <div className="bg-white dark:bg-[#262b36] rounded-xl border border-gray-200 dark:border-[#353b48] p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-orange-500 rounded-lg flex items-center justify-center">
              <Ban className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Suppression List</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Emails that will never receive campaigns ({suppressionList.length} total)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBulkImportModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-[#404654] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-[#353b48]"
            >
              <Upload className="w-4 h-4" />
              Bulk Import
            </button>
            <button
              onClick={exportSuppressionList}
              disabled={suppressionList.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-[#404654] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-[#353b48] disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={() => setShowAddSuppressionModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              Add Email
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={suppressionSearch}
              onChange={(e) => setSuppressionSearch(e.target.value)}
              placeholder="Search by email or reason..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-[#404654] rounded-lg bg-white dark:bg-[#2e3340] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        {/* Suppression List Table */}
        {suppressionLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredSuppressionList.length === 0 ? (
          <div className="text-center py-8">
            <Ban className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {suppressionSearch ? 'No matching emails found' : 'No suppressed emails'}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              {suppressionSearch ? 'Try a different search term' : 'Add emails to prevent sending campaigns'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-[#2e3340]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Added
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-[#353b48]">
                {filteredSuppressionList.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-[#2e3340]">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900 dark:text-white">{entry.email}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        entry.reason === 'unsubscribed'
                          ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-300'
                          : entry.reason === 'bounced' || entry.reason === 'hard_bounce'
                          ? 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300'
                          : entry.reason === 'spam_reported'
                          ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300'
                          : entry.reason === 'manual'
                          ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-gray-500/20 text-gray-800 dark:text-gray-300'
                      }`}>
                        {entry.reason.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRemoveSuppression(entry.email)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                        title="Remove from suppression list"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Suppression List Info */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-500/10 dark:to-orange-500/10 rounded-xl border border-red-200 dark:border-red-500/30 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">About Suppression Lists</h3>
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-start gap-2">
            <Ban className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <p><strong>Automatic additions:</strong> Emails are auto-added when they unsubscribe, bounce, or report spam</p>
          </div>
          <div className="flex items-start gap-2">
            <Ban className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <p><strong>Campaign protection:</strong> Suppressed emails are excluded from all campaigns automatically</p>
          </div>
          <div className="flex items-start gap-2">
            <Ban className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <p><strong>Compliance:</strong> Maintains deliverability and compliance by preventing sends to known bad addresses</p>
          </div>
        </div>
      </div>

      {/* Add Suppression Modal */}
      {showAddSuppressionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#262b36] rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-[#353b48]">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add to Suppression List</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={newSuppressionEmail}
                  onChange={(e) => setNewSuppressionEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#404654] rounded-lg bg-white dark:bg-[#2e3340] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason
                </label>
                <select
                  value={newSuppressionReason}
                  onChange={(e) => setNewSuppressionReason(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#404654] rounded-lg bg-white dark:bg-[#2e3340] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="manual">Manual addition</option>
                  <option value="do_not_contact">Do not contact request</option>
                  <option value="competitor">Competitor</option>
                  <option value="invalid">Invalid email</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-[#353b48] flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddSuppressionModal(false);
                  setNewSuppressionEmail('');
                  setNewSuppressionReason('manual');
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSuppression}
                disabled={addingSuppression || !newSuppressionEmail}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {addingSuppression ? 'Adding...' : 'Add to List'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#262b36] rounded-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200 dark:border-[#353b48]">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bulk Import Suppression List</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Addresses *
                </label>
                <textarea
                  value={bulkEmails}
                  onChange={(e) => setBulkEmails(e.target.value)}
                  placeholder={"Enter one email per line, or separate with commas/semicolons\n\nemail1@example.com\nemail2@example.com\nemail3@example.com"}
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#404654] rounded-lg bg-white dark:bg-[#2e3340] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-sm"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {bulkEmails.split(/[\n,;]/).filter((e) => e.trim() && e.includes('@')).length} valid emails detected
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason for all
                </label>
                <select
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#404654] rounded-lg bg-white dark:bg-[#2e3340] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="bulk_import">Bulk import</option>
                  <option value="do_not_contact">Do not contact list</option>
                  <option value="competitor">Competitor list</option>
                  <option value="invalid">Invalid email list</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-[#353b48] flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowBulkImportModal(false);
                  setBulkEmails('');
                  setBulkReason('bulk_import');
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkImport}
                disabled={bulkImporting || !bulkEmails.trim()}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {bulkImporting ? 'Importing...' : 'Import All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </SettingsSubPageLayout>
  );
}
