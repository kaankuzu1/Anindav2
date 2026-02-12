'use client';

import { AlertCircle } from 'lucide-react';
import { useSettingsAuth } from '@/hooks/use-settings-auth';
import { SettingsSubPageLayout } from '@/components/settings/settings-sub-page-layout';

function getPlanColor(plan: string) {
  switch (plan) {
    case 'enterprise':
      return 'bg-purple-100 text-purple-800';
    case 'pro':
      return 'bg-blue-100 text-blue-800';
    case 'starter':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export default function BillingSettingsPage() {
  const { team, usage, loading } = useSettingsAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!team) {
    return (
      <SettingsSubPageLayout title="Billing & Usage" description="Manage your plan and view usage">
        <p className="text-gray-500 dark:text-gray-400">No team found.</p>
      </SettingsSubPageLayout>
    );
  }

  return (
    <SettingsSubPageLayout title="Billing & Usage" description="Manage your plan and view usage">
      {/* Current Plan */}
      <div className="bg-white dark:bg-[#262b36] rounded-xl border border-gray-200 dark:border-[#353b48] p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Current Plan</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getPlanColor(team.plan)}`}>
              {team.plan}
            </span>
            <span className="text-gray-500 dark:text-gray-400">Plan</span>
          </div>
          <button className="text-primary hover:text-primary/80 text-sm font-medium">
            Upgrade Plan
          </button>
        </div>
      </div>

      {/* Usage */}
      <div className="bg-white dark:bg-[#262b36] rounded-xl border border-gray-200 dark:border-[#353b48] p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Usage</h2>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600 dark:text-gray-400">Daily Emails</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {usage.emailsSentToday} / {team.daily_email_limit}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-[#353b48] rounded-full h-2">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${Math.min((usage.emailsSentToday / team.daily_email_limit) * 100, 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600 dark:text-gray-400">Connected Inboxes</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {usage.inboxes} / {team.max_inboxes}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-[#353b48] rounded-full h-2">
              <div
                className="h-2 rounded-full bg-green-500"
                style={{ width: `${Math.min((usage.inboxes / team.max_inboxes) * 100, 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600 dark:text-gray-400">Active Campaigns</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {usage.campaigns} / {team.max_campaigns}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-[#353b48] rounded-full h-2">
              <div
                className="h-2 rounded-full bg-blue-500"
                style={{ width: `${Math.min((usage.campaigns / team.max_campaigns) * 100, 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600 dark:text-gray-400">Team Members</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {usage.teamMembers} / {team.max_team_members}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-[#353b48] rounded-full h-2">
              <div
                className="h-2 rounded-full bg-purple-500"
                style={{ width: `${Math.min((usage.teamMembers / team.max_team_members) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-900/50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-900 dark:text-red-400">Danger Zone</h3>
            <p className="text-sm text-red-700 dark:text-red-400/80 mt-1">
              Once you delete your team, all data will be permanently removed. This action cannot be undone.
            </p>
            <button className="mt-3 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">
              Delete Team
            </button>
          </div>
        </div>
      </div>
    </SettingsSubPageLayout>
  );
}
