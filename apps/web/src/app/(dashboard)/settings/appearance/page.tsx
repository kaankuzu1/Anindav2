'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Palette, Sun, Moon, Monitor } from 'lucide-react';
import { SettingsSubPageLayout } from '@/components/settings/settings-sub-page-layout';

export default function AppearanceSettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <SettingsSubPageLayout title="Appearance" description="Customize how the app looks">
      <div className="bg-white dark:bg-[#262b36] rounded-xl border border-gray-200 dark:border-[#353b48] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-orange-400 to-pink-500 rounded-lg flex items-center justify-center">
            <Palette className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Appearance</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Customize how the app looks</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Theme</label>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Select your preferred color theme for the interface
            </p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { value: 'light', label: 'Light', icon: Sun, desc: 'Always use light mode' },
                { value: 'dark', label: 'Dark', icon: Moon, desc: 'Always use dark mode' },
                { value: 'system', label: 'System', icon: Monitor, desc: 'Match your OS setting' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                    theme === option.value
                      ? 'border-primary bg-primary/5 dark:bg-primary/10'
                      : 'border-gray-200 dark:border-[#353b48] hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className={`w-full h-16 rounded-lg mb-3 overflow-hidden border ${
                    option.value === 'dark'
                      ? 'bg-gray-900 border-gray-700'
                      : option.value === 'light'
                      ? 'bg-white border-gray-200'
                      : 'bg-gradient-to-r from-white to-gray-900 border-gray-300'
                  }`}>
                    <div className="flex h-full">
                      {option.value === 'system' ? (
                        <>
                          <div className="w-1/2 bg-white p-2">
                            <div className="w-full h-2 bg-gray-200 rounded mb-1"></div>
                            <div className="w-3/4 h-2 bg-gray-200 rounded"></div>
                          </div>
                          <div className="w-1/2 bg-gray-900 p-2">
                            <div className="w-full h-2 bg-gray-700 rounded mb-1"></div>
                            <div className="w-3/4 h-2 bg-gray-700 rounded"></div>
                          </div>
                        </>
                      ) : (
                        <div className={`w-full p-2 ${option.value === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
                          <div className={`w-full h-2 rounded mb-1 ${option.value === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                          <div className={`w-3/4 h-2 rounded ${option.value === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-1">
                    <option.icon className={`w-4 h-4 ${theme === option.value ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}`} />
                    <span className={`font-medium ${theme === option.value ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>
                      {option.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{option.desc}</p>

                  {theme === option.value && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {mounted && (
            <div className="pt-4 border-t border-gray-200 dark:border-[#353b48]">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Currently using: <span className="font-medium text-gray-900 dark:text-white capitalize">{resolvedTheme}</span> mode
              </p>
            </div>
          )}
        </div>
      </div>
    </SettingsSubPageLayout>
  );
}
