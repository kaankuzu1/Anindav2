'use client';

import { useState } from 'react';
import {
  Lock,
  Search,
  Download,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useSettingsAuth } from '@/hooks/use-settings-auth';
import { SettingsSubPageLayout } from '@/components/settings/settings-sub-page-layout';

interface GdprDeleteResult {
  success: boolean;
  email: string;
  deleted: {
    leads: number;
    emails: number;
    replies: number;
    suppressions: number;
  };
}

interface GdprExportResult {
  email: string;
  leads: any[];
  emails: any[];
  replies: any[];
  suppressions: any[];
  exportedAt: string;
}

export default function PrivacySettingsPage() {
  const { accessToken, loading } = useSettingsAuth();

  const [gdprEmail, setGdprEmail] = useState('');
  const [gdprDeleting, setGdprDeleting] = useState(false);
  const [gdprExporting, setGdprExporting] = useState(false);
  const [gdprDeleteResult, setGdprDeleteResult] = useState<GdprDeleteResult | null>(null);
  const [gdprExportResult, setGdprExportResult] = useState<GdprExportResult | null>(null);
  const [showGdprConfirm, setShowGdprConfirm] = useState(false);

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

  const handleGdprDelete = async () => {
    if (!accessToken || !gdprEmail) return;
    setGdprDeleting(true);
    setGdprDeleteResult(null);

    try {
      const res = await fetch(`${apiUrl}/leads/gdpr/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ email: gdprEmail }),
      });
      if (res.ok) {
        const result = await res.json();
        setGdprDeleteResult(result);
      } else {
        alert('Failed to delete data. Please try again.');
      }
    } catch (err) {
      console.error('GDPR delete failed:', err);
      alert('Failed to delete data. Please try again.');
    } finally {
      setGdprDeleting(false);
      setShowGdprConfirm(false);
    }
  };

  const handleGdprExport = async () => {
    if (!accessToken || !gdprEmail) return;
    setGdprExporting(true);
    setGdprExportResult(null);

    try {
      const res = await fetch(`${apiUrl}/leads/gdpr/export?email=${encodeURIComponent(gdprEmail)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const result = await res.json();
        setGdprExportResult(result);
      } else {
        alert('Failed to export data. Please try again.');
      }
    } catch (err) {
      console.error('GDPR export failed:', err);
      alert('Failed to export data. Please try again.');
    } finally {
      setGdprExporting(false);
    }
  };

  const downloadExportData = () => {
    if (!gdprExportResult) return;
    const blob = new Blob([JSON.stringify(gdprExportResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gdpr-export-${gdprEmail}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SettingsSubPageLayout title="Privacy" description="Manage personal data in compliance with GDPR">
      <div className="bg-white dark:bg-[#262b36] rounded-xl border border-gray-200 dark:border-[#353b48] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Data Privacy (GDPR)</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage personal data in compliance with GDPR</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Email Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={gdprEmail}
                  onChange={(e) => setGdprEmail(e.target.value)}
                  placeholder="Enter email address to search..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-[#404654] rounded-lg bg-white dark:bg-[#2e3340] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <button
                onClick={handleGdprExport}
                disabled={!gdprEmail || gdprExporting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {gdprExporting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Export Data
              </button>
              <button
                onClick={() => setShowGdprConfirm(true)}
                disabled={!gdprEmail || gdprDeleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {gdprDeleting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete All Data
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Search for an email address to export or delete all associated data
            </p>
          </div>

          {/* Export Results */}
          {gdprExportResult && (
            <div className="border border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 rounded-lg p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <h3 className="font-medium text-green-800 dark:text-green-300">Data Export Complete</h3>
                </div>
                <button
                  onClick={downloadExportData}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                >
                  <Download className="w-4 h-4" />
                  Download JSON
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-[#262b36] p-3 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{gdprExportResult.leads.length}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Leads</p>
                </div>
                <div className="bg-white dark:bg-[#262b36] p-3 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{gdprExportResult.emails.length}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Emails</p>
                </div>
                <div className="bg-white dark:bg-[#262b36] p-3 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{gdprExportResult.replies.length}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Replies</p>
                </div>
                <div className="bg-white dark:bg-[#262b36] p-3 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{gdprExportResult.suppressions.length}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Suppressions</p>
                </div>
              </div>
            </div>
          )}

          {/* Delete Results */}
          {gdprDeleteResult && (
            <div className="border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                <h3 className="font-medium text-red-800 dark:text-red-300">Data Deletion Complete</h3>
              </div>
              <p className="text-sm text-red-700 dark:text-red-400 mb-3">
                All data for <strong>{gdprDeleteResult.email}</strong> has been permanently deleted:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-[#262b36] p-3 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{gdprDeleteResult.deleted.leads}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Leads deleted</p>
                </div>
                <div className="bg-white dark:bg-[#262b36] p-3 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{gdprDeleteResult.deleted.emails}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Emails deleted</p>
                </div>
                <div className="bg-white dark:bg-[#262b36] p-3 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{gdprDeleteResult.deleted.replies}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Replies deleted</p>
                </div>
                <div className="bg-white dark:bg-[#262b36] p-3 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{gdprDeleteResult.deleted.suppressions}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Suppressions deleted</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* GDPR Info */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10 rounded-xl border border-green-200 dark:border-green-500/30 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">About GDPR Compliance</h3>
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <p><strong>Right to Access (Article 15):</strong> Export all data associated with an email address</p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <p><strong>Right to Erasure (Article 17):</strong> Permanently delete all personal data</p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <p><strong>Right to Portability (Article 20):</strong> Download data in machine-readable JSON format</p>
          </div>
        </div>
      </div>

      {/* GDPR Delete Confirmation Modal */}
      {showGdprConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#262b36] rounded-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Confirm Data Deletion</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to permanently delete all data associated with <strong className="text-gray-900 dark:text-white">{gdprEmail}</strong>?
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 mb-6">
                This will delete all leads, emails, replies, and suppression entries for this email address.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowGdprConfirm(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGdprDelete}
                  disabled={gdprDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {gdprDeleting ? 'Deleting...' : 'Delete All Data'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SettingsSubPageLayout>
  );
}
