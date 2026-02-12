'use client';

import { useState, useEffect } from 'react';
import { useSettingsAuth } from '@/hooks/use-settings-auth';
import { SettingsSubPageLayout } from '@/components/settings/settings-sub-page-layout';

export default function TeamSettingsPage() {
  const { team, setTeam, loading, supabase } = useSettingsAuth();
  const [teamName, setTeamName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [physicalAddress, setPhysicalAddress] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (team) {
      setTeamName(team.name);
      setCompanyName(team.company_name || '');
      setPhysicalAddress(team.physical_address || '');
    }
  }, [team]);

  const handleSaveTeam = async () => {
    if (!team) return;
    setSaving(true);

    await (supabase.from('teams') as any)
      .update({
        name: teamName,
        company_name: companyName || null,
        physical_address: physicalAddress || null,
      })
      .eq('id', team.id);

    setTeam({ ...team, name: teamName, company_name: companyName, physical_address: physicalAddress });
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!team) {
    return (
      <SettingsSubPageLayout title="Team" description="Manage your team settings">
        <p className="text-gray-500 dark:text-gray-400">No team found.</p>
      </SettingsSubPageLayout>
    );
  }

  return (
    <SettingsSubPageLayout title="Team" description="Manage your team settings">
      <div className="bg-white dark:bg-[#262b36] rounded-xl border border-gray-200 dark:border-[#353b48] p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Team Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team Name</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#404654] rounded-lg bg-white dark:bg-[#2e3340] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Your company name (for email compliance)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#404654] rounded-lg bg-white dark:bg-[#2e3340] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Physical Address</label>
            <textarea
              value={physicalAddress}
              onChange={(e) => setPhysicalAddress(e.target.value)}
              placeholder="Required for CAN-SPAM compliance"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#404654] rounded-lg bg-white dark:bg-[#2e3340] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <button
            onClick={handleSaveTeam}
            disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </SettingsSubPageLayout>
  );
}
