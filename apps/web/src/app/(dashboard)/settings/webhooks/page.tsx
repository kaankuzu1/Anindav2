'use client';

import { useEffect, useState } from 'react';
import {
  Webhook,
  Plus,
  Copy,
  RefreshCw,
  TestTube,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Clock,
  Trash2,
} from 'lucide-react';
import { useSettingsAuth } from '@/hooks/use-settings-auth';
import { SettingsSubPageLayout } from '@/components/settings/settings-sub-page-layout';

interface WebhookData {
  id: string;
  team_id: string;
  url: string;
  events: string[];
  secret?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

interface WebhookDeliveryLog {
  id: string;
  webhook_id: string;
  event: string;
  status_code: number;
  response_time_ms: number;
  success: boolean;
  error_message?: string;
  created_at: string;
}

const WEBHOOK_EVENTS = [
  { value: 'email.sent', label: 'Email Sent', description: 'When an email is sent' },
  { value: 'email.delivered', label: 'Email Delivered', description: 'When email delivery is confirmed' },
  { value: 'email.opened', label: 'Email Opened', description: 'When a recipient opens an email' },
  { value: 'email.clicked', label: 'Link Clicked', description: 'When a recipient clicks a link' },
  { value: 'email.bounced', label: 'Email Bounced', description: 'When an email bounces' },
  { value: 'reply.received', label: 'Reply Received', description: 'When a reply is detected' },
  { value: 'reply.interested', label: 'Interested Reply', description: 'When AI detects interested reply' },
  { value: 'reply.not_interested', label: 'Not Interested', description: 'When AI detects not interested reply' },
  { value: 'lead.bounced', label: 'Lead Bounced', description: 'When a lead is marked as bounced' },
  { value: 'lead.unsubscribed', label: 'Lead Unsubscribed', description: 'When a lead unsubscribes' },
];

export default function WebhooksSettingsPage() {
  const { team, accessToken, loading } = useSettingsAuth();

  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookData | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [webhookLogs, setWebhookLogs] = useState<WebhookDeliveryLog[]>([]);
  const [viewingLogsFor, setViewingLogsFor] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState<string | null>(null);

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

  const fetchWebhooks = async () => {
    if (!team || !accessToken) return;
    setWebhooksLoading(true);
    try {
      const res = await fetch(`${apiUrl}/webhooks?team_id=${team.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data);
      }
    } catch (err) {
      console.error('Failed to fetch webhooks:', err);
    } finally {
      setWebhooksLoading(false);
    }
  };

  useEffect(() => {
    if (team && accessToken) {
      fetchWebhooks();
    }
  }, [team, accessToken]);

  const openWebhookModal = (webhook?: WebhookData) => {
    if (webhook) {
      setEditingWebhook(webhook);
      setWebhookUrl(webhook.url);
      setWebhookEvents(webhook.events);
    } else {
      setEditingWebhook(null);
      setWebhookUrl('');
      setWebhookEvents([]);
    }
    setShowWebhookModal(true);
  };

  const handleSaveWebhook = async () => {
    if (!team || !accessToken || !webhookUrl || webhookEvents.length === 0) return;
    setWebhookSaving(true);

    try {
      if (editingWebhook) {
        const res = await fetch(`${apiUrl}/webhooks/${editingWebhook.id}?team_id=${team.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ url: webhookUrl, events: webhookEvents }),
        });
        if (res.ok) {
          const updated = await res.json();
          setWebhooks(webhooks.map((w) => (w.id === updated.id ? updated : w)));
        }
      } else {
        const res = await fetch(`${apiUrl}/webhooks?team_id=${team.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ url: webhookUrl, events: webhookEvents }),
        });
        if (res.ok) {
          const created = await res.json();
          setWebhooks([created, ...webhooks]);
        }
      }
      setShowWebhookModal(false);
      setWebhookUrl('');
      setWebhookEvents([]);
      setEditingWebhook(null);
    } catch (err) {
      console.error('Failed to save webhook:', err);
    } finally {
      setWebhookSaving(false);
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!team || !accessToken) return;
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      const res = await fetch(`${apiUrl}/webhooks/${webhookId}?team_id=${team.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        setWebhooks(webhooks.filter((w) => w.id !== webhookId));
      }
    } catch (err) {
      console.error('Failed to delete webhook:', err);
    }
  };

