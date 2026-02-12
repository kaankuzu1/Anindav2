'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { SettingsSubPageLayout } from '@/components/settings/settings-sub-page-layout';

interface AISettings {
  enabled: boolean;
  defaultTone: 'professional' | 'friendly' | 'casual' | 'short';
  autoIntentDetection: boolean;
  autoSpamCheck: boolean;
}

export default function AISettingsPage() {
  const [aiSettings, setAiSettings] = useState<AISettings>({
    enabled: true,
    defaultTone: 'professional',
    autoIntentDetection: true,
    autoSpamCheck: true,
  });
  const [savingAi, setSavingAi] = useState(false);

  useEffect(() => {
    const savedAiSettings = localStorage.getItem('aiSettings');
    if (savedAiSettings) {
      try {
        setAiSettings(JSON.parse(savedAiSettings));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  return (
    <SettingsSubPageLayout title="AI Features" description="Configure AI-powered features for your team">
      {/* AI Settings */}
      <div className="bg-white dark:bg-[#262b36] rounded-xl border border-gray-200 dark:border-[#353b48] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-primary to-purple-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI Features</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Configure AI-powered features for your team</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Main Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#2e3340] rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Enable AI Features</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Turn on AI-powered assistance across the platform</p>
            </div>
            <button
              onClick={() => setAiSettings({ ...aiSettings, enabled: !aiSettings.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                aiSettings.enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-[#404654]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  aiSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Default Tone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Default AI Tone</label>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Choose the default tone for AI-generated content. You can override this for individual requests.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: 'professional', label: 'Professional', desc: 'Formal & business-like' },
                { value: 'friendly', label: 'Friendly', desc: 'Warm & approachable' },
                { value: 'casual', label: 'Casual', desc: 'Relaxed & informal' },
                { value: 'short', label: 'Concise', desc: 'Brief & to-the-point' },
              ].map((tone) => (
                <button
                  key={tone.value}
                  onClick={() => setAiSettings({ ...aiSettings, defaultTone: tone.value as AISettings['defaultTone'] })}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    aiSettings.defaultTone === tone.value
                      ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary'
                      : 'border-gray-200 dark:border-[#353b48] hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <p className="font-medium text-gray-900 dark:text-white">{tone.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{tone.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Auto Intent Detection */}
          <div className="flex items-center justify-between py-3 border-t border-gray-200 dark:border-[#353b48]">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Auto Intent Detection</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Automatically analyze and label incoming replies</p>
            </div>
            <button
              onClick={() => setAiSettings({ ...aiSettings, autoIntentDetection: !aiSettings.autoIntentDetection })}
              disabled={!aiSettings.enabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                aiSettings.autoIntentDetection && aiSettings.enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-[#404654]'
              } ${!aiSettings.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  aiSettings.autoIntentDetection && aiSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Auto Spam Check */}
          <div className="flex items-center justify-between py-3 border-t border-gray-200 dark:border-[#353b48]">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Auto Spam Check</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Automatically check emails for spam triggers before sending</p>
            </div>
            <button
              onClick={() => setAiSettings({ ...aiSettings, autoSpamCheck: !aiSettings.autoSpamCheck })}
              disabled={!aiSettings.enabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                aiSettings.autoSpamCheck && aiSettings.enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-[#404654]'
              } ${!aiSettings.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  aiSettings.autoSpamCheck && aiSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t border-gray-200 dark:border-[#353b48]">
            <button
              onClick={async () => {
                setSavingAi(true);
                localStorage.setItem('aiSettings', JSON.stringify(aiSettings));
                await new Promise((resolve) => setTimeout(resolve, 500));
                setSavingAi(false);
              }}
              disabled={savingAi}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {savingAi ? 'Saving...' : 'Save AI Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* AI Usage Info */}
      <div className="bg-gradient-to-r from-primary/5 to-purple-50 dark:from-primary/10 dark:to-purple-900/20 rounded-xl border border-primary/20 dark:border-primary/30 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">AI Features Available</h3>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { name: 'Reply Assistant', desc: 'Generate contextual email replies' },
            { name: 'Intent Detection', desc: 'Classify lead responses automatically' },
            { name: 'Campaign Generator', desc: 'Create email sequences with AI' },
            { name: 'Spam Risk Checker', desc: 'Check deliverability before sending' },
            { name: 'Follow-Up Generator', desc: 'Create smart follow-up emails' },
            { name: 'Daily Summary', desc: 'AI-powered inbox activity overview' },
          ].map((feature) => (
            <li key={feature.name} className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{feature.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{feature.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </SettingsSubPageLayout>
  );
}
