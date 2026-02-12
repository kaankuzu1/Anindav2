'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface SettingsSubPageLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function SettingsSubPageLayout({ title, description, children }: SettingsSubPageLayoutProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        <p className="text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      {children}
    </div>
  );
}