  const handleToggleWebhook = async (webhook: WebhookData) => {
    if (!team || !accessToken) return;

    try {
      const res = await fetch(`${apiUrl}/webhooks/${webhook.id}?team_id=${team.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ is_active: !webhook.is_active }),
      });
      if (res.ok) {
        const updated = await res.json();
        setWebhooks(webhooks.map((w) => (w.id === updated.id ? updated : w)));
      }
    } catch (err) {
      console.error('Failed to toggle webhook:', err);
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    if (!team || !accessToken) return;
    setTestingWebhook(webhookId);
    setTestResult(null);

    try {
      const res = await fetch(`${apiUrl}/webhooks/${webhookId}/test?team_id=${team.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await res.json();
      setTestResult({
        success: result.success,
        message: result.success
          ? `Success! Response time: ${result.responseTime}ms, Status: ${result.statusCode}`
          : `Failed: ${result.error || 'Unknown error'}`,
      });
    } catch (err) {
      setTestResult({ success: false, message: 'Network error' });
    } finally {
      setTestingWebhook(null);
    }
  };

  const handleRotateSecret = async (webhookId: string) => {
    if (!team || !accessToken) return;
    if (!confirm('Are you sure you want to rotate the webhook secret? You will need to update your endpoint with the new secret.')) return;

    try {
      const res = await fetch(`${apiUrl}/webhooks/${webhookId}/rotate-secret?team_id=${team.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const result = await res.json();
        setWebhooks(webhooks.map((w) => (w.id === webhookId ? { ...w, secret: result.secret } : w)));
        setCopiedSecret(result.secret);
        setTimeout(() => setCopiedSecret(null), 10000);
      }
    } catch (err) {
      console.error('Failed to rotate secret:', err);
    }
  };

  const handleViewLogs = async (webhookId: string) => {
    if (!team || !accessToken) return;
    setViewingLogsFor(webhookId);

    try {
      const res = await fetch(`${apiUrl}/webhooks/${webhookId}/logs?team_id=${team.id}&limit=20`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const logs = await res.json();
        setWebhookLogs(logs);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSecret(text);
    setTimeout(() => setCopiedSecret(null), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SettingsSubPageLayout title="Webhooks" description="Receive real-time notifications for events">
      {/* Header */}
      <div className="bg-white dark:bg-[#262b36] rounded-xl border border-gray-200 dark:border-[#353b48] p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <Webhook className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Webhooks</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Receive real-time notifications for events</p>
            </div>
          </div>
          <button
            onClick={() => openWebhookModal()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            Add Webhook
          </button>
        </div>

        {webhooksLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : webhooks.length === 0 ? (
          <div className="text-center py-8">
            <Webhook className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No webhooks configured</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Create a webhook to receive event notifications
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="border border-gray-200 dark:border-[#353b48] rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${webhook.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <p className="font-medium text-gray-900 dark:text-white truncate">{webhook.url}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {webhook.events.map((event) => (
                        <span
                          key={event}
                          className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-[#353b48] text-gray-600 dark:text-gray-400 rounded"
                        >
                          {event}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Created {new Date(webhook.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleToggleWebhook(webhook)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        webhook.is_active ? 'bg-primary' : 'bg-gray-300 dark:bg-[#404654]'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          webhook.is_active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => handleTestWebhook(webhook.id)}
                      disabled={testingWebhook === webhook.id}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg"
                      title="Test webhook"
                    >
                      {testingWebhook === webhook.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <TestTube className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleViewLogs(webhook.id)}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#353b48] rounded-lg"
                      title="View logs"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRotateSecret(webhook.id)}
                      className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg"
                      title="Rotate secret"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openWebhookModal(webhook)}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#353b48] rounded-lg"
                      title="Edit"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteWebhook(webhook.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Test Result */}
                {testResult && testingWebhook === null && (
                  <div className={`mt-3 p-3 rounded-lg ${
                    testResult.success
                      ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                      : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                  }`}>
                    <div className="flex items-center gap-2">
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      <span className="text-sm">{testResult.message}</span>
                    </div>
                  </div>
                )}

                {/* Show new secret after rotation */}
                {webhook.secret && copiedSecret === webhook.secret && (
                  <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-500/10 rounded-lg">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">
                      New webhook secret (copy now, it won&apos;t be shown again):
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded font-mono break-all">
                        {webhook.secret}
                      </code>
                      <button
                        onClick={() => copyToClipboard(webhook.secret!)}
                        className="p-2 text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Webhook Documentation */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-500/10 dark:to-cyan-500/10 rounded-xl border border-blue-200 dark:border-blue-500/30 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Webhook Signature Verification</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          All webhook deliveries include a signature header for verification:
        </p>
        <div className="bg-white dark:bg-[#262b36] p-4 rounded-lg font-mono text-sm">
          <p className="text-gray-600 dark:text-gray-400 mb-2"># Headers included with each request:</p>
          <p className="text-blue-600 dark:text-blue-400">X-Webhook-Signature: sha256=...</p>
          <p className="text-blue-600 dark:text-blue-400">X-Webhook-Event: email.sent</p>
          <p className="text-blue-600 dark:text-blue-400">X-Webhook-Timestamp: 2024-01-15T10:30:00Z</p>
        </div>
      </div>

      {/* Webhook Create/Edit Modal */}
      {showWebhookModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#262b36] rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-[#353b48]">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingWebhook ? 'Edit Webhook' : 'Create Webhook'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Endpoint URL *
                </label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-server.com/webhook"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#404654] rounded-lg bg-white dark:bg-[#2e3340] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Events to Subscribe *
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {WEBHOOK_EVENTS.map((event) => (
                    <label
                      key={event.value}
                      className="flex items-start gap-3 p-3 border border-gray-200 dark:border-[#353b48] rounded-lg hover:border-primary/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={webhookEvents.includes(event.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setWebhookEvents([...webhookEvents, event.value]);
                          } else {
                            setWebhookEvents(webhookEvents.filter((ev) => ev !== event.value));
                          }
                        }}
                        className="mt-0.5 w-4 h-4 text-primary rounded focus:ring-primary"
                      />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{event.label}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{event.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-[#353b48] flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowWebhookModal(false);
                  setWebhookUrl('');
                  setWebhookEvents([]);
                  setEditingWebhook(null);
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveWebhook}
                disabled={webhookSaving || !webhookUrl || webhookEvents.length === 0}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {webhookSaving ? 'Saving...' : editingWebhook ? 'Update Webhook' : 'Create Webhook'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Webhook Logs Modal */}
      {viewingLogsFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#262b36] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-[#353b48] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Delivery Logs</h2>
              <button
                onClick={() => {
                  setViewingLogsFor(null);
                  setWebhookLogs([]);
                }}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {webhookLogs.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No delivery logs found</p>
              ) : (
                <div className="space-y-3">
                  {webhookLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 rounded-lg border ${
                        log.success
                          ? 'border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10'
                          : 'border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {log.success ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                          )}
                          <span className="font-medium text-gray-900 dark:text-white">{log.event}</span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          Status: <strong>{log.status_code}</strong>
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                          Response time: <strong>{log.response_time_ms}ms</strong>
                        </span>
                      </div>
                      {log.error_message && (
                        <p className="text-sm text-red-600 dark:text-red-400 mt-2">{log.error_message}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </SettingsSubPageLayout>
  );
}
